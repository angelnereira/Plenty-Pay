/**
 * Mapper: Manual Invoice Data → HKA DocumentoElectronico
 *
 * Orquestador: delega en la strategy correcta según documentType/noteSubtype.
 */

import type { DocumentoElectronico } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { selectMapperStrategy } from './strategies';

/**
 * Datos del formulario manual.
 *
 * `documentType` y `exportData` los recoge el formulario aunque el mapper
 * actual solo necesite client/items/payment para construir el documento
 * HKA base — quedan disponibles para extensiones futuras (export DGI,
 * variantes Importación/Exportación) sin cambiar la firma de
 * `emitFromDraft`.
 */
export interface ManualInvoiceData {
    documentType?:
        | 'FACTURA'
        | 'FACTURA_IMPORTACION'
        | 'FACTURA_EXPORTACION'
        | 'NOTA_CREDITO'
        | 'NOTA_DEBITO'
        | 'FACTURA_ZONA_FRANCA'
        | 'REEMBOLSO'
        | 'FACTURA_EXTRANJERA';
    noteSubtype?: 'REFERENCED' | 'GENERIC';
    exportData?: {
        incoterm: string;
        currency?: string;
        currencyDesc?: string;
        exchangeRate?: string;
        foreignAmount?: string;
        port?: string;
    };

    /** Datos para NC/ND Referenciada (tipos 04/05) */
    referenceData?: {
        cufe: string;              // CUFE de la factura original (66 chars HKA)
        fechaEmision: string;      // ISO date de la factura original
        numeroDocumento?: string;  // Número de documento fiscal original
    };

    /** Datos adicionales para Importación (tipo 02) */
    importData?: {
        paisOrigen?: string;       // Código ISO país (ej: 'US', 'CN'). Default: 'US'
    };

    /** Datos para Factura de Compra informal (tipo 10) */
    compraData?: {
        cedulaProveedor: string;   // Cédula del proveedor informal
        nombreProveedor: string;   // Nombre del proveedor
    };

    client: {
        tipoClienteFE: string;
        tipoContribuyente: string;
        numeroRUC: string;
        digitoVerificadorRUC: string;
        razonSocial: string;
        direccion: string;
        codigoUbicacion: string;
        provincia: string;
        distrito: string;
        corregimiento: string;
        telefono1?: string;
        correoElectronico1?: string;
    };
    items: Array<{
        id: string;
        descripcion: string;
        /** SKU or product code for inventory matching */
        code?: string;
        cantidad: number;
        precioUnitario: number;
        /** Precio unitario neto (después de descuento) */
        precioUnitarioDescuento: number;
        tasaITBMS: string;
        valorITBMS: number;
        precioItem: number;
        valorTotal: number;
        /** ID del producto en inventario (si fue seleccionado desde búsqueda).
         *  Se propaga como `_productId` en el documento HKA (campo no-fiscal)
         *  para que invoice-storage.service.ts lo persista en InvoiceItem. */
        productId?: string;
        /** Código CPBS de 4 dígitos (obligatorio para gobierno) */
        cpbsCode?: string;
        /** Unidad de medida CPBS (obligatorio para gobierno) */
        cpbsUnit?: string;
        /** Solo para tipo 09 (Reembolso): RUC del tercero del gasto */
        rucTercero?: string;
        /** Solo para tipo 09 (Reembolso): número de factura del tercero */
        numeroDocumentoTercero?: string;
    }>;
    payment: {
        formaPagoFact: string;
        descFormaPago: string;
        tiempoPago: string;
        informacionInteres: string;
    };
}

/**
 * Convierte datos del formulario manual a DocumentoElectronico HKA.
 * Delega en la strategy correcta según documentType y noteSubtype.
 */
export function mapManualInvoiceToHKARequest(
    data: ManualInvoiceData,
    config: InvoiceConfig
): DocumentoElectronico {
    const mode = data.documentType ?? 'FACTURA';
    const strategy = selectMapperStrategy(mode, data.noteSubtype);
    return strategy.build(data, config);
}
