/**
 * Invoice Storage Service
 * 
 * Handles persistence of invoices certified by HKA to the database.
 * IMPORTANT: This service stores the COMPLETE HKA response for auditing
 * and traceability purposes.
 * 
 * HKA Response Codes:
 * - 200: Operación exitosa → EMITTED
 * - 100: Sin datos → ERROR
 * - 101: Token inválido → ERROR
 * - 102: Documento duplicado o no existe → ERROR (o puede ser success si es consulta)
 * - 109: Error de validación de campo → REJECTED
 * - 201: Error al procesar solicitud → ERROR
 * - 202: Error de respuesta de la DGI → ERROR
 * - 300: Reenviar documento → QUEUED
 * 
 * @responsible Storing certified invoices with full HKA response data
 */

import { prisma } from '@core/database';
import type { DocumentoElectronico, EnviarResponse } from '../types/types';
import type { InvoiceStatus, DocumentType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mapHKAToDocumentType } from './utils';
import { HKALogger } from './logger';

/**
 * Calcula la fecha límite de autorización DGI para flujos de Autorización Posterior.
 * - tipoEmision=03: fin del día hábil siguiente (skips weekends)
 * - tipoEmision=04: 72 horas exactas desde fechaEmision
 */
function calcFechaLimitePosterior(fechaEmision: Date, tipoEmision: string): Date | undefined {
    if (tipoEmision === '03') {
        const d = new Date(fechaEmision);
        d.setDate(d.getDate() + 1);
        while (d.getDay() === 0 || d.getDay() === 6) {
            d.setDate(d.getDate() + 1);
        }
        d.setHours(23, 59, 59, 0);
        return d;
    }
    if (tipoEmision === '04') {
        return new Date(fechaEmision.getTime() + 72 * 60 * 60 * 1000);
    }
    return undefined;
}

/**
 * Extended HKA Response with full metadata from emit-full-invoice action
 * This matches the actual response structure from HKA
 */
export interface HKAEmitResponse {
    cufe: string;
    qr: string;
    fechaRecepcionDGI: string;
    nroProtocoloAutorizacion: string;
    /** Código de respuesta HKA */
    codigo?: string;
    /** Mensaje de HKA */
    mensaje?: string;
    /** Número de documento fiscal asignado */
    numeroDocumentoFiscal?: string;
}

interface SaveInvoiceParams {
    clientId: string;
    userId: string;
    documento: DocumentoElectronico;
    hkaResponse: EnviarResponse | HKAEmitResponse;
    status: InvoiceStatus;
    /** Código de respuesta HKA (200, 102, 109, etc.) */
    hkaCode?: string;
    /** Mensaje de respuesta HKA */
    hkaMessage?: string;
    /** Optional: Pass existing invoice ID to update instead of create */
    existingInvoiceId?: string;
}

/**
 * HKA Response Code Classification
 * Maps HKA codes to invoice status and human-readable descriptions
 */
const HKA_RESPONSE_CODES: Record<string, { status: InvoiceStatus; description: string; isSuccess: boolean }> = {
    '200': { status: 'EMITTED', description: 'Documento certificado exitosamente por la DGI', isSuccess: true },
    '100': { status: 'ERROR', description: 'Sin datos - Verificar parámetros de búsqueda', isSuccess: false },
    '101': { status: 'ERROR', description: 'Token inválido - Verificar credenciales', isSuccess: false },
    '102': { status: 'ERROR', description: 'Documento duplicado o no existe', isSuccess: false },
    '109': { status: 'REJECTED', description: 'Error de validación de campo', isSuccess: false },
    '201': { status: 'ERROR', description: 'Error al procesar solicitud', isSuccess: false },
    '202': { status: 'ERROR', description: 'Error de respuesta de la DGI', isSuccess: false },
    '300': { status: 'QUEUED', description: 'Documento pendiente de reenvío', isSuccess: false },
};

/**
 * Gets invoice status and description based on HKA response code
 */
function getHKAResponseClassification(code: string | undefined): { status: InvoiceStatus; description: string; isSuccess: boolean } {
    if (!code) {
        return { status: 'ERROR', description: 'Código de respuesta no recibido', isSuccess: false };
    }
    return HKA_RESPONSE_CODES[code] || { status: 'ERROR', description: `Código desconocido: ${code}`, isSuccess: false };
}

