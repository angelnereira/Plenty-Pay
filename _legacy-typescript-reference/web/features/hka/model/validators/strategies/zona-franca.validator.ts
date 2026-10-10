import type { ItemFactura } from '../../types/types';
import type { ValidationResult } from '../business-rules.validator';

export function validateZonaFranca(items: ItemFactura[]): ValidationResult {
  const nonExempt = items.filter(item => item.tasaITBMS !== '00');
  if (nonExempt.length > 0) {
    return {
      valid: false,
      error: `Zona Franca (Tipo 08): todos los ítems deben ser exentos (tasaITBMS=00). ${nonExempt.length} ítem(s) tienen ITBMS.`,
    };
  }
  return { valid: true };
}
