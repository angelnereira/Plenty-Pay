'use server';

import { auth } from '@core/auth';
import { prismaServer } from '@core/database';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';

export interface DraftInvoice {
    id?: string;
    name: string;
    data: DocumentoElectronico;
}

/**
 * Guardar borrador de factura
 */
export async function saveDraft(draft: DraftInvoice) {
    try {
        console.log('[saveDraft] 💾 Guardando borrador...', { name: draft.name });

        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        const userId = session.user.id;
        const clientId = session.user.clientId;

        if (!clientId) {
            return { success: false, error: 'Cliente no encontrado' };
        }

        // Calcular totales
        const subtotal = parseFloat(draft.data.totalesSubTotales.totalPrecioNeto);
        const tax = parseFloat(draft.data.totalesSubTotales.totalITBMS);
        const total = parseFloat(draft.data.totalesSubTotales.totalFactura);
        const discount = 0; // Los borradores no tienen descuento aplicado todavía
        const subtotalAfterDiscount = subtotal - discount;

        console.log('[saveDraft] 📊 Totales calculados:', { subtotal, tax, total, discount, subtotalAfterDiscount });

        // Extraer datos del cliente
        const cliente = draft.data.datosTransaccion.cliente;
        const razonSocial = 'razonSocial' in cliente ? cliente.razonSocial : (('nombre' in cliente && cliente.nombre) || 'Cliente');
        const numeroRUC = 'numeroRUC' in cliente ? cliente.numeroRUC : null;
        const digitoVerificadorRUC = 'digitoVerificadorRUC' in cliente ? cliente.digitoVerificadorRUC : null;
        const correo = 'correoElectronico1' in cliente ? cliente.correoElectronico1 : null;
        const direccion = 'direccion' in cliente ? cliente.direccion : null;

        // Guardar en la base de datos como metadata JSON
        const saved = await prismaServer.invoice.create({
            data: {
                clientId,
                createdBy: userId,
                clientReferenceId: `DRAFT-${Date.now()}`,

                // Campos requeridos del emisor (usar defaults para drafts)
                issuerRuc: 'DRAFT',
                issuerDv: '00',
                issuerName: draft.name,
                issuerAddress: 'Borrador',
                issuerEmail: session.user.email || '',

                // Campos requeridos del receptor
                receiverName: razonSocial || '',
                receiverEmail: correo || '',
                receiverAddress: direccion || '',
                receiverRuc: numeroRUC,
                receiverDv: digitoVerificadorRUC,

                // Montos (campos requeridos)
                subtotal,
                discount,
                subtotalAfterDiscount,
                itbms: tax,
                total,

                currency: 'PAB',
                status: 'DRAFT', // Estado de borrador

                // Guardar datos completos en notes (JSON as string)
                notes: JSON.stringify({
                    draftName: draft.name,
                    documentoCompleto: draft.data,
                    savedAt: new Date().toISOString()
                })
            }
        });

        console.log('[saveDraft] ✅ Borrador guardado exitosamente:', { id: saved.id });

        return {
            success: true,
            data: {
                id: saved.id,
                name: draft.name
            }
        };
    } catch (error: any) {
        console.error('[saveDraft] ❌ Error:', error);
        return {
            success: false,
            error: error.message || 'Error al guardar borrador'
        };
    }
}

/**
 * Listar borradores del usuario
 */
export async function listDrafts() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        const clientId = session.user.clientId;
        if (!clientId) {
            return { success: false, error: 'Cliente no encontrado' };
        }

        const drafts = await prismaServer.invoice.findMany({
            where: {
                clientId,
                status: 'DRAFT'
            },
            select: {
                id: true,
                issuerName: true,
                receiverName: true,
                total: true,
                createdAt: true,
                notes: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20
        });

        return {
            success: true,
            data: drafts.map(d => {
                let parsedNotes: any = {};
                if (d.notes) {
                    try { parsedNotes = JSON.parse(d.notes); } catch (e) { }
                }
                return {
                    id: d.id,
                    name: parsedNotes.draftName || d.issuerName,
                    customerName: d.receiverName,
                    total: d.total,
                    createdAt: d.createdAt,
                    data: parsedNotes.documentoCompleto
                };
            })
        };
    } catch (error: any) {
        console.error('[listDrafts] Error:', error);
        return {
            success: false,
            error: error.message || 'Error al listar borradores'
        };
    }
}

/**
 * Cargar un borrador específico
 */
export async function loadDraft(draftId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        const clientId = session.user.clientId;
        if (!clientId) {
            return { success: false, error: 'Cliente no encontrado' };
        }

        const draft = await prismaServer.invoice.findFirst({
            where: {
                id: draftId,
                clientId,
                status: 'DRAFT'
            },
            select: {
                id: true,
                notes: true
            }
        });

        if (!draft) {
            return { success: false, error: 'Borrador no encontrado' };
        }

        let parsedNotes: any = {};
        if (draft.notes) {
            try { parsedNotes = JSON.parse(draft.notes); } catch (e) { }
        }
        return {
            success: true,
            data: {
                id: draft.id,
                name: parsedNotes.draftName || 'Borrador',
                data: parsedNotes.documentoCompleto
            }
        };
    } catch (error: any) {
        console.error('[loadDraft] Error:', error);
        return {
            success: false,
            error: error.message || 'Error al cargar borrador'
        };
    }
}

/**
 * Eliminar un borrador
 */
