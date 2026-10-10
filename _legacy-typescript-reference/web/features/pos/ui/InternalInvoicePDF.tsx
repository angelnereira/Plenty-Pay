/**
 * Internal Invoice PDF Template
 * Generates PDF documents for internal sales following Panama fiscal standards
 * This is a NON-FISCAL document for internal record keeping
 */

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font
} from '@react-pdf/renderer';
import { formatPanama } from '@/lib/date-utils';

// Register fonts (using system fonts)
Font.register({
    family: 'Inter',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 700 },
    ]
});

// Styles for the PDF
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 30,
        fontFamily: 'Inter',
        fontSize: 10,
    },
    // Header
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#7c3aed',
        paddingBottom: 15,
    },
    businessName: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    businessInfo: {
        fontSize: 9,
        textAlign: 'center',
        color: '#666666',
        marginTop: 2,
    },
    // Document Title
    documentTitle: {
        backgroundColor: '#f3f4f6',
        padding: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    documentTitleText: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    documentNumber: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 3,
    },
    // Info Section
    infoSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#fafafa',
    },
    infoColumn: {
        width: '48%',
    },
    infoLabel: {
        fontSize: 8,
        color: '#666666',
        fontWeight: 'bold',
    },
    infoValue: {
        fontSize: 10,
        marginTop: 2,
        marginBottom: 6,
    },
    // Items Table
    table: {
        marginBottom: 15,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#7c3aed',
        padding: 8,
        color: '#FFFFFF',
    },
    tableHeaderCell: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        padding: 8,
    },
    tableRowAlt: {
        backgroundColor: '#f9fafb',
    },
    tableCell: {
        fontSize: 9,
    },
    // Column widths
    colQty: { width: '10%' },
    colDesc: { width: '45%' },
    colPrice: { width: '20%', textAlign: 'right' as const },
    colTotal: { width: '25%', textAlign: 'right' as const },
    // Totals
    totalsSection: {
        marginTop: 10,
        borderTopWidth: 2,
        borderTopColor: '#e5e7eb',
        paddingTop: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 4,
    },
    totalLabel: {
        fontSize: 10,
        color: '#666666',
    },
    totalValue: {
        fontSize: 10,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 8,
        backgroundColor: '#7c3aed',
        marginTop: 5,
    },
    grandTotalLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    grandTotalValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    // Payment Info
    paymentSection: {
        marginTop: 15,
        padding: 10,
        backgroundColor: '#f3f4f6',
    },
    paymentLabel: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    paymentValue: {
        fontSize: 10,
        marginTop: 2,
    },
    // Notes
    notesSection: {
        marginTop: 15,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
    },
    notesLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#666666',
        marginBottom: 4,
    },
    notesText: {
        fontSize: 9,
        color: '#374151',
    },
    // Watermark / Disclaimer
    disclaimer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#fef3c7',
        borderWidth: 2,
        borderColor: '#f59e0b',
    },
    disclaimerTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#92400e',
        marginBottom: 5,
    },
    disclaimerText: {
        fontSize: 9,
        textAlign: 'center',
        color: '#92400e',
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 10,
    },
    footerText: {
        fontSize: 8,
        color: '#9ca3af',
    },
});

// Types
export interface InternalInvoiceItem {
    quantity: number;
    description: string;
    unitPrice: number;
    total: number;
}

export interface InternalInvoiceData {
    // Business Info
    businessName: string;
    businessRuc: string;
    businessDv: string;
    businessAddress: string;
    businessPhone?: string;
    businessEmail?: string;

    // Document Info
    documentNumber: string;
    issueDate: Date;

    // Client Info (optional)
    clientName?: string;
    clientRuc?: string;

    // Items
    items: InternalInvoiceItem[];

    // Totals
    subtotal: number;
    discount?: number;
    itbms: number;
    total: number;

    // Payment
    paymentMethod: string;

    // Notes
    notes?: string;
}

// Helper function to format payment method
function formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
        'CASH': 'Efectivo',
        'CARD': 'Tarjeta',
        'TRANSFER': 'Transferencia / Yappy',
        'MIXED': 'Pago Mixto',
    };
    return methods[method] || method;
}

// Helper function to format date
function formatDate(date: Date): string {
    return formatPanama(date, "d 'de' MMMM 'de' yyyy");
}

function formatTime(date: Date): string {
    return formatPanama(date, 'h:mm a');
}