/**
 * Maps our status strings to Prisma InvoiceStatus enum
 */
function mapStatusToPrisma(status: string): InvoiceStatus {
    const statusMap: Record<string, InvoiceStatus> = {
        'CERTIFICADA': 'EMITTED',
        'PROCESANDO': 'PROCESSING',
        'ERROR': 'ERROR',
        'ANULADA': 'CANCELLED',
        'BORRADOR': 'DRAFT',
        // Direct mappings
        'EMITTED': 'EMITTED',
        'PROCESSING': 'PROCESSING',
        'DRAFT': 'DRAFT',
        'QUEUED': 'QUEUED',
        'CERTIFIED': 'CERTIFIED',
        'REJECTED': 'REJECTED',
        'CANCELLED': 'CANCELLED',
    };
    return statusMap[status] || 'DRAFT';
}

/**
 * Guarda o actualiza una factura certificada en la base de datos
 * 
 * IMPORTANTE: Esta función almacena la respuesta COMPLETA de HKA incluyendo:
 * - CUFE: Identificador único de la factura (66 caracteres)
 * - QR: URL completa del código QR de la DGI
 * - fechaRecepcionDGI: Timestamp exacto de recepción
 * - nroProtocoloAutorizacion: Número de protocolo de autorización
 * - codigo: Código de respuesta HKA (200=éxito, otros=error)
 * - mensaje: Mensaje descriptivo de HKA
 * 
 * @param params - Parámetros de la factura a guardar
 * @returns Invoice creada o actualizada
 */
