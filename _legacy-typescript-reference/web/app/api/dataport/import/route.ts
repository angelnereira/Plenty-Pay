/**
 * POST /api/dataport/import  (multipart/form-data)
 *
 * Campos: file (CSV/JSON), dataset (key), mode ('dry-run' | 'commit').
 * El dry-run devuelve un preview sin escribir; el commit aplica por lotes
 * idempotentes (upsert por clave natural).
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveAccess, isAccessError, assertDatasetImportable } from '@core/dataport/access';
import { getDataset } from '@core/dataport/registry';
import { runImport, exportImportShaAndSize } from '@core/dataport/import.service';
import { recordImport } from '@core/dataport/evidence';
import type { ImportMode } from '@core/dataport/contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const access = await resolveAccess();
    if (isAccessError(access)) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canImport) {
        return NextResponse.json({ error: 'No tienes permiso para importar datos' }, { status: 403 });
    }

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
    }

    const datasetKey = String(form.get('dataset') ?? '');
    const mode = (String(form.get('mode') ?? 'dry-run') as ImportMode);
    const file = form.get('file');

    const d = getDataset(datasetKey);
    if (!d) return NextResponse.json({ error: `Dataset desconocido: '${datasetKey}'` }, { status: 400 });

    try {
        assertDatasetImportable(d, access);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'No importable' }, { status: 403 });
    }

    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }
    const filename = (file as File).name ?? 'import';
    const format: 'csv' | 'json' = filename.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    const content = await file.text();

    let result;
    try {
        result = await runImport({ ctx: access.ctx, dataset: d, format, content, mode });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al importar' }, { status: 400 });
    }

    if (mode === 'commit') {
        const { sha256, byteSize } = exportImportShaAndSize(content);
        await recordImport({
            ctx: access.ctx,
            dataset: d.key,
            module: d.module,
            format,
            sha256,
            byteSize,
            importBatchId: result.importBatchId,
            rowCounts: { [d.key]: result.inserted + result.updated },
            message: `insertadas=${result.inserted} actualizadas=${result.updated} inválidas=${result.invalidRows}`,
        });
    }

    return NextResponse.json({ success: true, mode, result });
}
