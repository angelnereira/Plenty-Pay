/**
 * core/dataport/resolve.ts
 *
 * Resuelve la lista de datasets a exportar a partir del scope del request y
 * los autoriza contra el acceso del tenant/actor.
 *  - scope 'dataset'/'module': exige autorización explícita (lanza error claro).
 *  - scope 'tenant': filtra silenciosamente a lo que el actor puede ver
 *    (módulos habilitados + sensibilidad permitida).
 */

import type { DatasetDescriptor, DataModule, ExportScope } from './contract';
import { getDataset, datasetsForModule, enabledModules } from './registry';
import { assertDatasetExportable, type ResolvedAccess } from './access';

export interface ExportSelection {
    scope: ExportScope;
    modules?: string[];
    datasets?: string[];
}

export function resolveExportDatasets(
    access: ResolvedAccess,
    sel: ExportSelection,
): { datasets: DatasetDescriptor[]; modules: DataModule[] } {
    let datasets: DatasetDescriptor[] = [];

    if (sel.scope === 'tenant') {
        for (const m of enabledModules(access.clientFlags)) {
            for (const d of datasetsForModule(m)) {
                // Filtra silenciosamente lo no permitido por sensibilidad.
                if ((d.sensitivity === 'pii' || d.sensitivity === 'fiscal') && !access.ctx.elevated) continue;
                datasets.push(d);
            }
        }
    } else if (sel.scope === 'module') {
        for (const m of sel.modules ?? []) {
            for (const d of datasetsForModule(m as DataModule)) {
                assertDatasetExportable(d, access);
                datasets.push(d);
            }
        }
    } else {
        for (const k of sel.datasets ?? []) {
            const d = getDataset(k);
            if (!d) throw new Error(`Dataset desconocido: '${k}'`);
            assertDatasetExportable(d, access);
            datasets.push(d);
        }
    }

    if (datasets.length === 0) throw new Error('No hay datasets exportables para la selección/permiso actual');

    const modules = Array.from(new Set(datasets.map((d) => d.module)));
    return { datasets, modules };
}
