/**
 * ItbmsTaxReportPDF.tsx
 *
 * Documento PDF formal del reporte de ITBMS a pagar, con desglose mensual.
 * Se genera server-side en /api/reports/itbms. El estilo replica el patrón de
 * features/bi/model/services/export.service.ts.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/utils";

export interface ItbmsReportRow {
    month: string; // YYYY-MM
    invoiceCount: number;
    taxableBase: number;
    itbms: number;
}

export interface ItbmsReportData {
    clientName: string;
    clientRuc?: string;
    periodLabel: string;
    generatedAt: string; // ya formateado
    rows: ItbmsReportRow[];
    totals: {
        invoiceCount: number;
        taxableBase: number;
        itbms: number;
    };
}

const MONTHS_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatMonth(yyyymm: string): string {
    const [y, m] = yyyymm.split("-");
    const idx = Number(m) - 1;
    return idx >= 0 && idx < 12 ? `${MONTHS_ES[idx]} ${y}` : yyyymm;
}

const styles = StyleSheet.create({
    page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
    title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
    company: { fontSize: 13, color: "#7c3aed", marginBottom: 2, fontWeight: 700, textTransform: "uppercase" },
    meta: { fontSize: 9, color: "#64748b", marginBottom: 2 },
    spacer: { marginBottom: 16 },
    table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4 },
    headerRow: { flexDirection: "row", backgroundColor: "#7c3aed", color: "#ffffff" },
    headerCell: { padding: 6, fontSize: 9, fontWeight: 700 },
    row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
    rowAlt: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#f8fafc" },
    cell: { padding: 6, fontSize: 9 },
    totalRow: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#7c3aed", backgroundColor: "#f5f3ff" },
    totalCell: { padding: 8, fontSize: 10, fontWeight: 700 },
    colMonth: { width: "28%", textAlign: "left" },
    colCount: { width: "18%", textAlign: "right" },
    colBase: { width: "27%", textAlign: "right" },
    colTax: { width: "27%", textAlign: "right" },
    grandBox: {
        marginTop: 18,
        padding: 12,
        backgroundColor: "#7c3aed",
        borderRadius: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    grandLabel: { color: "#ede9fe", fontSize: 11, fontWeight: 700 },
    grandValue: { color: "#ffffff", fontSize: 18, fontWeight: 700 },
    note: { marginTop: 14, fontSize: 8, color: "#94a3b8" },
    footer: { marginTop: 10, fontSize: 8, color: "#94a3b8", textAlign: "right" },
    empty: { padding: 24, textAlign: "center", color: "#64748b", fontSize: 10 },
});

export function ItbmsTaxReportPDF({ data }: { data: ItbmsReportData }) {
    const { clientName, clientRuc, periodLabel, generatedAt, rows, totals } = data;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.company}>{clientName}</Text>
                <Text style={styles.title}>Recaudación de Impuestos a Pagar (ITBMS)</Text>
                {clientRuc ? <Text style={styles.meta}>RUC {clientRuc}</Text> : null}
                <Text style={styles.meta}>Periodo: {periodLabel}</Text>
                <View style={styles.spacer} />

                <View style={styles.table}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.headerCell, styles.colMonth]}>Mes</Text>
                        <Text style={[styles.headerCell, styles.colCount]}># Facturas</Text>
                        <Text style={[styles.headerCell, styles.colBase]}>Base gravable</Text>
                        <Text style={[styles.headerCell, styles.colTax]}>ITBMS</Text>
                    </View>

                    {rows.length === 0 ? (
                        <Text style={styles.empty}>No hay facturas emitidas en el periodo seleccionado.</Text>
                    ) : (
                        rows.map((r, i) => (
                            <View key={r.month} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                                <Text style={[styles.cell, styles.colMonth]}>{formatMonth(r.month)}</Text>
                                <Text style={[styles.cell, styles.colCount]}>{r.invoiceCount}</Text>
                                <Text style={[styles.cell, styles.colBase]}>{formatCurrency(r.taxableBase)}</Text>
                                <Text style={[styles.cell, styles.colTax]}>{formatCurrency(r.itbms)}</Text>
                            </View>
                        ))
                    )}

                    {rows.length > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalCell, styles.colMonth]}>Total</Text>
                            <Text style={[styles.totalCell, styles.colCount]}>{totals.invoiceCount}</Text>
                            <Text style={[styles.totalCell, styles.colBase]}>{formatCurrency(totals.taxableBase)}</Text>
                            <Text style={[styles.totalCell, styles.colTax]}>{formatCurrency(totals.itbms)}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.grandBox}>
                    <Text style={styles.grandLabel}>RECAUDACIÓN DE IMPUESTOS A PAGAR</Text>
                    <Text style={styles.grandValue}>{formatCurrency(totals.itbms)}</Text>
                </View>

                <Text style={styles.note}>
                    Cálculo basado únicamente en facturas de venta emitidas con éxito (autorizadas por la DGI).
                    No incluye notas de crédito/débito, reembolsos, ventas internas ni documentos en error/anulados.
                    Este reporte es informativo y no sustituye la declaración oficial ante la DGI.
                </Text>
                <Text style={styles.footer}>Generado con PlentyPay · {generatedAt}</Text>
            </Page>
        </Document>
    );
}
