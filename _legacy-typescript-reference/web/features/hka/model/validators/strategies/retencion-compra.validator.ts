import type { ItemFactura } from '../../types/types';
import type { ValidationResult } from '../business-rules.validator';

export function validateRetencionCompra(items: ItemFactura[]): ValidationResult {
  const exemptItems = items.filter(item => item.tasaITBMS === '00');
  if (exemptItems.length > 0) {
    return {
      valid: false,
      error: `Compra Informal (Tipo 10): todos los ítems deben tener ITBMS aplicable. ${exemptItems.length} ítem(s) marcados como exentos.`,
    };
  }
  return { valid: true };
}
