'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { revalidatePath } from 'next/cache';
import { AppAction } from '@shared/lib/workflow-ids';
import { processInvoiceForMotor } from '@core/motor/credit-hook';

export interface CreateInvoiceInput {
    clientData: {
        ruc: string;
        dv: string;
        razonSocial: string;
        tipoContribuyente: string;
        email?: string;
        address?: string;
        phone?: string;
    };
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        cpbsCode?: string;
        cpbsUnit?: string;
    }[];
    paymentMethod: string;
    /**
     * Término de pago. Si "CREDIT", el sistema genera automáticamente un
     * cargo en el ledger del Motor (cuando el tenant lo tiene asignado).
     */
    paymentTerm?: 'CASH' | 'CREDIT';
    action?: AppAction;
}

export async function createInvoice(input: CreateInvoiceInput) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autorizado' };
        }

        const userId = session.user.id;

        // Log input data for debugging CF name mapping
        console.log('[createInvoice] 📥 Input clientData:', {
            ruc: input.clientData.ruc,
            dv: input.clientData.dv,
            razonSocial: input.clientData.razonSocial,
            tipoContribuyente: input.clientData.tipoContribuyente,
        });

        // Obtener organización del usuario (asumimos la primera por ahora o la activa)
        // Corregido: Buscamos el usuario y su relación con organización, ya que Organization no tiene userId directo
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { client: true }
        });

        const organization = user?.client; // Updated from original code which had user?.organization but schema has user.client

        if (!organization) {
            return { success: false, error: 'No se encontró organización para el usuario. Por favor configura tu empresa primero.' };
        }

        // Validación estricta: La organización DEBE tener RUC, DV, dirección y email configurados
        // Esto es requerido por HKA y no puede ser omitido
        if (!organization.ruc || !organization.dv) {
            return {
                success: false,
                error: 'Tu organización no tiene RUC y DV configurados. Por favor completa la configuración en el panel de administración antes de emitir facturas.'
            };
        }

        if (!organization.address) {
            return {
                success: false,
                error: 'Tu organización no tiene dirección configurada. Por favor completa la configuración en el panel de administración.'
            };
        }

        if (!organization.email) {
            return {
                success: false,
                error: 'Tu organización no tiene email configurado. Por favor completa la configuración en el panel de administración.'
            };
        }

        // 1. Gestionar Cliente (Buscar o Crear)
        // Buscamos si ya existe un cliente con ese RUC en esta organización
        let customer = await prisma.customer.findFirst({
            where: {
                clientId: organization.id,
                ruc: input.clientData.ruc
            }
        });

        // Si no existe, lo creamos automáticamente
        if (!customer) {
            // NOTE: In original code logic, we create. keeping it.
            customer = await prisma.customer.create({
                data: {
                    clientId: organization.id,
                    name: input.clientData.razonSocial,
                    ruc: input.clientData.ruc,
                    dv: input.clientData.dv,
                    // Mapeo simple de tipo, ajustar según enum de Prisma si es necesario
                    rucType: input.clientData.tipoContribuyente.includes('JURIDICO') ? '2' : '1',
                    email: input.clientData.email || null,
                    address: input.clientData.address || '',
                    phone: input.clientData.phone || null,
                }
            });
        }

        // 2. Calcular Totales
        let subtotal = 0;
        let taxAmount = 0;
        let total = 0;

        const invoiceItems = input.items.map((item, index) => {
            const lineSubtotal = item.quantity * item.unitPrice;
            const lineTax = lineSubtotal * item.taxRate;
            const lineTotal = lineSubtotal + lineTax;

            subtotal += lineSubtotal;
            taxAmount += lineTax;
            total += lineTotal;

            return {
                lineNumber: index + 1,
                code: `ITEM-${index + 1}`,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                subtotal: lineSubtotal,
                taxAmount: lineTax,
                total: lineTotal,
                cpbsCode: item.cpbsCode,
                cpbsUnit: item.cpbsUnit,
            };
        });

        // 3. Crear Factura en estado DRAFT
        const invoiceNumber = `DRAFT-${Date.now().toString().slice(-6)}`;
        const clientReferenceId = `REF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const invoice = await prisma.invoice.create({
            data: {
                clientId: organization.id,
                customerId: customer.id,
                createdBy: userId,
                clientReferenceId,
                invoiceNumber,
                status: 'DRAFT',

                // Datos del Emisor (de la organización)
                issuerRuc: organization.ruc,
                issuerDv: organization.dv,
                issuerName: organization.name,
                issuerAddress: organization.address,
                issuerEmail: organization.email,
                issuerPhone: organization.phone || undefined,

                // Datos del Receptor (del cliente/input)
                // Auto-detectar tipo de receptor basado en RUC/DV
                // Government entities in Panama use RUC with "-NT-" (No Tributario)
                receiverType: input.clientData.ruc?.toUpperCase().includes('-NT-')
                    ? 'GOVERNMENT'
                    : (input.clientData.ruc &&
                        input.clientData.dv &&
                        input.clientData.ruc.length > 5 &&
                        input.clientData.dv !== '00')
                        ? 'CONTRIBUTOR'
                        : 'FINAL_CONSUMER',
                receiverName: input.clientData.razonSocial,
                receiverRuc: input.clientData.ruc,
                receiverDv: input.clientData.dv,
                receiverEmail: input.clientData.email || undefined,
                receiverPhone: input.clientData.phone || undefined,
                receiverAddress: input.clientData.address || undefined,

                // Montos
                subtotal,
                itbms: taxAmount,
                subtotalAfterDiscount: subtotal,
                total,

                // Término de pago: si "CREDIT", el hook del Motor genera el cargo
                paymentTerm: input.paymentTerm ?? 'CASH',

                items: {
                    create: invoiceItems
                }
            }
        });

        // Hook Motor: si paymentTerm=CREDIT y el tenant tiene Motor activo,
        // registra automáticamente un CHARGE para la entidad correspondiente.
        // Best-effort: no bloquea la creación de la factura.
        await processInvoiceForMotor(invoice.id);

        revalidatePath('/dashboard/facturas');

        return { success: true, invoiceId: invoice.id };

    } catch (error: unknown) {
        console.error('Error creating invoice:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error al crear la factura' };
    }
}