export async function saveInvoiceToDB(params: SaveInvoiceParams) {
    const { clientId, userId, documento, hkaResponse, status, hkaCode, hkaMessage, existingInvoiceId } = params;

    // Extraer datos del cliente/receptor de la factura
    const cliente = documento.datosTransaccion?.cliente;
    const totals = documento.totalesSubTotales;
    const transaccion = documento.datosTransaccion;

    // Extraer RUC del receptor (tipo union con varios tipos de cliente)
    const clienteRecord = cliente as unknown as Record<string, unknown> | undefined;
    const receiverRuc = clienteRecord?.numeroRUC as string | undefined ?? null;
    const receiverDv = clienteRecord?.digitoVerificadorRUC as string | undefined ?? null;
    const receiverName = (clienteRecord?.razonSocial as string | undefined) ?? 'Consumidor Final';

    // Obtener datos del emisor desde el cliente (organización)
    const issuerData = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
            ruc: true,
            dv: true,
            name: true,
            address: true,
            email: true,
            phone: true,
        }
    });

    // Clasificar la respuesta según el código HKA
    const responseCode = hkaCode || (hkaResponse as HKAEmitResponse).codigo || '200';
    const classification = getHKAResponseClassification(responseCode);

    // Determinar el status final: usar clasificación HKA si no se especificó explícitamente
    const finalStatus = status || classification.status;

    // ⭐ USAR LA URL QR COMPLETA DE HKA (no generarla manualmente)
    // HKA devuelve una URL firmada con JWT que es la oficial para consulta
    const qrUrlFromHKA = hkaResponse.qr;

    const storageLogger = new HKALogger();
    storageLogger.log({
        level: 'DEBUG',
        method: 'saveInvoiceToDB',
        timestamp: new Date(),
        metadata: {
            cufe: hkaResponse.cufe,
            hasQR: !!qrUrlFromHKA,
            codigo: responseCode,
            classification: classification.status,
            fechaRecepcion: hkaResponse.fechaRecepcionDGI,
            protocolo: hkaResponse.nroProtocoloAutorizacion,
        }
    });

    // Preparar datos comunes para create/update
    const invoiceData = {
        // Multi-tenant
        clientId,
        createdBy: userId,

        // Generar clientReferenceId único si es nuevo
        clientReferenceId: existingInvoiceId ? undefined : `INV-${Date.now()}-${randomUUID().slice(0, 8)}`,

        // Datos del Emisor (snapshot del cliente)
        issuerRuc: issuerData?.ruc || '',
        issuerDv: issuerData?.dv || '',
        issuerName: issuerData?.name || '',
        issuerAddress: issuerData?.address || '',
        issuerEmail: issuerData?.email || '',
        issuerPhone: issuerData?.phone || undefined,

        // Datos del Receptor
        receiverType: (cliente?.tipoClienteFE === '01' || cliente?.tipoClienteFE === '03')
            ? 'CONTRIBUTOR' as const
            : cliente?.tipoClienteFE === '02'
                ? 'FINAL_CONSUMER' as const
                : 'FOREIGN' as const,
        receiverRuc: receiverRuc,
        receiverDv: receiverDv,
        receiverName: receiverName,
        receiverEmail: cliente?.correoElectronico1 || undefined,
        receiverPhone: cliente?.telefono1 || undefined,
        receiverAddress: (clienteRecord?.direccion as string | undefined) ?? undefined,

        // Documento
        documentType: mapHKAToDocumentType(transaccion?.tipoDocumento) as DocumentType,
        invoiceNumber: transaccion?.numeroDocumentoFiscal,
        numeroDocumentoFiscal: transaccion?.numeroDocumentoFiscal,
        pointOfSale: transaccion?.puntoFacturacionFiscal || '001',

        // ⭐ Campos HKA de certificación (RESPUESTA COMPLETA Y REAL)
        cufe: hkaResponse.cufe,
        // Guardar el QR completo (URL firmada de HKA con JWT)
        qrCode: qrUrlFromHKA,
        // También guardar la URL del QR para fácil acceso
        qrUrl: qrUrlFromHKA,
        // Protocolo de autorización de HKA
        hkaProtocol: hkaResponse.nroProtocoloAutorizacion,
        // Fecha exacta de recepción por la DGI
        hkaProtocolDate: hkaResponse.fechaRecepcionDGI
            ? new Date(hkaResponse.fechaRecepcionDGI)
            : new Date(),
        // ⭐ Código REAL de respuesta HKA (no hardcodeado)
        hkaCode: responseCode,
        // ⭐ Status basado en código de respuesta
        hkaStatus: classification.isSuccess ? 'Autorizado' : 'Error',
        // ⭐ Mensaje REAL de HKA (no hardcodeado)
        hkaMessage: hkaMessage || classification.description,

        // ⭐ RESPUESTA COMPLETA DE HKA (para auditoría y debugging)
        hkaResponseData: {
            // Datos exactos de respuesta HKA
            cufe: hkaResponse.cufe,
            qr: qrUrlFromHKA,
            nroProtocoloAutorizacion: hkaResponse.nroProtocoloAutorizacion,
            fechaRecepcionDGI: hkaResponse.fechaRecepcionDGI,
            codigo: responseCode,
            mensaje: hkaMessage || classification.description,
            // ⭐ LLAVE COMPUESTA datosDocumento (los 5 campos para EstadoDocumento/Descarga/Anulación).
            // Almacenados explícitamente para reconstituirla sin parsear documentoEnviado completo.
            // Pendiente: migrar codigoSucursalEmisor y tipoEmision a columnas propias en Invoice.
            datosDocumento: {
                codigoSucursalEmisor: documento.codigoSucursalEmisor || '',
                numeroDocumentoFiscal: transaccion?.numeroDocumentoFiscal || '',
                puntoFacturacionFiscal: transaccion?.puntoFacturacionFiscal || '',
                tipoDocumento: transaccion?.tipoDocumento || '01',
                tipoEmision: transaccion?.tipoEmision || '01',
            },
            // Documento original enviado (para referencia/debugging)
            documentoEnviado: documento,
            // Metadata de proceso
            processedAt: new Date().toISOString(),
            processVersion: '2.1',
        },

        // Montos
        subtotal: parseFloat(totals?.totalPrecioNeto || '0'),
        discount: parseFloat(totals?.totalDescuento || '0'),
        subtotalAfterDiscount: parseFloat(totals?.totalPrecioNeto || '0') - parseFloat(totals?.totalDescuento || '0'),
        itbms: parseFloat(totals?.totalITBMS || '0'),
        total: parseFloat(totals?.totalFactura || '0'),
        currency: 'PAB',

        // Fechas
        issueDate: transaccion?.fechaEmision
            ? new Date(transaccion.fechaEmision)
            : new Date(),

        // Fecha límite para autorización DGI posterior (solo tipoEmision=03/04)
        fechaLimitePosterior: transaccion?.tipoEmision
            ? calcFechaLimitePosterior(
                transaccion.fechaEmision ? new Date(transaccion.fechaEmision) : new Date(),
                transaccion.tipoEmision
              )
            : undefined,

        // ⭐ Estado basado en clasificación de código HKA
        status: mapStatusToPrisma(finalStatus),
        emittedAt: classification.isSuccess ? new Date() : undefined,

        // Tracking
        hkaAttempts: 1,
        hkaLastAttempt: new Date(),
    };

    // Preparar items para crear/actualizar
    // NOTA: item._productId es un campo auxiliar (no-fiscal) inyectado por
    // mapManualInvoiceToHKARequest cuando el ítem proviene del inventario.
    const itemsData = documento.listaItems?.map((item: any, index) => ({
        lineNumber: index + 1,
        code: item.codigo || `ITEM-${index + 1}`,
        description: item.descripcion,
        quantity: parseFloat(item.cantidad || '1'),
        unitPrice: parseFloat(item.precioUnitario || '0'),
        unit: item.unidadMedida || 'UND',
        discount: parseFloat(item.precioUnitarioDescuento || '0'),
        discountRate: 0,
        taxRate: item.tasaITBMS === '00' ? 0 : item.tasaITBMS === '01' ? 7 : item.tasaITBMS === '02' ? 10 : 15,
        taxCode: item.tasaITBMS || '01',
        taxAmount: parseFloat(item.valorITBMS || '0'),
        subtotal: parseFloat(item.precioItem || '0'),
        total: parseFloat(item.valorTotal || '0'),
        cpbsCode: item.codigoCPBS || undefined,
        cpbsUnit: item.unidadMedidaCPBS || undefined,
        // Leer productId del campo pasante _productId (puesto por el mapper)
        productId: item._productId || null,
    })) || [];

    // Si existe invoiceId, actualizar; si no, crear
    if (existingInvoiceId) {
        // Primero eliminar items existentes y luego crear los nuevos
        await prisma.invoiceItem.deleteMany({
            where: { invoiceId: existingInvoiceId }
        });

        const updatedInvoice = await prisma.invoice.update({
            where: { id: existingInvoiceId },
            data: invoiceData,
        });

        // Crear los nuevos items
        if (itemsData.length > 0) {
            await prisma.invoiceItem.createMany({
                data: itemsData.map(item => ({
                    ...item,
                    invoiceId: existingInvoiceId,
                })),
            });
        }

        return updatedInvoice;
    } else {
        // Crear factura con items incluidos
        return await prisma.invoice.create({
             
            data: {
                ...invoiceData,
                items: itemsData.length > 0 ? {
                    create: itemsData
                } : undefined,
            } as any, // Type assertion needed due to conditional fields
        });
    }
}

