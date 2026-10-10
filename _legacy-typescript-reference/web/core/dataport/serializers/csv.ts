/**
 * core/dataport/serializers/csv.ts — serialización CSV (RFC 4180).
 * Texto plano por entidad: el formato más portable para soberanía de datos.
 */

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

function escapeCsv(value: Cell): string {
    if (value === null) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** Une las claves de todas las filas para una cabecera estable y completa. */
export function deriveColumns(rows: Row[]): string[] {
    const seen = new Set<string>();
    const cols: string[] = [];
    for (const row of rows) {
        for (const k of Object.keys(row)) {
            if (!seen.has(k)) {
                seen.add(k);
                cols.push(k);
            }
        }
    }
    return cols;
}

export function toCsv(rows: Row[], columns?: string[]): Buffer {
    const cols = columns ?? deriveColumns(rows);
    const lines: string[] = [];
    lines.push(cols.map(escapeCsv).join(','));
    for (const row of rows) {
        lines.push(cols.map((c) => escapeCsv(row[c] ?? null)).join(','));
    }
    // BOM para que Excel reconozca UTF-8.
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}
