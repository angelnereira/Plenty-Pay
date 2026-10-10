/**
 * Motor de reconciliación fiscal DGI Panamá.
 *
 * Recalcula los totales del bloque D (D02-D09) a partir de los ítems ya mapeados
 * y valida que cualquier total declarado externamente caiga dentro de la tolerancia
 * oficial de B/. 0.50 antes de enviar el XML a HKA.
 *
 * Si algún campo supera la tolerancia, lanza FiscalReconciliationError mapeando
 * el desvío al código DGI correspondiente (2500-2507) para evitar el rechazo.
 */

import { roundDGI } from './utils';

/** Tolerancia oficial DGI Panamá para sumatorias del bloque D. */
export const DGI_TOLERANCE = 0.5;

export type DGIErrorCode = '2500' | '2501' | '2502' | '2503' | '2507';

const DGI_ERROR_DESCRIPTIONS: Record<DGIErrorCode, string> = {
  '2500': 'totalPrecioNeto (D02) difiere de Σ precioItem (C203)',
  '2501': 'totalITBMS (D03) difiere de Σ valorITBMS (C402)',
  '2502': 'totalISC (D04) difiere de Σ valorISC (C502)',
  '2503': 'totalMontoGravado (D05) difiere de D03 + D04 + totalOTI',
  '2507': 'totalFactura (D09) difiere de D05 + D02 + D07 + D08 − D06',
};

export class FiscalReconciliationError extends Error {
  constructor(
    public readonly dgiCode: DGIErrorCode,
    public readonly field: string,
    public readonly expected: number,
    public readonly actual: number,
  ) {
    const delta = Math.abs(expected - actual);
    super(
      `DGI ${dgiCode}: ${DGI_ERROR_DESCRIPTIONS[dgiCode]} | ` +
        `esperado ${expected.toFixed(2)}, recibido ${actual.toFixed(2)}, ` +
        `diferencia B/. ${delta.toFixed(2)} (tolerancia ${DGI_TOLERANCE.toFixed(2)})`,
    );
    this.name = 'FiscalReconciliationError';
  }

  get delta(): number {
    return Math.abs(this.expected - this.actual);
  }
}

export interface ReconcilerItem {
  precioItem: number;
  valorITBMS: number;
  valorISC?: number;
}

export interface ReconcilerInput {
  items: ReconcilerItem[];
  totalOTI?: number;
  acarreo?: number;
  seguro?: number;
  descuentoGlobal?: number;
  declaredTotalFactura?: number;
}

export interface ReconciledTotals {
  totalPrecioNeto: number;
  totalITBMS: number;
  totalISC: number;
  totalMontoGravado: number;
  totalFactura: number;
}

export function reconcileTotals(input: ReconcilerInput): ReconciledTotals {
  let sumPrecio = 0;
  let sumITBMS = 0;
  let sumISC = 0;

  for (const item of input.items) {
    sumPrecio += item.precioItem;
    sumITBMS += item.valorITBMS;
    sumISC += item.valorISC ?? 0;
  }

  const totalPrecioNeto = roundDGI(sumPrecio);
  const totalITBMS = roundDGI(sumITBMS);
  const totalISC = roundDGI(sumISC);
  const totalOTI = roundDGI(input.totalOTI ?? 0);
  const totalMontoGravado = roundDGI(totalITBMS + totalISC + totalOTI);

  const acarreo = roundDGI(input.acarreo ?? 0);
  const seguro = roundDGI(input.seguro ?? 0);
  const descuento = roundDGI(input.descuentoGlobal ?? 0);
  const totalFactura = roundDGI(
    totalMontoGravado + totalPrecioNeto + acarreo + seguro - descuento,
  );

  if (input.declaredTotalFactura !== undefined) {
    const delta = Math.abs(input.declaredTotalFactura - totalFactura);
    if (delta >= DGI_TOLERANCE) {
      throw new FiscalReconciliationError(
        '2507',
        'totalFactura',
        totalFactura,
        input.declaredTotalFactura,
      );
    }
  }

  return {
    totalPrecioNeto,
    totalITBMS,
    totalISC,
    totalMontoGravado,
    totalFactura,
  };
}

export function assertTotalsWithinTolerance(
  provided: Partial<ReconciledTotals>,
  computed: ReconciledTotals,
): void {
  const checks: Array<{ key: keyof ReconciledTotals; code: DGIErrorCode }> = [
    { key: 'totalPrecioNeto', code: '2500' },
    { key: 'totalITBMS', code: '2501' },
    { key: 'totalISC', code: '2502' },
    { key: 'totalMontoGravado', code: '2503' },
    { key: 'totalFactura', code: '2507' },
  ];

  for (const { key, code } of checks) {
    const supplied = provided[key];
    if (supplied === undefined) continue;
    const delta = Math.abs(supplied - computed[key]);
    if (delta >= DGI_TOLERANCE) {
      throw new FiscalReconciliationError(code, key, computed[key], supplied);
    }
  }
}
