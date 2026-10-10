import type { ItemFactura } from '../../types/types';
import type { ValidationResult } from '../business-rules.validator';

export function validateReembolso(items: ItemFactura[]): ValidationResult {
  const invalid = items.filter(item => {
    const hasRuc = item.descripcion.includes('[RUC:');
    const hasInfo = item.infoItem && item.infoItem.trim().length > 0;
    return !hasRuc && !hasInfo;
  });
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Reembolso (Tipo 09): ${invalid.length} ítem(s) sin identificación del tercero (RUC + N° factura obligatorios).`,
    };
  }
  return { valid: true };
}
