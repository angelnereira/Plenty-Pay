/**
 * core/dataport/serializers/xlsx.ts — Excel con cabecera estilizada.
 * Reutiliza ExcelJS (misma librería del servicio BI) para consistencia visual.
 */

import ExcelJS from 'exceljs';
import { deriveColumns } from './csv';

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export async function toXlsx(sheetName: string, rows: Row[], columns?: string[]): Promise<Buffer> {
    const cols = columns ?? deriveColumns(rows);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PlentyPay · DataPort';
    wb.created = new Date();
    // Nombre de hoja válido (Excel: máx 31 chars, sin []:*?/\)
    const safeName = (sheetName || 'datos').replace(/[\[\]:*?/\\]/g, '_').slice(0, 31);
    const ws = wb.addWorksheet(safeName);

    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

    for (const row of rows) {
        const record: Record<string, Cell> = {};
        for (const c of cols) record[c] = row[c] ?? null;
        ws.addRow(record);
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
