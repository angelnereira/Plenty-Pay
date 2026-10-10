// Tests de regresión para garantizar que facturaInternaMapper
// produce el mismo output que el mapper original.

import { facturaInternaMapper } from '@/lib/mappers/strategies/factura-interna.mapper';
import { mapManualInvoiceToHKARequest } from '@/lib/mappers/manual-invoice-to-hka';

// Fixture de datos mínimos válidos para Contribuyente (tipoClienteFE=01)
function makeContribuyenteData() {
  return {
    documentType: 'FACTURA' as const,
    client: {
      tipoClienteFE: '01',
      tipoContribuyente: '2',
      numeroRUC: '8-123-456',
      digitoVerificadorRUC: '5',
      razonSocial: 'Empresa Test S.A.',
      direccion: 'Calle 50, Ciudad de Panamá',
      codigoUbicacion: '8-8-1',
      provincia: 'Panamá',
      distrito: 'Panamá',
      corregimiento: 'San Felipe',
    },
    items: [{
      id: '1',
      descripcion: 'Servicio de consultoría',
      cantidad: 1,
      precioUnitario: 100,
      precioUnitarioDescuento: 100,
      tasaITBMS: '01',
      valorITBMS: 7,
      precioItem: 100,
      valorTotal: 107,
    }],
    payment: {
      formaPagoFact: '02',
      descFormaPago: '',
      tiempoPago: '1',
      informacionInteres: '',
    },
  };
}

function makeConfig() {
  return {
    hka: {
      codigoSucursalEmisor: '0000',
      tipoSucursal: '1' as const,
      puntoFacturacionFiscal: '001',
    },
    billing: {
      tipoEmision: '01' as const,
      destinoOperacion: '1' as const,
      formatoCAFE: '1' as const,
      entregaCAFE: '1' as const,
    },
  } as any;
}

describe('facturaInternaMapper', () => {
  it('emite tipoDocumento 01', () => {
    const doc = facturaInternaMapper.build(makeContribuyenteData(), makeConfig());
    expect(doc.datosTransaccion.tipoDocumento).toBe('01');
  });

  it('tiene naturalezaOperacion 01 (Venta)', () => {
    const doc = facturaInternaMapper.build(makeContribuyenteData(), makeConfig());
    expect(doc.datosTransaccion.naturalezaOperacion).toBe('01');
  });

  it('mapea RUC con DV padStart 2 para Contribuyente', () => {
    const data = makeContribuyenteData();
    data.client.digitoVerificadorRUC = '5';
    const doc = facturaInternaMapper.build(data, makeConfig());
    const cliente = doc.datosTransaccion.cliente as any;
    expect(cliente.digitoVerificadorRUC).toBe('05');
  });

  it('lanza error si razonSocial < 2 chars para Contribuyente', () => {
    const data = makeContribuyenteData();
    data.client.razonSocial = 'X';
    expect(() => facturaInternaMapper.build(data, makeConfig())).toThrow('Razón Social');
  });

  it('produce el mismo resultado que mapManualInvoiceToHKARequest con FACTURA', () => {
    const data = makeContribuyenteData();
    const config = makeConfig();
    const fromStrategy = facturaInternaMapper.build(data, config);
    const fromOrchestrator = mapManualInvoiceToHKARequest({ ...data, documentType: 'FACTURA' }, config);
    // Los tipoDocumento deben ser iguales
    expect(fromStrategy.datosTransaccion.tipoDocumento).toBe(fromOrchestrator.datosTransaccion.tipoDocumento);
    // Los items deben tener el mismo largo
    expect(fromStrategy.listaItems.length).toBe(fromOrchestrator.listaItems.length);
    // Los totales deben ser iguales
    expect(fromStrategy.totalesSubTotales.totalFactura).toBe(fromOrchestrator.totalesSubTotales.totalFactura);
  });

  it('orquestador con documentType=undefined defaultea a FACTURA (tipo 01)', () => {
    const data = { ...makeContribuyenteData(), documentType: undefined };
    const doc = mapManualInvoiceToHKARequest(data, makeConfig());
    expect(doc.datosTransaccion.tipoDocumento).toBe('01');
  });
});
