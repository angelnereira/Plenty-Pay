import { InventoryRepository } from "../repositories/inventory.repository";
import { CreateProductInput, CreateLotInput, CreateTransactionInput } from "../types/inventory.types";

export class InventoryService {
    private repository: InventoryRepository;

    constructor() {
        this.repository = new InventoryRepository();
    }

    async registerProduct(clientId: string, input: CreateProductInput & { initialQuantity?: number, notes?: string, userId?: string }) {
        // Check if product already exists by SKU or Barcode
        let existing = null;
        if (input.sku) {
            existing = await this.repository.findProductBySku(clientId, input.sku);
        }
        if (!existing && input.barcode) {
            existing = await this.repository.findProductByBarcode(clientId, input.barcode);
        }

        if (existing) {
            // Si el producto ya existe, y se envió una cantidad inicial, la sumamos como una entrada
            if (input.initialQuantity && input.initialQuantity > 0) {
                await this.processBatchEntry(clientId, existing.id, {
                    quantity: input.initialQuantity,
                    purchasePrice: input.purchasePrice as any,
                    salePrice: input.salePrice as any,
                    notes: input.notes || 'Ajuste de inventario (Registro duplicado)',
                } as any, input.userId);

                // Refetch to get updated stock
                return this.repository.findProductById(existing.id);
            }
            return existing;
        }

        const { initialQuantity, notes, userId, ...productData } = input;

        const product = await this.repository.createProduct(clientId, productData);

        if (initialQuantity && initialQuantity > 0) {
            await this.processBatchEntry(clientId, product.id, {
                quantity: initialQuantity,
                purchasePrice: input.purchasePrice as any,
                salePrice: input.salePrice as any,
                notes: notes || 'Saldo inicial',
            } as any, userId);
        }

        return product;
    }

    async processBatchEntry(clientId: string, productId: string, lotInput: CreateLotInput, userId?: string) {
        // 1. Create the Lot
        const lot = await this.repository.createLot({
            ...lotInput,
            productId
        });

        // 2. Create the Transaction
        await this.repository.createTransaction({
            productId,
            type: 'ENTRY',
            quantity: lotInput.quantity,
            lotId: lot.id,
            reason: 'Ingreso por lote',
            reference: lotInput.batchNumber,
            userId
        });

        // 3. Update Product prices if they changed (as requested by user)
        await this.repository.updateProduct({
            id: productId,
            purchasePrice: lotInput.purchasePrice,
            salePrice: lotInput.salePrice || undefined
        });

        return lot;
    }

    async registerSale(clientId: string, productId: string, quantity: number, invoiceId: string, userId?: string) {
        return this.repository.createTransaction({
            productId,
            type: 'EXIT',
            quantity,
            invoiceId,
            reason: 'Venta - Factura',
            reference: invoiceId,
            userId
        });
    }

    async getDashboard(clientId: string) {
        return this.repository.getStats(clientId);
    }

    async searchProduct(clientId: string, query: string) {
        // Simple search by SKU, Barcode or Name
        const products = await this.repository.listProducts(clientId);
        return products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku?.toLowerCase().includes(query.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(query.toLowerCase())
        );
    }

    async updateProduct(clientId: string, id: string, input: any) {
        // Security check: ensure product belongs to client
        const existing = await this.repository.findProductById(id);
        if (!existing || existing.clientId !== clientId) {
            throw new Error("Producto no encontrado o no autorizado");
        }

        return this.repository.updateProduct({ id, ...input });
    }

    async registerMovement(clientId: string, input: {
        productId: string,
        type: 'ENTRY' | 'EXIT' | 'ADJUST',
        quantity: number,
        reason: string,
        reference?: string,
        userId?: string
    }) {
        // Validation: verify existence and ownership
        const product = await this.repository.findProductById(input.productId);
        if (!product || product.clientId !== clientId) {
            throw new Error("Producto no autorizado o inexistente");
        }

        return this.repository.createTransaction({
            productId: input.productId,
            type: input.type,
            quantity: input.quantity,
            reason: input.reason,
            reference: input.reference,
            userId: input.userId
        });
    }

    async deleteProduct(clientId: string, id: string) {
        // Security check: ensure product belongs to client
        const existing = await this.repository.findProductById(id);
        if (!existing || existing.clientId !== clientId) {
            throw new Error("Producto no encontrado o no autorizado");
        }

        return this.repository.deleteProduct(id);
    }
}
