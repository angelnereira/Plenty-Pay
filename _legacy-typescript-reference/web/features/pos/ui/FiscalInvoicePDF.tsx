/**
 * Fiscal Invoice PDF Template (Thermal Receipt Format)
 * Generates PDF documents for fiscal invoices following Panama DGI standards
 * This is a FISCAL document with HKA/DGI validation data
 * 
 * Features:
 * - Dynamic QR code for validation
 * - Optional business logo
 * - Thermal printer optimized (80mm width)
 * - CUFE and authorization protocol display
 */

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Image
} from '@react-pdf/renderer';
import { formatPanama } from '@/lib/date-utils';

// Register fonts
Font.register({
    family: 'Inter',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 700 },
    ]
});

// Styles for thermal receipt format
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 15,
        fontFamily: 'Inter',
        fontSize: 9,
        // 80mm width = ~227pt
        width: 227,
    },
    // Header
    header: {
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 8,
        alignItems: 'center',
    },
    logo: {
        width: 60,
        height: 60,
        marginBottom: 5,
    },
    businessName: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 2,
    },
    businessInfo: {
        fontSize: 8,
        textAlign: 'center',
        color: '#333333',
        marginTop: 1,
    },
    // Document Title
    documentTitle: {
        backgroundColor: '#000000',
        padding: 6,
        marginBottom: 8,
    },
    documentTitleText: {
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#FFFFFF',
    },
    documentNumber: {
        fontSize: 10,
        textAlign: 'center',
        color: '#FFFFFF',
        marginTop: 2,
    },
    // Info Section
    infoSection: {
        marginBottom: 8,
        padding: 6,
        backgroundColor: '#f5f5f5',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    infoLabel: {
        fontSize: 7,
        color: '#666666',
        fontWeight: 'bold',
    },
    infoValue: {
        fontSize: 8,
    },
    // Items Table
    table: {
        marginBottom: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#333333',
        padding: 4,
        color: '#FFFFFF',
    },
    tableHeaderCell: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#cccccc',
        padding: 3,
    },
    tableRowAlt: {
        backgroundColor: '#fafafa',
    },
    tableCell: {
        fontSize: 8,
    },
    // Column widths for thermal
    colQty: { width: '12%', textAlign: 'center' as const },
    colDesc: { width: '48%' },
    colPrice: { width: '18%', textAlign: 'right' as const },
    colTotal: { width: '22%', textAlign: 'right' as const },
    // Totals
    totalsSection: {
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 6,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 2,
    },
    totalLabel: {
        fontSize: 8,
        color: '#333333',
    },
    totalValue: {
        fontSize: 8,
        fontWeight: 'bold',
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 6,
        backgroundColor: '#000000',
        marginTop: 4,
    },
    grandTotalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    grandTotalValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    // Payment Info
    paymentSection: {
        marginTop: 8,
        padding: 6,
        backgroundColor: '#f5f5f5',
    },
    paymentLabel: {
        fontSize: 7,
        fontWeight: 'bold',
    },
    paymentValue: {
        fontSize: 8,
        marginTop: 1,
    },
    // QR and DGI Section
    dgiSection: {
        marginTop: 10,
        padding: 8,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#0ea5e9',
        alignItems: 'center',
    },
    dgiTitle: {
        fontSize: 9,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#0369a1',
        marginBottom: 6,
    },
    qrCode: {
        width: 80,
        height: 80,
        marginBottom: 6,
    },
    cufeContainer: {
        marginTop: 4,
        width: '100%',
    },
    cufeLabel: {
        fontSize: 6,
        fontWeight: 'bold',
        color: '#0369a1',
        textAlign: 'center',
    },
    cufeValue: {
        fontSize: 5,
        color: '#333333',
        textAlign: 'center',
        marginTop: 2,
    },
    protocolValue: {
        fontSize: 7,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 4,
    },
    // Client Section
    clientSection: {
        marginBottom: 8,
        padding: 6,
        backgroundColor: '#fafafa',
        borderWidth: 0.5,
        borderColor: '#e5e5e5',
    },
    clientLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#666666',
        marginBottom: 2,
    },
    clientName: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    clientRuc: {
        fontSize: 8,
        color: '#333333',
    },
    // Footer
    footer: {
        marginTop: 12,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#cccccc',
        paddingTop: 8,
    },
    footerText: {
        fontSize: 7,
        color: '#666666',
        textAlign: 'center',
    },
    legalText: {
        fontSize: 6,
        color: '#999999',
        textAlign: 'center',
        marginTop: 4,
    },
});

// Types
export interface FiscalInvoiceItem {
    quantity: number;
    description: string;
    unitPrice: number;
    total: number;
}

