/**
 * Provider de Logística y Entregas. Órdenes de entrega = registro operativo
 * (export-only).
 */

import type { DataProvider, DatasetDescriptor } from '../contract';

const datasets: DatasetDescriptor[] = [
    {
        key: 'delivery_orders',
        label: 'Órdenes de entrega',
        module: 'logistics',
        version: '1',
        sensitivity: 'normal',
        mutability: 'mutable',
        model: 'deliveryOrder',
    },
];

export const logisticsProvider: DataProvider = {
    module: 'logistics',
    datasets: () => datasets,
};
