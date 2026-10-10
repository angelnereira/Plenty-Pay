import { describe, it, expect } from '@jest/globals';
import { INCOTERMS_DGI, isValidIncoterm } from '@/lib/constants/incoterms';

describe('Incoterms DGI (tabla 32)', () => {
  it('tiene 11 incoterms', () => {
    expect(Object.keys(INCOTERMS_DGI)).toHaveLength(11);
  });

  it('acepta FOB como incoterm válido', () => {
    expect(isValidIncoterm('FOB')).toBe(true);
  });

  it('acepta todos los 11 códigos', () => {
    const codes = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
    codes.forEach((c) => expect(isValidIncoterm(c)).toBe(true));
  });

  it('rechaza códigos inválidos', () => {
    expect(isValidIncoterm('XYZ')).toBe(false);
    expect(isValidIncoterm('')).toBe(false);
    expect(isValidIncoterm('fob')).toBe(false); // case-sensitive
  });

  it('tiene descripciones para todos los incoterms', () => {
    Object.entries(INCOTERMS_DGI).forEach(([code, description]) => {
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });
  });

  it('cada código es una clave válida en el objeto', () => {
    const codes = Object.keys(INCOTERMS_DGI);
    codes.forEach((code) => {
      expect(isValidIncoterm(code)).toBe(true);
    });
  });
});