export interface FiscalInvoiceData {
    // Business Info - Emisor
    businessName: string;
    businessRuc: string;
    businessDv: string;
    businessAddress: string;
    businessPhone?: string;
    businessEmail?: string;
    businessLogo?: string; // Base64 or URL

    // Document Info
    invoiceNumber: string;
    issueDate: Date;

    // Client Info - Receptor
    clientName: string;
    clientRuc?: string;
    clientDv?: string;
    clientAddress?: string;

    // Items
    items: FiscalInvoiceItem[];

    // Totals
    subtotal: number;
    discount?: number;
    itbms: number;
    total: number;

    // Payment
    paymentMethod: string;

    // HKA/DGI Data
    cufe: string;
    authProtocol?: string;
    dgiDate?: Date;
    qrCodeBase64?: string; // Pre-generated QR as Base64
}

// Helper function to format payment method
function formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
        'CASH': 'Efectivo',
        'CARD': 'Tarjeta',
        'CREDIT_CARD': 'Tarjeta de Crédito',
        'DEBIT_CARD': 'Tarjeta de Débito',
        'TRANSFER': 'Transferencia / Yappy',
        'MIXED': 'Pago Mixto',
        'OTHER': 'Otros',
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

function formatDateTime(date: Date): string {
    return formatPanama(date, "dd/MM/yyyy HH:mm:ss");
}

// PDF Component
export function FiscalInvoicePDF(props: FiscalInvoiceData) {
    const {
        businessName,
        businessRuc,
        businessDv,
        businessAddress,
        businessPhone,
        businessEmail,
        businessLogo,
        invoiceNumber,
        issueDate,
        clientName,
        clientRuc,
        clientDv,
        clientAddress,
        items,
        subtotal,
        discount = 0,
        itbms,
        total,
        paymentMethod,
        cufe,
        authProtocol,
        dgiDate,
        qrCodeBase64,
    } = props;

    return (
        <Document>
            <Page size={[227, 841]} style={styles.page}>
                {/* Header - Business Info */}
                <View style={styles.header}>
                    {businessLogo && (
                        <Image src={businessLogo} style={styles.logo} />
                    )}
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

                {/* Document Title - Fiscal Badge */}
                <View style={styles.documentTitle}>
                    <Text style={styles.documentTitleText}>FACTURA ELECTRÓNICA</Text>
                    <Text style={styles.documentNumber}>No. {invoiceNumber}</Text>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>FECHA EMISIÓN:</Text>
                        <Text style={styles.infoValue}>{formatDate(issueDate)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>HORA:</Text>
                        <Text style={styles.infoValue}>{formatTime(issueDate)}</Text>
                    </View>
                    {dgiDate && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>FECHA DGI:</Text>
                            <Text style={styles.infoValue}>{formatDateTime(dgiDate)}</Text>
                        </View>
                    )}
                </View>

                {/* Client Section */}
                <View style={styles.clientSection}>
                    <Text style={styles.clientLabel}>DATOS DEL RECEPTOR:</Text>
                    <Text style={styles.clientName}>{clientName}</Text>
                    {clientRuc && (
                        <Text style={styles.clientRuc}>
                            RUC: {clientRuc}{clientDv ? ` - DV: ${clientDv}` : ''}
                        </Text>
                    )}
                    {clientAddress && (
                        <Text style={styles.clientRuc}>{clientAddress}</Text>
                    )}
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.colQty]}>CNT</Text>
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
                        <Text style={styles.grandTotalLabel}>TOTAL</Text>
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

                {/* DGI/HKA Section - CUFE and QR */}
                <View style={styles.dgiSection}>
                    <Text style={styles.dgiTitle}>
                        ✓ DOCUMENTO AUTORIZADO POR LA DGI
                    </Text>

                    {qrCodeBase64 && (
                        <Image
                            src={`data:image/png;base64,${qrCodeBase64}`}
                            style={styles.qrCode}
                        />
                    )}

                    {authProtocol && (
                        <Text style={styles.protocolValue}>
                            Protocolo: {authProtocol}
                        </Text>
                    )}

                    <View style={styles.cufeContainer}>
                        <Text style={styles.cufeLabel}>CUFE (Código Único de Factura Electrónica):</Text>
                        <Text style={styles.cufeValue}>{cufe}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Gracias por su preferencia
                    </Text>
                    <Text style={styles.footerText}>
                        {businessName}
                    </Text>
                    <Text style={styles.legalText}>
                        Documento generado electrónicamente - Conserve este comprobante
                    </Text>
                    <Text style={styles.legalText}>
                        Generado: {formatDateTime(new Date())}
                    </Text>
                </View>
            </Page>
        </Document>
    );
}
