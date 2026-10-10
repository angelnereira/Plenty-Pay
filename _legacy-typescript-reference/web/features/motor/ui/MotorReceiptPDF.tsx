/**
 * Plantilla PDF de comprobante para movimientos del ledger del Motor.
 * Identifica como mínimo (requerido por brief):
 *   - Transacción (id corto, tipo de movimiento)
 *   - Entidad
 *   - Monto
 *   - Fecha
 *   - Balance resultante post-movimiento
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MotorMovementType } from "@prisma/client";

export interface MotorReceiptData {
    entry: {
        id: string;
        movementType: MotorMovementType;
        sign: "POSITIVE" | "NEGATIVE";
        amountFormatted: string; // ya formateado en centavos → string
        runningBalanceFormatted: string;
        currency: string;
        reference: string | null;
        description: string | null;
        createdAt: string; // ISO
    };
    entity: {
        displayName: string;
        kind: "PERSON" | "COMPANY";
        documentNumber: string | null;
    };
    issuer: {
        name: string;
        ruc: string | null;
        address: string | null;
        email: string | null;
    };
}

const MOVEMENT_LABEL: Record<MotorMovementType, string> = {
    CHARGE: "CARGO",
    PAYMENT: "ABONO",
    ADJUSTMENT_CREDIT: "AJUSTE A FAVOR",
    ADJUSTMENT_DEBIT: "AJUSTE EN CONTRA",
    LOYALTY_GRANT: "OTORGAMIENTO DE LEALTAD",
    LOYALTY_REDEEM: "REDENCIÓN DE LEALTAD",
};

const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
    header: { borderBottom: "1 solid #999", paddingBottom: 8, marginBottom: 16 },
    issuerName: { fontSize: 14, fontWeight: "bold" },
    title: { fontSize: 16, marginTop: 12, marginBottom: 12, fontWeight: "bold" },
    section: { marginBottom: 12 },
    rowSpread: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    label: { color: "#555", fontSize: 9 },
    value: { fontSize: 10 },
    big: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
    box: { border: "1 solid #ddd", padding: 10, marginTop: 8 },
    footer: { marginTop: 24, borderTop: "1 solid #999", paddingTop: 8, fontSize: 8, color: "#555" },
    badgeNeg: { color: "#b00020", fontWeight: "bold" },
    badgePos: { color: "#0a7d2c", fontWeight: "bold" },
});

export function MotorReceiptPDF({ data }: { data: MotorReceiptData }) {
    const { entry, entity, issuer } = data;
    const isPositive = entry.sign === "POSITIVE";
    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.issuerName}>{issuer.name}</Text>
                    {issuer.ruc && <Text style={styles.label}>RUC: {issuer.ruc}</Text>}
                    {issuer.address && <Text style={styles.label}>{issuer.address}</Text>}
                    {issuer.email && <Text style={styles.label}>{issuer.email}</Text>}
                </View>

                <Text style={styles.title}>COMPROBANTE — {MOVEMENT_LABEL[entry.movementType]}</Text>

                <View style={styles.section}>
                    <View style={styles.rowSpread}>
                        <Text style={styles.label}>Comprobante #</Text>
                        <Text style={styles.value}>{entry.id}</Text>
                    </View>
                    <View style={styles.rowSpread}>
                        <Text style={styles.label}>Fecha</Text>
                        <Text style={styles.value}>
                            {new Date(entry.createdAt).toLocaleString("es-PA", {
                                timeZone: "America/Panama",
                            })}
                        </Text>
                    </View>
                    {entry.reference && (
                        <View style={styles.rowSpread}>
                            <Text style={styles.label}>Referencia</Text>
                            <Text style={styles.value}>{entry.reference}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.box}>
                    <Text style={styles.label}>
                        {entity.kind === "COMPANY" ? "RAZÓN SOCIAL" : "NOMBRE"}
                    </Text>
                    <Text style={styles.value}>{entity.displayName}</Text>
                    {entity.documentNumber && (
                        <>
                            <Text style={[styles.label, { marginTop: 4 }]}>DOCUMENTO</Text>
                            <Text style={styles.value}>{entity.documentNumber}</Text>
                        </>
                    )}
                </View>

                <View style={[styles.box, { marginTop: 12 }]}>
                    <Text style={styles.label}>MONTO</Text>
                    <Text style={[styles.big, isPositive ? styles.badgePos : styles.badgeNeg]}>
                        {isPositive ? "+" : "−"} {entry.currency} {entry.amountFormatted}
                    </Text>
                    {entry.description && (
                        <>
                            <Text style={[styles.label, { marginTop: 8 }]}>DETALLE</Text>
                            <Text style={styles.value}>{entry.description}</Text>
                        </>
                    )}
                </View>

                <View style={[styles.box, { marginTop: 12 }]}>
                    <Text style={styles.label}>BALANCE POST-MOVIMIENTO</Text>
                    <Text style={styles.big}>
                        {entry.currency} {entry.runningBalanceFormatted}
                    </Text>
                </View>

                <Text style={styles.footer}>
                    Documento informativo generado por PlentyPay — Motor de Entidades & Ledger.
                    No constituye factura fiscal. ID: {entry.id}
                </Text>
            </Page>
        </Document>
    );
}
