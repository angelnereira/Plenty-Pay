import {
  roundDGI,
  formatMontoDGI,
  roundToTwo,
} from '@/features/hka/model/services/utils';

describe('roundDGI — regla oficial DGI Panamá (half-up sobre tercer decimal)', () => {
  describe('tercer decimal < 5 → mantiene segundo decimal', () => {
    it.each([
      [1.004, 1.0],
      [2.554, 2.55],
      [99.991, 99.99],
      [0.001, 0.0],
      [123.454, 123.45],
    ])('roundDGI(%s) === %s', (input, expected) => {
      expect(roundDGI(input)).toBe(expected);
    });
  });

  describe('tercer decimal >= 5 → incrementa segundo decimal', () => {
    it.each([
      [1.005, 1.01],
      [2.555, 2.56],
      [2.555, 2.56],
      [0.005, 0.01],
      [99.995, 100.0],
      [123.456, 123.46],
      [7.8549, 7.85],
    ])('roundDGI(%s) acepta >=5 en el 3er decimal (%s → %s)', (input, expected) => {
      expect(roundDGI(input)).toBe(expected);
    });
  });

  describe('casos límite de punto flotante IEEE 754', () => {
    it('0.1 + 0.2 redondea a 0.30 sin arrastre binario', () => {
      expect(roundDGI(0.1 + 0.2)).toBe(0.3);
    });

    it('1.005 redondea a 1.01 pese a la representación binaria truncada', () => {
      expect(roundDGI(1.005)).toBe(1.01);
    });

    it('valores negativos respetan la misma regla half-up (Math.round)', () => {
      expect(roundDGI(-1.004)).toBe(-1.0);
      expect(roundDGI(-1.006)).toBe(-1.01);
    });

    it('cero retorna 0', () => {
      expect(roundDGI(0)).toBe(0);
    });

    it('no rompe con NaN ni Infinity', () => {
      expect(Number.isNaN(roundDGI(NaN))).toBe(true);
      expect(roundDGI(Infinity)).toBe(Infinity);
    });
  });

  it('roundToTwo mantiene el mismo comportamiento que roundDGI (alias deprecado)', () => {
    const samples = [1.005, 2.554, 0.1 + 0.2, 99.995, -1.006];
    for (const s of samples) {
      expect(roundToTwo(s)).toBe(roundDGI(s));
    }
  });
});

describe('formatMontoDGI — serialización a string para XML HKA', () => {
  it('siempre produce 2 decimales por defecto', () => {
    expect(formatMontoDGI(1)).toBe('1.00');
    expect(formatMontoDGI(1.005)).toBe('1.01');
    expect(formatMontoDGI(0)).toBe('0.00');
  });

  it('usa punto como separador decimal (nunca coma)', () => {
    const result = formatMontoDGI(1234.56);
    expect(result).toContain('.');
    expect(result).not.toContain(',');
  });

  it('soporta 6 decimales para precios unitarios', () => {
    expect(formatMontoDGI(15.5, 6)).toBe('15.500000');
  });

  it('aplica redondeo DGI antes de formatear', () => {
    expect(formatMontoDGI(2.555)).toBe('2.56');
    expect(formatMontoDGI(2.554)).toBe('2.55');
  });
});