// PDF Component
export function InternalInvoicePDF(props: InternalInvoiceData) {
    const {
        businessName,
        businessRuc,
        businessDv,
        businessAddress,
        businessPhone,
        businessEmail,
        documentNumber,
        issueDate,
        clientName,
        clientRuc,
        items,
        subtotal,
        discount = 0,
        itbms,
        total,
        paymentMethod,
        notes,
    } = props;

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Header - Business Info */}
                <View style={styles.header}>
                    <Text style={styles.businessName}>{businessName}</Text>
                    <Text style={styles.businessInfo}>
                        RUC: {businessRuc} - DV: {businessDv}
                    </Text>
                    <Text style={styles.businessInfo}>{businessAddress}</Text>
                    {businessPhone && (
                        <Text style={styles.businessInfo}>Tel: {businessPhone}</Text>
                    )}
                    {businessEmail && (
                        <Text style={styles.businessInfo}>{businessEmail}</Text>
                    )}
                </View>

                {/* Document Title */}
                <View style={styles.documentTitle}>
                    <Text style={styles.documentTitleText}>FACTURA INTERNA</Text>
                    <Text style={styles.documentNumber}>No. {documentNumber}</Text>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <View style={styles.infoColumn}>
                        <Text style={styles.infoLabel}>FECHA DE EMISIÓN</Text>
                        <Text style={styles.infoValue}>{formatDate(issueDate)}</Text>
                        <Text style={styles.infoLabel}>HORA</Text>
                        <Text style={styles.infoValue}>{formatTime(issueDate)}</Text>
                    </View>
                    <View style={styles.infoColumn}>
                        <Text style={styles.infoLabel}>CLIENTE</Text>
                        <Text style={styles.infoValue}>
                            {clientName || 'CONSUMIDOR FINAL'}
                        </Text>
                        {clientRuc && (
                            <>
                                <Text style={styles.infoLabel}>RUC</Text>
                                <Text style={styles.infoValue}>{clientRuc}</Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.colQty]}>CANT</Text>
                        <Text style={[styles.tableHeaderCell, styles.colDesc]}>DESCRIPCIÓN</Text>
                        <Text style={[styles.tableHeaderCell, styles.colPrice]}>P/U</Text>
                        <Text style={[styles.tableHeaderCell, styles.colTotal]}>TOTAL</Text>
                    </View>

                    {/* Table Rows */}
                    {items.map((item, index) => (
                        <View
                            key={index}
                            style={[
                                styles.tableRow,
                                index % 2 === 1 ? styles.tableRowAlt : {},
                            ]}
                        >
                            <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                            <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
                            <Text style={[styles.tableCell, styles.colPrice]}>
                                ${item.unitPrice.toFixed(2)}
                            </Text>
                            <Text style={[styles.tableCell, styles.colTotal]}>
                                ${item.total.toFixed(2)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Totals Section */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
                    </View>
                    {discount > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Descuento:</Text>
                            <Text style={[styles.totalValue, { color: '#16a34a' }]}>
                                -${discount.toFixed(2)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>ITBMS (7%):</Text>
                        <Text style={styles.totalValue}>${itbms.toFixed(2)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text style={styles.grandTotalLabel}>TOTAL A PAGAR</Text>
                        <Text style={styles.grandTotalValue}>${total.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Payment Method */}
                <View style={styles.paymentSection}>
                    <Text style={styles.paymentLabel}>FORMA DE PAGO:</Text>
                    <Text style={styles.paymentValue}>
                        {formatPaymentMethod(paymentMethod)}
                    </Text>
                </View>

                {/* Notes */}
                {notes && (
                    <View style={styles.notesSection}>
                        <Text style={styles.notesLabel}>OBSERVACIONES:</Text>
                        <Text style={styles.notesText}>{notes}</Text>
                    </View>
                )}

                {/* Disclaimer - Non-Fiscal Document */}
                <View style={styles.disclaimer}>
                    <Text style={styles.disclaimerTitle}>
                        ⚠️ DOCUMENTO INTERNO - NO FISCAL
                    </Text>
                    <Text style={styles.disclaimerText}>
                        Este documento no tiene validez tributaria ante la DGI.
                    </Text>
                    <Text style={styles.disclaimerText}>
                        Para obtener factura fiscal, solicítela al momento de la compra.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Gracias por su preferencia | {businessName}
                    </Text>
                    <Text style={styles.footerText}>
                        Documento generado el {formatDate(new Date())} a las{' '}
                        {formatTime(new Date())}
                    </Text>
                </View>
            </Page>
        </Document>
    );
}
