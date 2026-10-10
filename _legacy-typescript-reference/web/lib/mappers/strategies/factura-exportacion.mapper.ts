import type { DocumentoElectronico, DatosTransaccion, GrupoExportacion } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { formatDateISO8601, cleanXMLObject } from '@/features/hka/model/services/utils';
import type { DocumentMapperStrategy } from './types';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';
import { buildCliente, buildItems, buildTotales } from './_shared';

export const facturaExportacionMapper: DocumentMapperStrategy = {
  tipoDocumentoHKA: '03',
  build(data: ManualInvoiceData, config: InvoiceConfig): DocumentoElectronico {
    const tipoClienteFE = data.client.tipoClienteFE;
    const [cliente, notasCliente] = buildCliente(data.client, tipoClienteFE);
    // Exportación: todos los items llevan tasaITBMS='00' (exentos de ITBMS)
    const items = buildItems(data.items, tipoClienteFE, { forceITBMSZero: true });
    const totalesSubTotales = buildTotales(items, data.payment);

    const datosTransaccion: DatosTransaccion = {
      tipoEmision: (config.billing.tipoEmision || '01') as DatosTransaccion['tipoEmision'],
      tipoDocumento: '03',           // Exportación
      numeroDocumentoFiscal: '0000000000',
      puntoFacturacionFiscal: config.hka.puntoFacturacionFiscal || '001',
      fechaEmision: formatDateISO8601(new Date()),
      naturalezaOperacion: '01',
      tipoOperacion: '1',            // Salida
      // Exportación DEBE tener destinoOperacion='2' (Extranjero) según regla B14a DGI
      destinoOperacion: '2',
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

    // Construir grupoExportacion si hay exportData
    // Campos según GrupoExportacion: cCondEntr (obligatorio), cMoneda, cMonedaDesc, dCambio, dVTotEst, dPuertoEmbarq
    let grupoExportacion: GrupoExportacion | undefined;
    if (data.exportData) {
      grupoExportacion = {
        cCondEntr: data.exportData.incoterm || 'FOB',
        ...(data.exportData.currency ? { cMoneda: data.exportData.currency } : {}),
        ...(data.exportData.currencyDesc ? { cMonedaDesc: data.exportData.currencyDesc } : {}),
        ...(data.exportData.exchangeRate ? { dCambio: data.exportData.exchangeRate } : {}),
        ...(data.exportData.foreignAmount ? { dVTotEst: data.exportData.foreignAmount } : {}),
        ...(data.exportData.port ? { dPuertoEmbarq: data.exportData.port } : {}),
      };
    }

    const documento: DocumentoElectronico = {
      codigoSucursalEmisor: config.hka.codigoSucursalEmisor || '0000',
      tipoSucursal: (config.hka.tipoSucursal || '1') as DocumentoElectronico['tipoSucursal'],
      datosTransaccion,
      ...(grupoExportacion ? { grupoExportacion } : {}),
      listaItems: items,
      totalesSubTotales,
    };

    return cleanXMLObject(documento as unknown as Record<string, unknown>) as unknown as DocumentoElectronico;
  },
};
