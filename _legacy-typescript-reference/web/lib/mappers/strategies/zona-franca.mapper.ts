import type { DocumentoElectronico, DatosTransaccion } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { formatDateISO8601, cleanXMLObject } from '@/features/hka/model/services/utils';
import type { DocumentMapperStrategy } from './types';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';
import { buildCliente, buildItems, buildTotales } from './_shared';

export const zonaFrancaMapper: DocumentMapperStrategy = {
  tipoDocumentoHKA: '08',
  build(data: ManualInvoiceData, config: InvoiceConfig): DocumentoElectronico {
    const tipoClienteFE = data.client.tipoClienteFE;
    const [cliente, notasCliente] = buildCliente(data.client, tipoClienteFE);
    // Zona Franca: todos los items llevan tasaITBMS='00' (exentos de ITBMS)
    const items = buildItems(data.items, tipoClienteFE, { forceITBMSZero: true });
    const totalesSubTotales = buildTotales(items, data.payment);

    const datosTransaccion: DatosTransaccion = {
      tipoEmision: (config.billing.tipoEmision || '01') as DatosTransaccion['tipoEmision'],
      tipoDocumento: '08',           // Factura de Zona Franca
      numeroDocumentoFiscal: '0000000000',
      puntoFacturacionFiscal: config.hka.puntoFacturacionFiscal || '001',
      fechaEmision: formatDateISO8601(new Date()),
      naturalezaOperacion: '01',     // Venta
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

    const documento: DocumentoElectronico = {
      codigoSucursalEmisor: config.hka.codigoSucursalEmisor || '0000',
      tipoSucursal: (config.hka.tipoSucursal || '1') as DocumentoElectronico['tipoSucursal'],
      datosTransaccion,
      listaItems: items,
      totalesSubTotales,
    };

    return cleanXMLObject(documento as unknown as Record<string, unknown>) as unknown as DocumentoElectronico;
  },
};
