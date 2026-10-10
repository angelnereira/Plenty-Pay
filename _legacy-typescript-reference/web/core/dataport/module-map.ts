/**
 * core/dataport/module-map.ts
 *
 * Reconciliación canónica: DataModule (DataPort) ↔ flag de habilitación en
 * `Client` ↔ módulo de permisos RBAC (`lib/constants/permissions.ts`).
 *
 * Como `MODULES` (permisos) no tiene 'credits' ni 'bi' explícitos, el control
 * fino de export/import se hace con un permiso transversal único `data`
 * (read=exportar, create=importar) MÁS el gate de módulo habilitado por tenant.
 */

import type { DataModule } from './contract';

/** Etiqueta legible por módulo. */
export const DATA_MODULE_LABELS: Record<DataModule, string> = {
    invoicing: 'Facturación',
    inventory: 'Inventario',
    pos: 'Punto de Venta',
    logistics: 'Logística y Entregas',
    payday: 'Control de Personal',
    bi: 'Reportes y BI',
    credits: 'Créditos a Clientes',
};

/** Flag booleano en el modelo `Client` que habilita cada módulo para el tenant. */
export const DATA_MODULE_CLIENT_FLAG: Record<DataModule, string> = {
    invoicing: 'facturacionEnabled',
    inventory: 'inventoryEnabled',
    pos: 'posEnabled',
    logistics: 'logisticsEnabled',
    payday: 'paydayEnabled',
    bi: 'biEnabled',
    credits: 'creditosEnabled',
};

export const ALL_DATA_MODULES = Object.keys(DATA_MODULE_LABELS) as DataModule[];

/** ¿El tenant tiene habilitado este módulo? (lee el flag del registro Client). */
export function isModuleEnabled(
    module: DataModule,
    clientFlags: Record<string, unknown>,
): boolean {
    const flag = DATA_MODULE_CLIENT_FLAG[module];
    return Boolean(clientFlags[flag]);
}
