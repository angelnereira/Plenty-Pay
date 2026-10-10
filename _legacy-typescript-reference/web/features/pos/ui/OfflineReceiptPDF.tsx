/**
 * OfflineReceiptPDF
 *
 * PDF receipt for offline (contingency) invoices.
 * Uses ONLY built-in PDF fonts (Helvetica) — no Google Fonts fetch,
 * so it works when the device is disconnected from the internet.
 */

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

export interface OfflineReceiptProps {
    invoiceNumber: string;
    cufe: string;
    qrBase64?: string;
    businessName: string;
    businessRuc: string;
    businessDv: string;
    businessAddress: string;
    items: Array<{ id?: string; name: string; quantity: number; price: number; taxRate?: number }>;
    subtotal: number;
    tax: number;
    total: number;
    discount?: number;
    paymentMethod: string;
    issueDate: Date;
    /** Deadline for DGI transmission. Defaults to issueDate + 72 hours if omitted. */
    transmissionDeadline?: Date;
}

const s = StyleSheet.create({
    page: { padding: 15, fontFamily: 'Helvetica', fontSize: 9, width: 227 },
    bold: { fontFamily: 'Helvetica-Bold' },
    center: { textAlign: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    sep: { borderBottomWidth: 1, borderBottomColor: '#000', marginVertical: 5 },
    badge: { backgroundColor: '#000', padding: 6, marginBottom: 8 },
    badgeText: { fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'center', fontSize: 10 },
    badgeSub: { fontFamily: 'Helvetica-Bold', color: '#ccc', textAlign: 'center', fontSize: 7, marginTop: 2 },
    qrImg: { width: 80, height: 80, alignSelf: 'center', marginVertical: 6 },
    cufeText: { fontSize: 6, textAlign: 'center', color: '#333', marginTop: 2 },
    note: { fontSize: 7, textAlign: 'center', color: '#999', marginTop: 6, lineHeight: 1.4 },
    label: { color: '#666' },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#000',
    },
    totalText: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
});

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    CREDIT_CARD: 'Tarjeta de Crédito',
    DEBIT_CARD: 'Tarjeta de Débito',
    TRANSFER: 'Transferencia / Yappy',
    MIXED: 'Pago Mixto',
    OTHER: 'Otros',
};

function fmtDgiDateTime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function OfflineReceiptPDF({
    invoiceNumber,
    cufe,
    qrBase64,
    businessName,
    businessRuc,
    businessDv,
    businessAddress,
    items,
    subtotal,
    tax,
    total,
    discount,
    paymentMethod,
    issueDate,
    transmissionDeadline,
}: OfflineReceiptProps) {
    const issueDateObj = issueDate instanceof Date ? issueDate : new Date(issueDate);
    const dateStr = issueDateObj.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const deadline = transmissionDeadline ?? new Date(issueDateObj.getTime() + 72 * 60 * 60 * 1000);

    return (
        <Document>
            <Page size={[227, 841]} style={s.page}>
                {/* Header */}
                <Text style={[s.bold, s.center, { fontSize: 13, marginBottom: 2 }]}>{businessName}</Text>
                <Text style={[s.center, { marginBottom: 1 }]}>RUC: {businessRuc} DV: {businessDv}</Text>
                <Text style={[s.center, { marginBottom: 8, fontSize: 8, color: '#666' }]}>{businessAddress}</Text>

                {/* Title Badge representing CAFE compliance */}
                <View style={s.badge}>
                    <Text style={[s.badgeText, { fontSize: 8 }]}>COMPROBANTE AUXILIAR DE</Text>
                    <Text style={s.badgeText}>FACTURA ELECTRÓNICA</Text>
                    <Text style={[s.badgeText, { fontSize: 9, marginTop: 2 }]}>No. {invoiceNumber}</Text>
                    <Text style={s.badgeSub}>OPERACIÓN EN CONTINGENCIA</Text>
                </View>

                {/* Date / Receptor */}
                <View style={s.row}>
                    <Text style={s.label}>Fecha:</Text>
                    <Text>{dateStr}</Text>
                </View>
                <View style={[s.row, { marginBottom: 6 }]}>
                    <Text style={s.label}>Receptor:</Text>
                    <Text>Consumidor Final</Text>
                </View>

                <View style={s.sep} />

                {/* Items */}
                {items.map((item, i) => (
                    <View key={i} style={s.row}>
                        <Text style={{ flex: 1, fontSize: 8 }}>{item.quantity}x {item.name}</Text>
                        <Text style={{ fontSize: 8 }}>${(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                ))}

                <View style={s.sep} />

                {/* Totals */}
                <View style={s.row}>
                    <Text style={s.label}>Subtotal:</Text>
                    <Text>${subtotal.toFixed(2)}</Text>
                </View>
                {discount && discount > 0 ? (
                    <View style={s.row}>
                        <Text style={s.label}>Descuento:</Text>
                        <Text>-${discount.toFixed(2)}</Text>
                    </View>
                ) : null}
                <View style={s.row}>
                    <Text style={s.label}>ITBMS (7%):</Text>
                    <Text>${tax.toFixed(2)}</Text>
                </View>
                <View style={s.totalRow}>
                    <Text style={s.totalText}>TOTAL</Text>
                    <Text style={s.totalText}>${total.toFixed(2)}</Text>
                </View>

                {/* Payment */}
                <View style={[s.row, { marginTop: 6 }]}>
                    <Text style={s.label}>Forma de pago:</Text>
                    <Text>{PAYMENT_LABELS[paymentMethod] || paymentMethod}</Text>
                </View>

                <View style={s.sep} />

                {/* CUFE / QR */}
                {qrBase64 ? (
                    <Image src={`data:image/png;base64,${qrBase64}`} style={s.qrImg} />
                ) : null}
                <Text style={[s.bold, { fontSize: 7, textAlign: 'center', color: '#0369a1', marginBottom: 2 }]}>
                    CUFE:
                </Text>
                <Text style={s.cufeText}>FE{cufe}</Text>

                <Text style={s.note}>
                    CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta {fmtDgiDateTime(deadline)}
                </Text>
            </Page>
        </Document>
    );
}
