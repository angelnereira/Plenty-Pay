/**
 * SimpleOrderPDF.tsx
 * Minimalist delivery order / proforma template.
 * Clean design: logo, basic info, simple items list, total.
 * Ideal for quick internal orders or simple deliveries.
 */

import React from 'react'
import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { DeliveryOrderPDFData } from './DeliveryOrderPDF'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'inter')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(FONTS_DIR, 'inter-regular.woff'), fontWeight: 400 },
    { src: path.join(FONTS_DIR, 'inter-bold.woff'), fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback((word) => [word])

const ACCENT = '#4F46E5' // Indigo

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    padding: 40,
    color: '#1a1a1a',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 50,
    height: 50,
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111',
  },
  companyDetail: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  orderCode: {
    fontSize: 11,
    fontWeight: 700,
    color: '#333',
    marginTop: 3,
  },
  orderDate: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },

  // Divider
  divider: {
    height: 2,
    backgroundColor: ACCENT,
    marginBottom: 15,
    borderRadius: 1,
  },

  // Info sections
  infoRow: {
    flexDirection: 'row',
    gap: 30,
    marginBottom: 18,
  },
  infoBlock: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottom: `1pt solid ${ACCENT}40`,
    paddingBottom: 3,
  },
  infoLine: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.6,
  },
  infoLabel: {
    fontSize: 8,
    color: '#777',
  },

  // Table
  table: {
    marginBottom: 15,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: ACCENT,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  tableBody: {},
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottom: '0.5pt solid #e5e5e5',
  },
  rowAlt: {
    backgroundColor: '#f8f8ff',
  },
  thText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#fff',
  },
  tdText: {
    fontSize: 8.5,
    color: '#333',
  },
  // Columns
  cNum:   { width: '6%' },
  cDesc:  { width: '38%' },
  cQty:   { width: '12%', textAlign: 'center' },
  cUnit:  { width: '12%', textAlign: 'center' },
  cPrice: { width: '16%', textAlign: 'right' },
  cTotal: { width: '16%', textAlign: 'right' },

  // Totals
  totalsBox: {
    alignSelf: 'flex-end',
    width: '45%',
    marginTop: 5,
    borderTop: '1pt solid #ddd',
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: '#555',
  },
  totalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: '#222',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTop: '1.5pt solid #111',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#111',
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: ACCENT,
  },

  // Notes
  notes: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f5f3ff',
    borderRadius: 4,
    border: `0.5pt solid ${ACCENT}30`,
  },
  notesTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: ACCENT,
    marginBottom: 3,
  },
  notesBody: {
    fontSize: 8,
    color: '#444',
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTop: '0.5pt solid #ddd',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#999',
  },
  qrImage: {
    width: 50,
    height: 50,
  },
})

function fmt(n: number | null | undefined): string {
  if (n == null) return ''
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SimpleOrderPDF({ data }: { data: DeliveryOrderPDFData }) {
  const totalItems = data.items.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <Document title={`Proforma ${data.orderCode}`} subject="Proforma / Orden Simple">
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {data.logo && <Image src={data.logo} style={s.logo} />}
            <View>
              <Text style={s.companyName}>{data.senderName}</Text>
              {data.senderRuc && <Text style={s.companyDetail}>RUC: {data.senderRuc}{data.senderDv ? ` DV ${data.senderDv}` : ''}</Text>}
              {data.senderPhone && <Text style={s.companyDetail}>{data.senderPhone}</Text>}
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Proforma</Text>
            <Text style={s.orderCode}>{data.orderCode}</Text>
            <Text style={s.orderDate}>{data.issueDate}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Info */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoTitle}>Destinatario</Text>
            <Text style={s.infoLine}>{data.receiverName}</Text>
            {data.receiverRuc && <Text style={s.infoLine}><Text style={s.infoLabel}>RUC: </Text>{data.receiverRuc}</Text>}
            {data.receiverAddress && <Text style={s.infoLine}>{data.receiverAddress}</Text>}
            {data.receiverPhone && <Text style={s.infoLine}>{data.receiverPhone}</Text>}
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoTitle}>Detalles</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Estado: </Text>{data.status}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Prioridad: </Text>{data.priority}</Text>
            {data.shippingMode && <Text style={s.infoLine}><Text style={s.infoLabel}>Envío: </Text>{data.shippingMode}</Text>}
            {data.purchaseOrderRef && <Text style={s.infoLine}><Text style={s.infoLabel}>Ref. O/C: </Text>{data.purchaseOrderRef}</Text>}
          </View>
        </View>

        {/* Table */}
        <View style={s.table}>
          <View style={s.tableHead}>
            <View style={s.cNum}><Text style={s.thText}>#</Text></View>
            <View style={s.cDesc}><Text style={s.thText}>Descripción</Text></View>
            <View style={s.cQty}><Text style={s.thText}>Cantidad</Text></View>
            <View style={s.cUnit}><Text style={s.thText}>Empaque</Text></View>
            <View style={s.cPrice}><Text style={s.thText}>Precio Unit.</Text></View>
            <View style={s.cTotal}><Text style={s.thText}>Total</Text></View>
          </View>
          <View style={s.tableBody}>
            {data.items.map((item, idx) => {
              const lineTotal = (item.unitPrice ?? 0) * item.quantity
              return (
                <View key={idx} style={[s.row, idx % 2 === 1 ? s.rowAlt : {}]}>
                  <View style={s.cNum}><Text style={s.tdText}>{item.lineNumber}</Text></View>
                  <View style={s.cDesc}><Text style={s.tdText}>{item.description}</Text></View>
                  <View style={s.cQty}><Text style={s.tdText}>{item.quantity.toFixed(0)}</Text></View>
                  <View style={s.cUnit}><Text style={s.tdText}>{item.packaging || 'Unidad'}</Text></View>
                  <View style={s.cPrice}><Text style={s.tdText}>{item.unitPrice ? fmt(item.unitPrice) : '-'}</Text></View>
                  <View style={s.cTotal}><Text style={s.tdText}>{lineTotal > 0 ? fmt(lineTotal) : '-'}</Text></View>
                </View>
              )
            })}
          </View>
        </View>

        {/* Totals */}
        <View style={s.totalsBox}>
          {data.subtotal != null && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmt(data.subtotal)}</Text>
            </View>
          )}
          {data.taxAmount != null && data.taxAmount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>ITBMS (7%)</Text>
              <Text style={s.totalValue}>{fmt(data.taxAmount)}</Text>
            </View>
          )}
          {data.shippingCost != null && data.shippingCost > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Flete</Text>
              <Text style={s.totalValue}>{fmt(data.shippingCost)}</Text>
            </View>
          )}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>TOTAL ({totalItems.toFixed(0)} uds.)</Text>
            <Text style={s.grandTotalValue}>
              ${data.totalAmount != null ? fmt(data.totalAmount) : fmt(data.subtotal ?? 0)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={s.notes}>
            <Text style={s.notesTitle}>Observaciones</Text>
            <Text style={s.notesBody}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <View>
            <Text style={s.footerText}>{data.senderName} · {data.orderCode}</Text>
            <Text style={s.footerText}>Generado: {data.issueDate}</Text>
          </View>
          {data.qrDataUrl && <Image src={data.qrDataUrl} style={s.qrImage} />}
        </View>

      </Page>
    </Document>
  )
}
