/**
 * core/dataport/registry.ts
 *
 * Registro ESTÁTICO y explícito de providers (no auto-registro por side-effect,
 * que en serverless puede no cargarse). Añadir un módulo = importar y añadir su
 * provider aquí.
 */

import type { DataProvider, DatasetDescriptor, DataModule } from './contract';
import { ALL_DATA_MODULES, DATA_MODULE_LABELS, isModuleEnabled } from './module-map';

import { invoicingProvider } from './providers/invoicing.provider';
import { inventoryProvider } from './providers/inventory.provider';
import { posProvider } from './providers/pos.provider';
import { logisticsProvider } from './providers/logistics.provider';
import { paydayProvider } from './providers/payday.provider';
import { biProvider } from './providers/bi.provider';
import { creditsProvider } from './providers/credits.provider';

export const PROVIDERS: DataProvider[] = [
    invoicingProvider,
    inventoryProvider,
    posProvider,
    logisticsProvider,
    paydayProvider,
    biProvider,
    creditsProvider,
];

/** Todos los descriptores indexados por key (validando unicidad). */
const DATASET_INDEX = new Map<string, DatasetDescriptor>();
for (const p of PROVIDERS) {
    for (const d of p.datasets()) {
        if (DATASET_INDEX.has(d.key)) {
            throw new Error(`DataPort: dataset key duplicada '${d.key}'`);
        }
        DATASET_INDEX.set(d.key, d);
    }
}

export function getDataset(key: string): DatasetDescriptor | undefined {
    return DATASET_INDEX.get(key);
}

export function allDatasets(): DatasetDescriptor[] {
    return Array.from(DATASET_INDEX.values());
}

export function datasetsForModule(module: DataModule): DatasetDescriptor[] {
    return allDatasets().filter((d) => d.module === module);
}

/** Módulos habilitados para el tenant (según flags del registro Client). */
export function enabledModules(clientFlags: Record<string, unknown>): DataModule[] {
    return ALL_DATA_MODULES.filter((m) => isModuleEnabled(m, clientFlags));
}

/**
 * Orden topológico por `dependsOn` (prerequisitos primero). Determinista:
 * conserva el orden de entrada en empates.
 */
export function topoSort(datasets: DatasetDescriptor[]): DatasetDescriptor[] {
    const present = new Set(datasets.map((d) => d.key));
    const byKey = new Map(datasets.map((d) => [d.key, d]));
    const visited = new Set<string>();
    const out: DatasetDescriptor[] = [];

    const visit = (d: DatasetDescriptor, stack: Set<string>) => {
        if (visited.has(d.key)) return;
        if (stack.has(d.key)) return; // ciclo: corta (no debería ocurrir)
        stack.add(d.key);
        for (const dep of d.dependsOn ?? []) {
            if (present.has(dep)) visit(byKey.get(dep)!, stack);
        }
        stack.delete(d.key);
        visited.add(d.key);
        out.push(d);
    };

    for (const d of datasets) visit(d, new Set());
    return out;
}

export interface ModuleCapability {
    module: DataModule;
    label: string;
    enabled: boolean;
    datasets: Array<{
        key: string;
        label: string;
        sensitivity: string;
        mutability: string;
        importable: boolean;
    }>;
}

/** Catálogo de capacidades por tenant (alimenta la UI). */
export function capabilities(clientFlags: Record<string, unknown>): ModuleCapability[] {
    return ALL_DATA_MODULES.map((module) => ({
        module,
        label: DATA_MODULE_LABELS[module],
        enabled: isModuleEnabled(module, clientFlags),
        datasets: datasetsForModule(module).map((d) => ({
            key: d.key,
            label: d.label,
            sensitivity: d.sensitivity,
            mutability: d.mutability,
            importable: Boolean(d.importSpec),
        })),
    }));
}
