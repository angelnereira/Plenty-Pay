import { invoiceToCAFEEscposInput } from '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper';

const baseItem = {
  description: 'Producto A',
  quantity: 2,
  unitPrice: 5.00,
  total: 10.00,
  taxAmount: 0.70,
  unit: 'UND',
};

const baseInvoice = {
  id: 'inv-1',
  invoiceNumber: '0000000001',
  documentType: '01',
  issueDate: new Date('2026-04-10T14:00:00'),
  currency: 'PAB',
  issuerName: 'EMPRESA S.A.',
  issuerRuc: '123456-1-123456',
  issuerDv: '28',
  issuerAddress: 'Calle 50, Panamá',
  receiverName: 'JUAN PÉREZ',
  receiverRuc: '8-123-456',
  receiverDv: '7',
  subtotal: 10.00,
  itbms: 0.70,
  discount: 0,
  total: 10.70,
  paymentMethod: 'CASH',
  qrUrl: 'https://efact.mef.gob.pa/receiverfe/servlet/qr?cufe=abc',
  cufeLocal: 'A'.repeat(64),
  codigoSucursal: '0001',
  puntoFacturacion: '001',
  numeroDocumentoFiscal: '0000000001',
  items: [baseItem],
  hkaProtocol: null,
  hkaProtocolDate: null,
  fechaLimitePosterior: null,
};

describe('invoiceToCAFEEscposInput', () => {
  const opts = { paperWidth: 80 as const };

  it('sets mode SINCRONO when hkaProtocol is present', () => {
    const inv = {
      ...baseInvoice,
      hkaProtocol: 'PROT-001',
      hkaProtocolDate: new Date('2026-04-10T14:01:00'),
    };
    const result = invoiceToCAFEEscposInput(inv, opts);
    expect(result.modo).toBe('SINCRONO');
    expect(result.hkaProtocol).toBe('PROT-001');
  });

  it('sets mode ASINCRONO when fechaLimitePosterior is set and no hkaProtocol', () => {
    const inv = {
      ...baseInvoice,
      fechaLimitePosterior: new Date('2026-04-11T17:00:00'),
    };
    const result = invoiceToCAFEEscposInput(inv, opts);
    expect(result.modo).toBe('ASINCRONO');
    expect(result.fechaLimiteTransmision).toEqual(new Date('2026-04-11T17:00:00'));
  });

  it('sets mode CONTINGENCIA when neither hkaProtocol nor fechaLimitePosterior', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice, opts);
    expect(result.modo).toBe('CONTINGENCIA');
    expect(result.fechaLimiteTransmision).toBeDefined();
  });

  it('maps item fields including unit', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice, opts);
    expect(result.items[0]).toMatchObject({
      descripcion: 'Producto A',
      cantidad: 2,
      unidad: 'UND',
      precioUnitario: 5.00,
      itbms: 0.70,
      total: 10.00,
    });
  });

  it('defaults unit to "UND" when item.unit is null', () => {
    const inv = {
      ...baseInvoice,
      items: [{ ...baseItem, unit: null }],
    };
    const result = invoiceToCAFEEscposInput(inv, opts);
    expect(result.items[0].unidad).toBe('UND');
  });

  it('sets paperWidth from options', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice, { paperWidth: 58 });
    expect(result.paperWidth).toBe(58);
  });

  it('CONTINGENCIA fechaLimiteTransmision is ~72h after issueDate', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice, opts);
    const diffHours =
      (result.fechaLimiteTransmision!.getTime() - baseInvoice.issueDate.getTime()) /
      (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(72, 0);
  });
});
