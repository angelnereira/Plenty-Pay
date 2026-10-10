import {
  reconcileTotals,
  assertTotalsWithinTolerance,
  FiscalReconciliationError,
  DGI_TOLERANCE,
} from '@/features/hka/model/services/fiscal-reconciler';

describe('reconcileTotals — bloque D02-D09 desde ítems', () => {
  it('factura simple 1 ítem sin descuento ni ISC cuadra exacto', () => {
    const totals = reconcileTotals({
      items: [{ precioItem: 100.0, valorITBMS: 7.0 }],
    });
    expect(totals.totalPrecioNeto).toBe(100.0);
    expect(totals.totalITBMS).toBe(7.0);
    expect(totals.totalISC).toBe(0);
    expect(totals.totalMontoGravado).toBe(7.0);
    expect(totals.totalFactura).toBe(107.0);
  });

  it('D09 aplica la fórmula oficial: D05 + D02 + D07 + D08 − D06', () => {
    const totals = reconcileTotals({
      items: [{ precioItem: 200.0, valorITBMS: 14.0 }],
      acarreo: 5.0,
      seguro: 2.5,
      descuentoGlobal: 10.0,
    });
    // D02=200, D03=14, D04=0, D05=14, D07=5, D08=2.50, D06=10
    // D09 = 14 + 200 + 5 + 2.50 − 10 = 211.50
    expect(totals.totalFactura).toBe(211.5);
  });

  it('ISC pass-through se suma a D04 y se incluye en D05', () => {
    const totals = reconcileTotals({
      items: [
        { precioItem: 100.0, valorITBMS: 7.0, valorISC: 5.0 },
        { precioItem: 50.0, valorITBMS: 3.5, valorISC: 2.5 },
      ],
    });
    expect(totals.totalISC).toBe(7.5);
    expect(totals.totalMontoGravado).toBe(7.0 + 3.5 + 7.5);
    expect(totals.totalFactura).toBe(
      totals.totalMontoGravado + totals.totalPrecioNeto,
    );
  });

  it('tasas ITBMS mixtas (0%, 7%, 10%, 15%) suman D03 correctamente', () => {
    const totals = reconcileTotals({
      items: [
        { precioItem: 100.0, valorITBMS: 0 },     // 0%
        { precioItem: 100.0, valorITBMS: 7.0 },   // 7%
        { precioItem: 100.0, valorITBMS: 10.0 },  // 10%
        { precioItem: 100.0, valorITBMS: 15.0 },  // 15%
      ],
    });
    expect(totals.totalPrecioNeto).toBe(400.0);
    expect(totals.totalITBMS).toBe(32.0);
  });

  it('sumatoria de 50 ítems a 0.333 no acumula drift más allá de 1 centavo', () => {
    const items = Array.from({ length: 50 }, () => ({
      precioItem: 0.33,
      valorITBMS: 0.02,
    }));
    const totals = reconcileTotals({ items });
    expect(totals.totalPrecioNeto).toBeCloseTo(16.5, 2);
    expect(totals.totalITBMS).toBeCloseTo(1.0, 2);
  });

  it('declaredTotalFactura con desvío 0.49 pasa sin error (bajo tolerancia)', () => {
    expect(() =>
      reconcileTotals({
        items: [{ precioItem: 100.0, valorITBMS: 7.0 }],
        declaredTotalFactura: 107.0 - 0.49,
      }),
    ).not.toThrow();
  });

  it('declaredTotalFactura con desvío >= 0.50 lanza error DGI 2507', () => {
    expect(() =>
      reconcileTotals({
        items: [{ precioItem: 100.0, valorITBMS: 7.0 }],
        declaredTotalFactura: 107.0 - 0.5,
      }),
    ).toThrow(FiscalReconciliationError);

    try {
      reconcileTotals({
        items: [{ precioItem: 100.0, valorITBMS: 7.0 }],
        declaredTotalFactura: 108.0,
      });
      fail('Debía lanzar FiscalReconciliationError');
    } catch (err) {
      expect(err).toBeInstanceOf(FiscalReconciliationError);
      const e = err as FiscalReconciliationError;
      expect(e.dgiCode).toBe('2507');
      expect(e.field).toBe('totalFactura');
      expect(e.expected).toBe(107.0);
      expect(e.actual).toBe(108.0);
      expect(e.delta).toBeCloseTo(1.0, 2);
    }
  });

  it('redondea al tercer decimal cada sumatoria independiente', () => {
    const totals = reconcileTotals({
      items: [
        { precioItem: 1.005, valorITBMS: 0.007 },
        { precioItem: 1.005, valorITBMS: 0.007 },
      ],
    });
    expect(totals.totalPrecioNeto).toBe(2.01);
    expect(totals.totalITBMS).toBe(0.01);
  });

  it('descuento global se resta al final y D09 refleja el neto', () => {
    const totals = reconcileTotals({
      items: [{ precioItem: 1000.0, valorITBMS: 70.0 }],
      descuentoGlobal: 100.0,
    });
    // D09 = 70 + 1000 + 0 + 0 − 100 = 970
    expect(totals.totalFactura).toBe(970.0);
  });

  it('incluye totalOTI en D05 pero no en D02 ni D09 fuera de la fórmula', () => {
    const totals = reconcileTotals({
      items: [{ precioItem: 100.0, valorITBMS: 7.0 }],
      totalOTI: 3.0,
    });
    expect(totals.totalMontoGravado).toBe(10.0); // 7 + 0 + 3
    expect(totals.totalFactura).toBe(110.0);     // 10 + 100
  });
});

describe('assertTotalsWithinTolerance — validación de totales externos', () => {
  const computed = {
    totalPrecioNeto: 100.0,
    totalITBMS: 7.0,
    totalISC: 0,
    totalMontoGravado: 7.0,
    totalFactura: 107.0,
  };

  it('acepta totales idénticos', () => {
    expect(() => assertTotalsWithinTolerance(computed, computed)).not.toThrow();
  });

  it('acepta desvío menor a 0.50 en cualquier campo', () => {
    expect(() =>
      assertTotalsWithinTolerance({ ...computed, totalITBMS: 7.49 }, computed),
    ).not.toThrow();
  });

  it.each<[string, Partial<typeof computed>, string]>([
    ['2500', { totalPrecioNeto: 101.0 }, 'totalPrecioNeto'],
    ['2501', { totalITBMS: 8.0 }, 'totalITBMS'],
    ['2502', { totalISC: 1.0 }, 'totalISC'],
    ['2503', { totalMontoGravado: 8.5 }, 'totalMontoGravado'],
    ['2507', { totalFactura: 108.0 }, 'totalFactura'],
  ])('lanza código DGI %s cuando %s supera tolerancia', (code, override, field) => {
    try {
      assertTotalsWithinTolerance({ ...computed, ...override }, computed);
      fail('Debía lanzar FiscalReconciliationError');
    } catch (err) {
      expect(err).toBeInstanceOf(FiscalReconciliationError);
      const e = err as FiscalReconciliationError;
      expect(e.dgiCode).toBe(code);
      expect(e.field).toBe(field);
    }
  });

  it('ignora campos no provistos', () => {
    expect(() =>
      assertTotalsWithinTolerance({ totalITBMS: 7.0 }, computed),
    ).not.toThrow();
  });
});

describe('constante DGI_TOLERANCE', () => {
  it('coincide con la regla oficial de 0.50 Balboas', () => {
    expect(DGI_TOLERANCE).toBe(0.5);
  });
});
