/**
 * Provider de Créditos a Clientes (Motor de Entidades + Ledger).
 * El ledger es append-only/inmutable → export-only. Las entidades son maestros.
 */

import type { DataProvider, DatasetDescriptor } from '../contract';

const datasets: DatasetDescriptor[] = [
    {
        key: 'credit_entities',
        label: 'Entidades de crédito',
        module: 'credits',
        version: '1',
        sensitivity: 'pii',
        mutability: 'mutable',
        model: 'motorEntity',
        excludeFields: ['customFields', 'metadata'],
    },
    {
        key: 'credit_ledger',
        label: 'Movimientos de crédito (ledger)',
        module: 'credits',
        version: '1',
        sensitivity: 'fiscal',
        mutability: 'immutable',
        model: 'motorLedgerEntry',
        periodField: 'createdAt',
        dependsOn: ['credit_entities'],
    },
];

export const creditsProvider: DataProvider = {
    module: 'credits',
    datasets: () => datasets,
};
