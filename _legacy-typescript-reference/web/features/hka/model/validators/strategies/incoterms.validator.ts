import { isValidIncoterm } from '@/lib/constants/incoterms';
import type { ValidationResult } from '../business-rules.validator';

export function validateIncoterm(value: string | undefined | null): ValidationResult {
  if (!value) {
    return { valid: false, error: 'Incoterm es obligatorio para Factura de Exportación.' };
  }
  if (!isValidIncoterm(value)) {
    return {
      valid: false,
      error: `Incoterm "${value}" no es válido según tabla 32 DGI. Valores: EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP.`,
    };
  }
  return { valid: true };
}
