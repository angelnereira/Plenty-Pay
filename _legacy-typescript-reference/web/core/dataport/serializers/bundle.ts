/**
 * core/dataport/serializers/bundle.ts — empaquetado ZIP (multi-dataset).
 * Usado para exportar un módulo completo o todo el tenant.
 */

import archiver from 'archiver';

export interface ZipEntry {
    name: string;
    buffer: Buffer;
}

export function toZip(entries: ZipEntry[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        archive.on('data', (c: Buffer) => chunks.push(c));
        archive.on('warning', () => { /* archivos faltantes: no aplica aquí */ });
        archive.on('error', reject);
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        for (const e of entries) archive.append(e.buffer, { name: e.name });
        void archive.finalize();
    });
}
