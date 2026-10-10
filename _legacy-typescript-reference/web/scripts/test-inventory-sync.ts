
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from '../features/invoicing/model/services/invoice.service';

const prisma = new PrismaClient();
const invoiceService = new InvoiceService();

async function testInventorySync() {
    console.log('🚀 Starting Inventory Sync Verification Test...\n');

    try {
        // 1. Setup Test Data
        console.log('🔍 Fetching valid client and user...');
        const client = await prisma.client.findFirst({ where: { inventoryEnabled: true } });
        const user = await prisma.user.findFirst({ where: { clientId: client?.id } });

        if (!client || !user) {
            throw new Error('Could not find a valid client with inventory enabled or a associated user for testing.');
        }

        const clientId = client.id;
        const userId = user.id;

        console.log(`✅ Using Client: ${client.name} (${clientId})`);
        console.log(`✅ Using User: ${user.email} (${userId})`);

        console.log('📝 Setting up test product...');
        const sku = `TEST-SKU-${Date.now()}`;
        const product = await prisma.product.create({
            data: {
                clientId,
                name: 'Test Product for Sync',
                sku: sku,
                barcode: `BC-${sku}`,
                currentStock: 10,
                purchasePrice: 5,
                salePrice: 10,
                taxCode: '7',
                category: 'TEST'
            }
        });

        console.log(`✅ Product created: ${product.name} (SKU: ${sku}) with stock: ${product.currentStock}`);

        // 2. Create a dummy invoice
        console.log('📝 Creating dummy invoice...');
        const invoice = await prisma.invoice.create({
            data: {
                clientId,
                documentType: 'FACTURA',
                status: 'DRAFT',
                invoiceNumber: `TEST-INV-${Date.now()}`,
                total: 20,
                createdBy: userId,
                clientReferenceId: clientId,
                issuerRuc: '12345-678-90',
                issuerDv: '00',
                issuerName: 'Test Issuer',
                issuerAddress: 'Test Address',
                issuerPhone: '555-0000',
                issuerEmail: 'test@plentypay.com',
                receiverName: 'Test Receiver',
                receiverType: 'CONTRIBUTOR',
                receiverRuc: '8-000-000',
                receiverDv: '00',
                receiverAddress: 'Test Receiver Address',
                receiverPhone: '555-1111',
                receiverEmail: 'receiver@test.com',
                subtotal: 18.6,
                subtotalAfterDiscount: 18.6,
                itbms: 1.4,
                // Add items to the invoice
                items: {
                    create: [
                        {
                            lineNumber: 1,
                            description: 'Test Product for Sync',
                            code: sku,
                            quantity: 2,
                            unitPrice: 10,
                            taxRate: 7,
                            taxCode: '01',
                            taxAmount: 1.4,
                            subtotal: 20,
                            total: 20
                        }
                    ]
                }
            },
            include: { items: true }
        });

        console.log(`✅ Invoice created: ${invoice.id}`);

        // 3. Test handleInventoryDeductionForInternal (which calls handleInventoryDeduction)
        console.log('\n🧪 Testing stock deduction...');
        await invoiceService.handleInventoryDeductionForInternal(invoice.id, clientId);

        // 4. Verify Stock
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        console.log(`📊 Stock after deduction: ${updatedProduct?.currentStock} (Expected: 8)`);

        if (Number(updatedProduct?.currentStock) === 8) {
            console.log('✅ PASS: Stock correctly deducted.');
        } else {
            console.error('❌ FAIL: Stock deduction incorrect.');
        }

        // 5. Test Idempotency (run again)
        console.log('\n🧪 Testing idempotency (second run)...');
        await invoiceService.handleInventoryDeductionForInternal(invoice.id, clientId);

        const doubleUpdatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        console.log(`📊 Stock after second run: ${doubleUpdatedProduct?.currentStock} (Expected: 8)`);

        if (Number(doubleUpdatedProduct?.currentStock) === 8) {
            console.log('✅ PASS: Idempotency check successful. No double deduction.');
        } else {
            console.error('❌ FAIL: Idempotency failed. Stock deducted twice.');
        }

        // 6. Verify StockMovement record
        const movement = await prisma.stockMovement.findFirst({
            where: { referenceId: invoice.id, productId: product.id }
        });

        if (movement) {
            console.log('✅ PASS: StockMovement record found.');
            console.log(`   - Movement ID: ${movement.id}`);
            console.log(`   - Quantity: ${movement.quantity}`);
        } else {
            console.error('❌ FAIL: StockMovement record NOT found.');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await prisma.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
        await prisma.invoice.delete({ where: { id: invoice.id } });
        await prisma.product.delete({ where: { id: product.id } });
        console.log('✅ Cleanup complete.');

    } catch (error) {
        console.error('\n❌ Test execution failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testInventorySync();
