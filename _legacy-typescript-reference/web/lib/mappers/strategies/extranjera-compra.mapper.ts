import type { DocumentoElectronico, DatosTransaccion, Cliente } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { formatDateISO8601, cleanXMLObject } from '@/features/hka/model/services/utils';
import type { DocumentMapperStrategy } from './types';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';
import { buildCliente, buildItems, buildTotales } from './_shared';

export const extranjeraCompraMapper: DocumentMapperStrategy = {
  tipoDocumentoHKA: '10',
  build(data: ManualInvoiceData, config: InvoiceConfig): DocumentoElectronico {
    // Para tipo 10 (Factura de Compra informal), el "cliente" en HKA es el proveedor informal.
    // Si compraData existe, construimos un cliente CF con los datos del proveedor.
    // Si no, usamos el cliente normal del formulario.
    let cliente: Cliente;
    let notasCliente = '';

    if (data.compraData) {
      // El proveedor informal se mapea como Consumidor Final (tipoClienteFE=02)
      // con su cédula y nombre del compraData
      const clienteProveedor: Record<string, string | undefined> = {
        tipoClienteFE: '02',
        pais: 'PA',
        tipoContribuyente: '1',  // Persona Natural
        numeroRUC: data.compraData.cedulaProveedor,
        digitoVerificadorRUC: '00',
        razonSocial: data.compraData.nombreProveedor,
      };
      cliente = clienteProveedor as unknown as Cliente;
      notasCliente = `Proveedor: ${data.compraData.nombreProveedor} | Cédula: ${data.compraData.cedulaProveedor}`;
    } else {
      const tipoClienteFE = data.client.tipoClienteFE;
      [cliente, notasCliente] = buildCliente(data.client, tipoClienteFE);
    }

    const tipoClienteFE = data.compraData ? '02' : data.client.tipoClienteFE;
    const items = buildItems(data.items, tipoClienteFE);
    const totalesSubTotales = buildTotales(items, data.payment);

    const datosTransaccion: DatosTransaccion = {
      tipoEmision: (config.billing.tipoEmision || '01') as DatosTransaccion['tipoEmision'],
      tipoDocumento: '10',           // Factura de operación extranjera / Compra informal
      numeroDocumentoFiscal: '0000000000',
      puntoFacturacionFiscal: config.hka.puntoFacturacionFiscal || '001',
      fechaEmision: formatDateISO8601(new Date()),
      naturalezaOperacion: '01',
      tipoOperacion: '2',            // Entrada (compra)
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
