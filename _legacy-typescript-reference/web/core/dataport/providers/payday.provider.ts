/**
 * Provider de Control de Personal. Datos PII (requieren permiso elevado).
 * Los campos biométricos crudos NUNCA se exportan (excludeFields).
 */

import type { DataProvider, DatasetDescriptor } from '../contract';

const datasets: DatasetDescriptor[] = [
    {
        key: 'employees',
        label: 'Empleados',
        module: 'payday',
        version: '1',
        sensitivity: 'pii',
        mutability: 'mutable',
        model: 'paydayEmployee',
        // Exclusión obligatoria de plantillas/credenciales biométricas (Ley 81/2019).
        excludeFields: ['faceDescriptor', 'fingerprintId', 'nfcTagId', 'qrSecret', 'pinCode'],
    },
    {
        key: 'payroll_runs',
        label: 'Corridas de nómina',
        module: 'payday',
        version: '1',
        sensitivity: 'pii',
        mutability: 'immutable',
        model: 'paydayPayrollRun',
    },
];

export const paydayProvider: DataProvider = {
    module: 'payday',
    datasets: () => datasets,
};
