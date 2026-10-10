import { validateRetencionCompra } from '@/features/hka/model/validators/strategies/retencion-compra.validator';
import { validateIncoterm } from '@/features/hka/model/validators/strategies/incoterms.validator';
import { validateZonaFranca } from '@/features/hka/model/validators/strategies/zona-franca.validator';
import { validateReembolso } from '@/features/hka/model/validators/strategies/reembolso.validator';
import { validateNotaCreditoPlazo } from '@/features/hka/model/validators/business-rules.validator';
import type { ItemFactura } from '@/features/hka/model/types/types';

function item(tasaITBMS: '00'|'01'|'02'|'03', extra?: Partial<ItemFactura>): ItemFactura {
  return {
    descripcion: 'Test item',
    cantidad: '1',
    precioUnitario: '10.00',
    precioUnitarioDescuento: '0',
    precioItem: '10.00',
    valorTotal: '10.70',
    tasaITBMS,
    valorITBMS: tasaITBMS === '00' ? '0.00' : '0.70',
    ...extra,
  };
}

describe('validateRetencionCompra', () => {
  it('passes when all items have ITBMS', () => {
    expect(validateRetencionCompra([item('01'), item('02')])).toMatchObject({ valid: true });
  });
  it('fails when any item is exento', () => {
    expect(validateRetencionCompra([item('01'), item('00')])).toMatchObject({ valid: false });
  });
  it('fails when all items are exento', () => {
    expect(validateRetencionCompra([item('00')])).toMatchObject({ valid: false });
  });
});

describe('validateIncoterm', () => {
  it('passes for FOB', () => expect(validateIncoterm('FOB')).toMatchObject({ valid: true }));
  it('passes for CIF', () => expect(validateIncoterm('CIF')).toMatchObject({ valid: true }));
  it('fails for invalid code', () => expect(validateIncoterm('XYZ')).toMatchObject({ valid: false }));
  it('fails for null', () => expect(validateIncoterm(null)).toMatchObject({ valid: false }));
  it('fails for empty string', () => expect(validateIncoterm('')).toMatchObject({ valid: false }));
});

describe('validateZonaFranca', () => {
  it('passes when all items are exento', () => {
    expect(validateZonaFranca([item('00'), item('00')])).toMatchObject({ valid: true });
  });
  it('fails when any item has ITBMS', () => {
    expect(validateZonaFranca([item('00'), item('01')])).toMatchObject({ valid: false });
  });
});

describe('validateReembolso', () => {
  it('passes when description contains [RUC:', () => {
    expect(validateReembolso([item('01', { descripcion: '[RUC: 8-111-2222] Servicio' })])).toMatchObject({ valid: true });
  });
  it('passes when items have infoItem', () => {
    expect(validateReembolso([item('01', { infoItem: 'RUC 8-111-2222 | Doc 001' })])).toMatchObject({ valid: true });
  });
  it('fails when no tercero info', () => {
    expect(validateReembolso([item('01')])).toMatchObject({ valid: false });
  });
});

describe('validateNotaCreditoPlazo (hardened to blocker)', () => {
  it('returns valid=false for dates >180 days ago', () => {
    const old = new Date();
    old.setDate(old.getDate() - 181);
    const result = validateNotaCreditoPlazo(old.toISOString());
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.warning).toBeUndefined();
  });
  it('passes for recent dates', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 30);
    expect(validateNotaCreditoPlazo(recent.toISOString())).toMatchObject({ valid: true });
  });
});
