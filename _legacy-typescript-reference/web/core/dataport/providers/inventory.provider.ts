/**
 * Provider de Inventario Inteligente. Productos = datos maestros (importables);
 * proveedores = export por ahora.
 */

import type { DataProvider, DatasetDescriptor } from '../contract';

const datasets: DatasetDescriptor[] = [
    {
        key: 'products',
        label: 'Productos',
        module: 'inventory',
        version: '1',
        sensitivity: 'normal',
        mutability: 'mutable',
        model: 'product',
        periodField: 'createdAt',
        excludeFields: ['metadata'],
        importSpec: {
            naturalKey: ['sku'],
            uniqueWhereKey: 'clientId_sku',
            allowedFields: ['sku', 'barcode', 'name', 'brand', 'description', 'category', 'unitType', 'currentStock', 'minStock', 'purchasePrice', 'salePrice', 'taxRate', 'taxCode', 'isActive'],
            requiredFields: ['sku', 'name'],
            numericFields: ['currentStock', 'minStock', 'purchasePrice', 'salePrice', 'taxRate'],
            booleanFields: ['isActive'],
            batchSize: 200,
        },
    },
    {
        key: 'suppliers',
        label: 'Proveedores',
        module: 'inventory',
        version: '1',
        sensitivity: 'normal',
        mutability: 'mutable',
        model: 'supplier',
    },
];

export const inventoryProvider: DataProvider = {
    module: 'inventory',
    datasets: () => datasets,
};
