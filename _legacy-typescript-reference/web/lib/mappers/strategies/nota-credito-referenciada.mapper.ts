import type { DocumentoElectronico, DatosTransaccion, DocumentoFiscalReferenciado } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { formatDateISO8601, cleanXMLObject } from '@/features/hka/model/services/utils';
import type { DocumentMapperStrategy } from './types';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';
import { buildCliente, buildItems, buildTotales } from './_shared';

/** Días máximos permitidos por DGI para emitir NC referenciada */
const MAX_DAYS_NC = 180;

export const notaCreditoReferenciadaMapper: DocumentMapperStrategy = {
  tipoDocumentoHKA: '04',
  build(data: ManualInvoiceData, config: InvoiceConfig): DocumentoElectronico {
    // VALIDACIÓN BLOQUEANTE: NC fuera de plazo
    if (data.referenceData) {
      const diasDesdeEmision = Math.floor(
        (Date.now() - new Date(data.referenceData.fechaEmision).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeEmision > MAX_DAYS_NC) {
        throw new Error(
          `NC fuera de plazo: la factura original supera los ${MAX_DAYS_NC} días permitidos por DGI (${diasDesdeEmision} días desde emisión)`
        );
      }
    }

    const tipoClienteFE = data.client.tipoClienteFE;
    const [cliente, notasCliente] = buildCliente(data.client, tipoClienteFE);
    const items = buildItems(data.items, tipoClienteFE);
    const totalesSubTotales = buildTotales(items, data.payment);

    const datosTransaccion: DatosTransaccion = {
      tipoEmision: (config.billing.tipoEmision || '01') as DatosTransaccion['tipoEmision'],
      tipoDocumento: '04',           // Nota de Crédito referenciada a FE
      numeroDocumentoFiscal: '0000000000',
      puntoFacturacionFiscal: config.hka.puntoFacturacionFiscal || '001',
      fechaEmision: formatDateISO8601(new Date()),
      naturalezaOperacion: '01',
      tipoOperacion: '1',            // Salida
      destinoOperacion: (config.billing.destinoOperacion || '1') as DatosTransaccion['destinoOperacion'],
      formatoCAFE: (config.billing.formatoCAFE || '1') as DatosTransaccion['formatoCAFE'],
      entregaCAFE: (config.billing.entregaCAFE || '1') as DatosTransaccion['entregaCAFE'],
      envioContenedor: '1',
      procesoGeneracion: '1',
      tipoVenta: '1',
      informacionInteres: notasCliente
        ? (data.payment.informacionInteres ? `${data.payment.informacionInteres} | ${notasCliente}` : notasCliente)
        : (data.payment.informacionInteres || ''),
      cliente,
    };

    // Construir lista de documentos fiscales referenciados
    // Campo exacto del tipo DocumentoFiscalReferenciado: fechaEmisionDocFiscalReferenciado, cufeFEReferenciada
    let listaDocsFiscalReferenciados: DocumentoFiscalReferenciado[] | undefined;
    if (data.referenceData) {
      const docRef: DocumentoFiscalReferenciado = {
        fechaEmisionDocFiscalReferenciado: data.referenceData.fechaEmision,
        cufeFEReferenciada: data.referenceData.cufe,
        // nroFacturaPapel si hay numeroDocumento (workaround: no hay campo nroDocFiscalReferenciado en el tipo)
        ...(data.referenceData.numeroDocumento ? { nroFacturaPapel: data.referenceData.numeroDocumento } : {}),
      };
      listaDocsFiscalReferenciados = [docRef];
    }

    const documento: DocumentoElectronico = {
      codigoSucursalEmisor: config.hka.codigoSucursalEmisor || '0000',
      tipoSucursal: (config.hka.tipoSucursal || '1') as DocumentoElectronico['tipoSucursal'],
      datosTransaccion,
      ...(listaDocsFiscalReferenciados ? { listaDocsFiscalReferenciados } : {}),
      listaItems: items,
      totalesSubTotales,
    };

    return cleanXMLObject(documento as unknown as Record<string, unknown>) as unknown as DocumentoElectronico;
  },
};
