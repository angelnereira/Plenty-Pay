/**
 * Provider de Punto de Venta. Las sesiones de caja son registro operativo
 * (export-only). Las ventas fiscales viven como facturas (módulo Facturación).
 */

import type { DataProvider, DatasetDescriptor } from '../contract';

const datasets: DatasetDescriptor[] = [
    {
        key: 'pos_sessions',
        label: 'Sesiones de caja',
        module: 'pos',
        version: '1',
        sensitivity: 'normal',
        mutability: 'immutable',
        model: 'posSession',
    },
    {
        key: 'pos_offline_transactions',
        label: 'Transacciones offline',
        module: 'pos',
        version: '1',
        sensitivity: 'normal',
        mutability: 'immutable',
        model: 'pOSOfflineTransaction',
        excludeFields: ['payload', 'rawPayload'],
    },
];

export const posProvider: DataProvider = {
    module: 'pos',
    datasets: () => datasets,
};