/**
 * Actualiza una factura existente con datos de HKA después de emisión exitosa
 */
export async function updateInvoiceWithHKAResponse(
    invoiceId: string,
    hkaResponse: EnviarResponse,
    numeroDocumentoFiscal: string
) {
    return await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            // Número de documento
            invoiceNumber: numeroDocumentoFiscal,
            numeroDocumentoFiscal: numeroDocumentoFiscal,

            // Datos HKA
            cufe: hkaResponse.cufe,
            qrCode: hkaResponse.qr,
            qrUrl: `https://dgi-fep.mef.gob.pa/validate?cufe=${hkaResponse.cufe}`,
            hkaProtocol: hkaResponse.nroProtocoloAutorizacion,
            hkaProtocolDate: new Date(hkaResponse.fechaRecepcionDGI),
            hkaCode: '200',
            hkaStatus: 'Autorizado',
            hkaMessage: 'Documento certificado exitosamente por la DGI',

            // Respuesta completa
            hkaResponseData: {
                cufe: hkaResponse.cufe,
                qr: hkaResponse.qr,
                nroProtocoloAutorizacion: hkaResponse.nroProtocoloAutorizacion,
                fechaRecepcionDGI: hkaResponse.fechaRecepcionDGI,
                processedAt: new Date().toISOString(),
            },

            // Estado
            status: 'EMITTED',
            emittedAt: new Date(),
            hkaAttempts: { increment: 1 },
            hkaLastAttempt: new Date(),
        },
    });
}
