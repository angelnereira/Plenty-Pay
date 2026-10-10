/**
 * ExportService — convierte un BIQueryResult en un archivo descargable.
 *
 * Soporta dos formatos:
 *   - "xlsx" via ExcelJS — una hoja con header y filas formateadas.
 *   - "pdf"  via @react-pdf/renderer — página A4 horizontal con tabla.
 *
 * El servicio recibe la query ya ejecutada (rows + meta) más metadatos
 * de presentación (título, columnas, formatters). NO ejecuta SQL — eso
 * es responsabilidad del caller (endpoint /api/bi/export).
 */

import ExcelJS from "exceljs"
import ReactPDF from "@react-pdf/renderer"
import { Document, Page, Text, View, StyleSheet, type DocumentProps } from "@react-pdf/renderer"
import React from "react"

export type ExportFormat = "xlsx" | "pdf"

export interface ExportColumn {
    header: string
    /** key en la fila o función custom */
    accessor: string | ((row: Record<string, unknown>) => string | number)
    align?: "left" | "right" | "center"
}

export interface ExportRequest {
    title: string
    /** Subtítulo opcional (ej. "Mes en curso · 2026-05-01 → 2026-05-10") */
    subtitle?: string
    columns: ExportColumn[]
    rows: Array<Record<string, unknown>>
    /** Nombre base del archivo, sin extensión. */
    filename: string
}

export interface ExportResult {
    buffer: Buffer
    filename: string
    contentType: string
}

// ============================================
// Excel
// ============================================

export async function exportToExcel(req: ExportRequest): Promise<ExportResult> {
    const wb = new ExcelJS.Workbook()
    wb.creator = "PlentyPay BI"
    wb.created = new Date()

    const ws = wb.addWorksheet(req.title.slice(0, 31)) // 31 = límite Excel

    // Title row
    ws.mergeCells(1, 1, 1, req.columns.length)
    ws.getCell(1, 1).value = req.title
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1E1B4B" } }
    ws.getCell(1, 1).alignment = { horizontal: "left", vertical: "middle" }

    if (req.subtitle) {
        ws.mergeCells(2, 1, 2, req.columns.length)
        ws.getCell(2, 1).value = req.subtitle
        ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF64748B" } }
    }

    const headerRowIdx = req.subtitle ? 4 : 3
    const headerRow = ws.getRow(headerRowIdx)
    req.columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = col.header
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } }
        cell.alignment = { horizontal: col.align ?? "left", vertical: "middle" }
    })
    headerRow.commit()

    req.rows.forEach((row, ri) => {
        const r = ws.getRow(headerRowIdx + 1 + ri)
        req.columns.forEach((col, ci) => {
            const cell = r.getCell(ci + 1)
            cell.value = resolveAccessor(col.accessor, row) as ExcelJS.CellValue
            cell.alignment = { horizontal: col.align ?? "left" }
        })
    })

    // Auto width (heurística simple — el header como mínimo)
    ws.columns.forEach((col, i) => {
        const header = req.columns[i]?.header ?? ""
        let max = header.length
        ws.eachRow((row) => {
            const v = row.getCell(i + 1).value
            const len = v == null ? 0 : String(v).length
            if (len > max) max = len
        })
        col.width = Math.min(48, Math.max(10, max + 2))
    })

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
    return {
        buffer,
        filename: `${req.filename}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
}

// ============================================
// PDF
// ============================================

const pdfStyles = StyleSheet.create({
    page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
    title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
    subtitle: { fontSize: 10, color: "#64748b", marginBottom: 16 },
    table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4 },
    headerRow: { flexDirection: "row", backgroundColor: "#7c3aed", color: "#ffffff" },
    headerCell: { padding: 6, fontSize: 9, fontWeight: 700 },
    row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
    rowAlt: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    cell: { padding: 6, fontSize: 9 },
    footer: { marginTop: 16, fontSize: 8, color: "#94a3b8", textAlign: "right" },
})

function buildPdfDocument(req: ExportRequest): React.ReactElement<DocumentProps> {
    const colWidth = `${(100 / req.columns.length).toFixed(2)}%`

    return React.createElement<DocumentProps>(
        Document,
        {},
        React.createElement(
            Page,
            { size: "A4", orientation: "landscape", style: pdfStyles.page },
            React.createElement(Text, { style: pdfStyles.title }, req.title),
            req.subtitle
                ? React.createElement(Text, { style: pdfStyles.subtitle }, req.subtitle)
                : null,
            React.createElement(
                View,
                { style: pdfStyles.table },
                // header
                React.createElement(
                    View,
                    { style: pdfStyles.headerRow },
                    ...req.columns.map((col, i) =>
                        React.createElement(
                            Text,
                            {
                                key: `h-${i}`,
                                style: [pdfStyles.headerCell, { width: colWidth, textAlign: col.align ?? "left" }],
                            },
                            col.header,
                        ),
                    ),
                ),
                // rows
                ...req.rows.map((row, ri) =>
                    React.createElement(
                        View,
                        { key: `r-${ri}`, style: ri % 2 === 0 ? pdfStyles.row : pdfStyles.rowAlt },
                        ...req.columns.map((col, ci) =>
                            React.createElement(
                                Text,
                                {
                                    key: `c-${ri}-${ci}`,
                                    style: [pdfStyles.cell, { width: colWidth, textAlign: col.align ?? "left" }],
                                },
                                String(resolveAccessor(col.accessor, row) ?? ""),
                            ),
                        ),
                    ),
                ),
            ),
            React.createElement(
                Text,
                { style: pdfStyles.footer },
                `Generado por PlentyPay BI · ${new Date().toLocaleString("es-PA")}`,
            ),
        ),
    )
}

export async function exportToPdf(req: ExportRequest): Promise<ExportResult> {
    const doc = buildPdfDocument(req)
    const stream = await ReactPDF.renderToStream(doc)
    const chunks: Buffer[] = []
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
        chunks.push(chunk)
    }
    return {
        buffer: Buffer.concat(chunks),
        filename: `${req.filename}.pdf`,
        contentType: "application/pdf",
    }
}

export async function exportTo(format: ExportFormat, req: ExportRequest): Promise<ExportResult> {
    return format === "xlsx" ? exportToExcel(req) : exportToPdf(req)
}

// ============================================
// Helpers
// ============================================

function resolveAccessor(
    accessor: string | ((row: Record<string, unknown>) => string | number),
    row: Record<string, unknown>,
): string | number {
    if (typeof accessor === "function") return accessor(row)
    const raw = row[accessor]
    if (raw == null) return ""
    if (typeof raw === "number") return raw
    return String(raw)
}