export async function deleteDraft(draftId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        const clientId = session.user.clientId;
        if (!clientId) {
            return { success: false, error: 'Cliente no encontrado' };
        }

        await prismaServer.invoice.delete({
            where: {
                id: draftId,
                clientId,
                status: 'DRAFT'
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error('[deleteDraft] Error:', error);
        return {
            success: false,
            error: error.message || 'Error al eliminar borrador'
        };
    }
}

/**
 * Cargar factura para reintento (cualquier status)
 * 
 * A diferencia de loadDraft, esta función puede cargar facturas con
 * status ERROR, REJECTED, DRAFT para permitir reintentos.
 * 
 * Intenta reconstruir el DocumentoElectronico desde:
 * 1. Campo `notes` (contiene documentoCompleto guardado)
 * 2. Reconstrucción desde campos de la factura
 */
export async function loadInvoiceForRetry(invoiceId: string) {
    try {
        console.log('[loadInvoiceForRetry] 🔄 Cargando factura para reintento:', invoiceId);

        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: 'No autenticado' };
        }

        const clientId = session.user.clientId;
        if (!clientId) {
            return { success: false, error: 'Cliente no encontrado' };
        }

        // Buscar factura sin filtrar por status
        const invoice = await prismaServer.invoice.findFirst({
            where: {
                id: invoiceId,
                clientId,
                // NO filtramos por status - permitimos ERROR, REJECTED, DRAFT
            },
            include: {
                items: true,
            }
        });

        if (!invoice) {
            return { success: false, error: 'Factura no encontrada' };
        }

        // Solo permitir retry de facturas con status apropiado
        const retryableStatuses = ['ERROR', 'REJECTED', 'DRAFT', 'PENDING'];
        if (!retryableStatuses.includes(invoice.status)) {
            return {
                success: false,
                error: `No se puede reintentar una factura con status: ${invoice.status}`
            };
        }

        // Intentar recuperar DocumentoElectronico de notes
        let documentoCompleto: DocumentoElectronico | null = null;

        if (invoice.notes) {
            try {
                const notesData = JSON.parse(invoice.notes);
                if (notesData.documentoCompleto) {
                    documentoCompleto = notesData.documentoCompleto;
                    console.log('[loadInvoiceForRetry] ✅ Documento recuperado de notes');
                }
            } catch (e) {
                console.log('[loadInvoiceForRetry] ⚠️ No se pudo parsear notes, reconstruyendo...');
            }
        }

        // Si no hay documento en notes, reconstruir desde campos
        if (!documentoCompleto) {
            console.log('[loadInvoiceForRetry] 🔧 Reconstruyendo documento desde campos');

            documentoCompleto = {
                datosTransaccion: {
                    tipoEmision: '01',
                    tipoDocumento: 'FE',
                    numeroDocumentoFiscal: invoice.invoiceNumber || '',
                    puntoFacturacionFiscal: '001',
                    fechaEmision: invoice.issueDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
                    cliente: {
                        tipoClienteFE: invoice.receiverRuc ? '01' : '02',
                        tipoContribuyente: '1',
                        numeroRUC: invoice.receiverRuc || '',
                        digitoVerificadorRUC: invoice.receiverDv || '',
                        razonSocial: invoice.receiverName || '',
                        direccion: invoice.receiverAddress || '',
                        correoElectronico1: invoice.receiverEmail || '',
                    }
                },
                listaItems: invoice.items.map((item: any, idx: number) => ({
                    descripcion: item.description || '',
                    cantidad: String(item.quantity || 1),
                    precioUnitario: String(item.unitPrice || 0),
                    precioUnitarioDescuento: '0.00',
                    precioItem: String(item.unitPrice || 0),
                    valorTotal: String(item.total || 0),
                    codigoGTIN: idx + 1,
                    fechaFabricacion: '',
                    fechaCaducidad: '',
                    tasaITBMS: item.taxRate || '07',
                    valorITBMS: String(item.taxAmount || 0),
                })),
                totalesSubTotales: {
                    totalPrecioNeto: String(invoice.subtotal || 0),
                    totalITBMS: String(invoice.itbms || 0),
                    totalMontoGravado: String(invoice.subtotal || 0),
                    // totalDescuento se OMITE: los descuentos por-ítem ya están
                    // aplicados en precioItem. Informar este campo sin
                    // listaDescBonificacion provoca rechazo de HKA.
                    totalAcarreoCobrado: '0.00',
                    valorSeguroCobrado: '0.00',
                    totalFactura: String(invoice.total || 0),
                    totalValorRecibido: String(invoice.total || 0),
                    vuelto: '0.00',
                    tiempoPago: '1',
                    nroItems: String(invoice.items.length),
                    totalTodosItems: String(invoice.total || 0),
                },
                listaPagos: [],
            } as any;
        }

        console.log('[loadInvoiceForRetry] ✅ Factura cargada exitosamente para reintento');

        return {
            success: true,
            data: {
                id: invoice.id,
                invoiceId: invoice.id, // ID explícito para reintento
                name: `Reintento - ${invoice.receiverName || 'Factura'}`,
                status: invoice.status,
                hkaAttempts: invoice.hkaAttempts || 0,
                data: documentoCompleto,
                isRetry: true,
            }
        };
    } catch (error: any) {
        console.error('[loadInvoiceForRetry] ❌ Error:', error);
        return {
            success: false,
            error: error.message || 'Error al cargar factura para reintento'
        };
    }
}
