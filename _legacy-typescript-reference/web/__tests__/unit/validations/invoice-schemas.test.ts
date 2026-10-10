import {
  selectInvoiceSchema,
  facturaInternaSchema,
  facturaExportacionSchema,
  notaCreditoReferenciadaSchema,
  INVOICE_SCHEMAS,
} from '@/lib/validations/invoice-schemas';

function makeBaseData(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      tipoClienteFE: '01',
      tipoContribuyente: '2',
      numeroRUC: '8-123-456',
      digitoVerificadorRUC: '5',
      razonSocial: 'Test S.A.',
      direccion: 'Calle 50, Panamá',
      codigoUbicacion: '8-8-1',
      provincia: 'Panamá',
      distrito: 'Panamá',
      corregimiento: 'San Felipe',
    },
    items: [
      {
        id: '1',
        descripcion: 'Servicio',
        code: undefined,
        cantidad: 1,
        precioUnitario: 100,
        precioUnitarioDescuento: 100,
        tasaITBMS: '01',
        valorITBMS: 7,
        precioItem: 100,
        valorTotal: 107,
      },
    ],
    payment: {
      formaPagoFact: '02',
      descFormaPago: '',
      tiempoPago: '1',
      informacionInteres: '',
    },
    ...overrides,
  };
}

describe('Schema Factura Interna', () => {
  it('valida datos correctos', () => {
    const result = facturaInternaSchema.safeParse({
      documentType: 'FACTURA',
      ...makeBaseData(),
    });
    expect(result.success).toBe(true);
  });

  it('rechaza si RUC vacío para Contribuyente', () => {
    const data = {
      documentType: 'FACTURA',
      ...makeBaseData({
        client: { ...makeBaseData().client, numeroRUC: '' },
      }),
    };
    const result = facturaInternaSchema.safeParse(data);
    expect(result.success).toBe(false);
    const errors = (result as any).error.issues.map((i: any) =>
      i.path.join('.')
    );
    expect(errors).toContain('client.numeroRUC');
  });

  it('rechaza si forma de pago 99 sin descripción', () => {
    const data = {
      documentType: 'FACTURA',
      ...makeBaseData({
        payment: {
          formaPagoFact: '99',
          descFormaPago: '',
          tiempoPago: '1',
          informacionInteres: '',
        },
      }),
    };
    const result = facturaInternaSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('acepta forma de pago 99 con descripción', () => {
    const data = {
      documentType: 'FACTURA',
      ...makeBaseData({
        payment: {
          formaPagoFact: '99',
          descFormaPago: 'Criptomoneda',
          tiempoPago: '1',
          informacionInteres: '',
        },
      }),
    };
    const result = facturaInternaSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rechaza CPBS vacío para cliente Gobierno', () => {
    const data = {
      documentType: 'FACTURA',
      ...makeBaseData({
        client: { ...makeBaseData().client, tipoClienteFE: '03' },
      }),
    };
    const result = facturaInternaSchema.safeParse(data);
    expect(result.success).toBe(false);
    const errors = (result as any).error.issues.map((i: any) =>
      i.path.join('.')
    );
    expect(errors.some((p: string) => p.includes('cpbsCode'))).toBe(true);
  });
});

describe('Schema Exportación', () => {
  it('valida datos correctos con incoterm válido y items exentos', () => {
    const data = {
      documentType: 'FACTURA_EXPORTACION',
      exportData: { incoterm: 'FOB' },
      ...makeBaseData({
        items: [
          { ...makeBaseData().items[0], tasaITBMS: '00', valorITBMS: 0 },
        ],
      }),
    };
    const result = facturaExportacionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rechaza incoterm inválido', () => {
    const data = {
      documentType: 'FACTURA_EXPORTACION',
      exportData: { incoterm: 'INVALIDO' },
      ...makeBaseData(),
    };
    const result = facturaExportacionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rechaza si algún item no es exento (tasaITBMS != 00)', () => {
    const data = {
      documentType: 'FACTURA_EXPORTACION',
      exportData: { incoterm: 'FOB' },
      ...makeBaseData(), // items con tasaITBMS='01'
    };
    const result = facturaExportacionSchema.safeParse(data);
    expect(result.success).toBe(false);
    const errors = (result as any).error.issues.map((i: any) => i.message);
    expect(errors.some((e: string) => e.includes('exento'))).toBe(true);
  });
});

describe('Schema NC Referenciada - plazo 180 días', () => {
  it('valida NC dentro de 180 días', () => {
    const data = {
      documentType: 'NOTA_CREDITO',
      noteSubtype: 'REFERENCED',
      referenceData: {
        cufe: 'A'.repeat(66),
        fechaEmision: new Date().toISOString(),
      },
      ...makeBaseData(),
    };
    const result = notaCreditoReferenciadaSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rechaza NC con factura original > 180 días', () => {
    const fechaVieja = new Date(
      Date.now() - 200 * 24 * 60 * 60 * 1000
    ).toISOString();
    const data = {
      documentType: 'NOTA_CREDITO',
      noteSubtype: 'REFERENCED',
      referenceData: { cufe: 'A'.repeat(66), fechaEmision: fechaVieja },
      ...makeBaseData(),
    };
    const result = notaCreditoReferenciadaSchema.safeParse(data);
    expect(result.success).toBe(false);
    const errors = (result as any).error.issues.map((i: any) => i.message);
    expect(errors.some((e: string) => e.includes('180'))).toBe(true);
  });

  it('rechaza CUFE de menos de 64 caracteres', () => {
    const data = {
      documentType: 'NOTA_CREDITO',
      noteSubtype: 'REFERENCED',
      referenceData: {
        cufe: 'SHORT',
        fechaEmision: new Date().toISOString(),
      },
      ...makeBaseData(),
    };
    const result = notaCreditoReferenciadaSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('selectInvoiceSchema', () => {
  it('selecciona facturaInternaSchema para FACTURA', () => {
    expect(selectInvoiceSchema('FACTURA')).toBe(INVOICE_SCHEMAS.FACTURA);
  });

  it('selecciona NC Referenciada para NOTA_CREDITO + REFERENCED', () => {
    const schema = selectInvoiceSchema('NOTA_CREDITO', 'REFERENCED');
    const result = schema.safeParse({
      documentType: 'NOTA_CREDITO',
      noteSubtype: 'REFERENCED',
      referenceData: {
        cufe: 'A'.repeat(66),
        fechaEmision: new Date().toISOString(),
      },
      ...makeBaseData(),
    });
    expect(result.success).toBe(true);
  });

  it('selecciona NC Genérica para NOTA_CREDITO + GENERIC', () => {
    const schema = selectInvoiceSchema('NOTA_CREDITO', 'GENERIC');
    const result = schema.safeParse({
      documentType: 'NOTA_CREDITO',
      noteSubtype: 'GENERIC',
      ...makeBaseData(),
    });
    expect(result.success).toBe(true);
  });

  it('selecciona NC Genérica por defecto para NOTA_CREDITO sin noteSubtype', () => {
    const schema = selectInvoiceSchema('NOTA_CREDITO');
    // Without noteSubtype it returns generic schema (requires noteSubtype: 'GENERIC')
    expect(schema).toBe(INVOICE_SCHEMAS.NOTA_CREDITO_GENERIC);
  });

  it('retorna facturaInternaSchema como fallback para tipo desconocido', () => {
    const schema = selectInvoiceSchema('TIPO_DESCONOCIDO');
    expect(schema).toBe(facturaInternaSchema);
  });
});
