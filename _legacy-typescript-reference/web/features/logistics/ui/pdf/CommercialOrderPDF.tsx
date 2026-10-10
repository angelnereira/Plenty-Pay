/**
 * CommercialOrderPDF.tsx
 * Commercial-style delivery order / proforma — inspired by Zona Libre documents.
 * Shows: logo, company info, client info, barcode, detailed items table with
 * article/detail/color/size/packaging columns, vendor info, and totals.
 *
 * Uses the same DeliveryOrderPDFData interface for compatibility.
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

// ─── Fonts ─────────────────────────────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'inter')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(FONTS_DIR, 'inter-regular.woff'), fontWeight: 400 },
    { src: path.join(FONTS_DIR, 'inter-bold.woff'), fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback((word) => [word])

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    padding: 30,
    color: '#1a1a1a',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottom: '1pt solid #333',
    paddingBottom: 10,
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '50%',
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  companyInfo: {
    fontSize: 7,
    color: '#444',
    lineHeight: 1.4,
  },
  companyName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#111',
    marginBottom: 2,
  },
  docTypeArea: {
    textAlign: 'right',
    alignItems: 'flex-end',
  },
  docType: {
    fontSize: 11,
    fontWeight: 700,
    color: '#111',
    marginBottom: 3,
  },
  docNumber: {
    fontSize: 10,
    fontWeight: 700,
    color: '#333',
  },
  docDate: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },

  // RUC line
  rucRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 20,
  },
  rucLabel: {
    fontSize: 8,
    fontWeight: 700,
  },
  rucValue: {
    fontSize: 9,
    fontWeight: 700,
  },

  // Client section
  sectionRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  sectionHalf: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    marginBottom: 2,
  },
  sectionValue: {
    fontSize: 8,
    color: '#111',
    lineHeight: 1.3,
  },
  clientHeader: {
    fontSize: 8,
    fontWeight: 700,
    color: '#111',
    marginBottom: 4,
    borderBottom: '0.5pt solid #ccc',
    paddingBottom: 3,
  },

  // Items table
  table: {
    marginTop: 8,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '1pt solid #333',
    borderBottom: '1pt solid #333',
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ddd',
    paddingVertical: 4,
    minHeight: 20,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  // Column widths
  colArticle:    { width: '10%', paddingHorizontal: 3 },
  colDetail:     { width: '22%', paddingHorizontal: 3 },
  colColor:      { width: '10%', paddingHorizontal: 3 },
  colSize:       { width: '10%', paddingHorizontal: 3 },
  colPackaging:  { width: '8%', paddingHorizontal: 3, textAlign: 'center' },
  colQty:        { width: '8%', paddingHorizontal: 3, textAlign: 'center' },
  colPrice:      { width: '10%', paddingHorizontal: 3, textAlign: 'right' },
  colSubtotal:   { width: '10%', paddingHorizontal: 3, textAlign: 'right' },
  colDiscount:   { width: '6%', paddingHorizontal: 3, textAlign: 'center' },
  colTotal:      { width: '10%', paddingHorizontal: 3, textAlign: 'right' },
  thText: {
    fontSize: 7,
    fontWeight: 700,
    color: '#333',
  },
  tdText: {
    fontSize: 7.5,
    color: '#222',
  },
  tdTextBold: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#111',
  },

  // Footer / Totals
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1.5pt solid #333',
    paddingTop: 8,
    marginTop: 6,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    marginBottom: 2,
  },
  vendorValue: {
    fontSize: 9,
    fontWeight: 700,
    color: '#111',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
    alignItems: 'center',
  },
  totalCell: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 7,
    color: '#555',
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: '#111',
  },
  grandTotal: {
    fontSize: 11,
    fontWeight: 700,
    color: '#000',
  },

  // Notes
  notesSection: {
    marginTop: 10,
    padding: 6,
    backgroundColor: '#f9f9f9',
    borderRadius: 3,
    border: '0.5pt solid #ddd',
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: '#555',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 7,
    color: '#333',
    lineHeight: 1.4,
  },

  // QR section
  qrSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  qrText: {
    fontSize: 6,
    color: '#888',
    textAlign: 'right',
  },
})

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return ''
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parse extra product details from the description field.
 * Convention: description may contain | separated fields:
 *   "Product Name | Color | Size/Curve"
 * If not present, we just use the full description.
 */
function parseItemDetails(description: string): { detail: string; color: string; size: string } {
  const parts = description.split('|').map(s => s.trim())
  if (parts.length >= 3) {
    return { detail: parts[0], color: parts[1], size: parts[2] }
  }
  if (parts.length === 2) {
    return { detail: parts[0], color: parts[1], size: '' }
  }
  return { detail: description, color: '', size: '' }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function CommercialOrderPDF({ data }: { data: DeliveryOrderPDFData }) {
  const totalItems = data.items.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <Document
      title={`Orden ${data.orderCode}`}
      subject="Orden de Entrega Comercial"
    >
      <Page size="LETTER" style={s.page}>

        {/* ── Header: Logo + Company | Doc Type + Number ── */}
        <View style={s.headerRow}>
          <View style={s.logoArea}>
            {data.logo && (
              <Image src={data.logo} style={s.logo} />
            )}
            <View>
              <Text style={s.companyName}>{data.senderName}</Text>
              <View style={s.companyInfo}>
                {data.senderAddress && <Text>Dirección: {data.senderAddress}</Text>}
                {data.senderPhone && <Text>Teléfono: {data.senderPhone}</Text>}
                {data.senderEmail && <Text>e-mail: {data.senderEmail}</Text>}
              </View>
            </View>
          </View>

          <View style={s.docTypeArea}>
            <Text style={s.docType}>Orden de Entrega</Text>
            <Text style={s.docNumber}># {data.orderCode}</Text>
            <Text style={s.docDate}>{data.issueDate}</Text>
          </View>
        </View>

        {/* ── RUC ── */}
        {data.senderRuc && (
          <View style={s.rucRow}>
            <Text style={s.rucLabel}>R.U.C.:</Text>
            <Text style={s.rucValue}>
              {data.senderRuc}{data.senderDv ? ` DV ${data.senderDv}` : ''}
            </Text>
          </View>
        )}

        {/* ── Client/Receiver Info ── */}
        <View style={s.sectionRow}>
          <View style={s.sectionHalf}>
            <Text style={s.clientHeader}>Cliente / Destinatario</Text>
            <Text style={s.sectionValue}>{data.receiverName}</Text>
            {data.receiverRuc && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>RUC:</Text>
                <Text style={s.sectionValue}>{data.receiverRuc}</Text>
              </View>
            )}
            {data.receiverAddress && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Dirección:</Text>
                <Text style={s.sectionValue}>{data.receiverAddress}</Text>
              </View>
            )}
            {data.receiverPhone && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Teléfono:</Text>
                <Text style={s.sectionValue}>{data.receiverPhone}</Text>
              </View>
            )}
          </View>

          <View style={s.sectionHalf}>
            <Text style={s.clientHeader}>Datos del Envío</Text>
            {data.shippingMode && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Modo:</Text>
                <Text style={s.sectionValue}>{data.shippingMode}</Text>
              </View>
            )}
            {data.incoterm && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Incoterm:</Text>
                <Text style={s.sectionValue}>{data.incoterm}</Text>
              </View>
            )}
            {data.carrierName && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Transportista:</Text>
                <Text style={s.sectionValue}>{data.carrierName}</Text>
              </View>
            )}
            {data.vehiclePlate && (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                <Text style={s.sectionLabel}>Vehículo:</Text>
                <Text style={s.sectionValue}>{data.vehiclePlate}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              <Text style={s.sectionLabel}>Prioridad:</Text>
              <Text style={s.sectionValue}>{data.priority}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              <Text style={s.sectionLabel}>Estado:</Text>
              <Text style={s.sectionValue}>{data.status}</Text>
            </View>
          </View>
        </View>

        {/* ── Items Table ── */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeader}>
            <View style={s.colArticle}><Text style={s.thText}>Artículo</Text></View>
            <View style={s.colDetail}><Text style={s.thText}>Detalle</Text></View>
            <View style={s.colColor}><Text style={s.thText}>Color</Text></View>
            <View style={s.colSize}><Text style={s.thText}>Talle / Ref.</Text></View>
            <View style={s.colPackaging}><Text style={s.thText}>Empaque</Text></View>
            <View style={s.colQty}><Text style={s.thText}>Cant.</Text></View>
            <View style={s.colPrice}><Text style={s.thText}>Precio</Text></View>
            <View style={s.colSubtotal}><Text style={s.thText}>Subtotal</Text></View>
            <View style={s.colDiscount}><Text style={s.thText}>Dto.%</Text></View>
            <View style={s.colTotal}><Text style={s.thText}>Total</Text></View>
          </View>

          {/* Rows */}
          {data.items.map((item, idx) => {
            const parsed = parseItemDetails(item.description)
            const price = item.unitPrice ?? 0
            const subtotal = price * item.quantity
            const total = subtotal // no discount logic yet

            return (
              <View
                key={idx}
                style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}
              >
                <View style={s.colArticle}>
                  <Text style={s.tdText}>{item.code || `#${item.lineNumber}`}</Text>
                </View>
                <View style={s.colDetail}>
                  <Text style={s.tdText}>{parsed.detail}</Text>
                </View>
                <View style={s.colColor}>
                  <Text style={s.tdText}>{parsed.color}</Text>
                </View>
                <View style={s.colSize}>
                  <Text style={s.tdText}>{parsed.size || item.dimensions || ''}</Text>
                </View>
                <View style={s.colPackaging}>
                  <Text style={s.tdText}>{item.packaging || 'Unidad'}</Text>
                </View>
                <View style={s.colQty}>
                  <Text style={s.tdTextBold}>{item.quantity.toFixed(0)}</Text>
                </View>
                <View style={s.colPrice}>
                  <Text style={s.tdText}>{price > 0 ? fmtMoney(price) : ''}</Text>
                </View>
                <View style={s.colSubtotal}>
                  <Text style={s.tdText}>{subtotal > 0 ? fmtMoney(subtotal) : ''}</Text>
                </View>
                <View style={s.colDiscount}>
                  <Text style={s.tdText}>.00</Text>
                </View>
                <View style={s.colTotal}>
                  <Text style={s.tdTextBold}>{total > 0 ? fmtMoney(total) : ''}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* ── Footer: Vendor + Totals ── */}
        <View style={s.footerRow}>
          <View style={s.vendorInfo}>
            <Text style={s.vendorLabel}>Vendedor / Emisor</Text>
            <Text style={s.vendorValue}>{data.senderName}</Text>
          </View>

          <View style={s.totalsRow}>
            <View style={s.totalCell}>
              <Text style={s.totalLabel}>Total Unidades</Text>
              <Text style={s.totalValue}>{totalItems.toFixed(0)}</Text>
            </View>
            {data.shippingCost != null && data.shippingCost > 0 && (
              <View style={s.totalCell}>
                <Text style={s.totalLabel}>Flete</Text>
                <Text style={s.totalValue}>{fmtMoney(data.shippingCost)}</Text>
              </View>
            )}
            {data.taxAmount != null && data.taxAmount > 0 && (
              <View style={s.totalCell}>
                <Text style={s.totalLabel}>ITBMS</Text>
                <Text style={s.totalValue}>{fmtMoney(data.taxAmount)}</Text>
              </View>
            )}
            <View style={s.totalCell}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.grandTotal}>
                {data.totalAmount != null ? fmtMoney(data.totalAmount) : fmtMoney(data.subtotal ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>Observaciones:</Text>
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── QR Tracking ── */}
        {data.qrDataUrl && (
          <View style={s.qrSection}>
            <View>
              <Text style={s.qrText}>Código de rastreo</Text>
              {data.trackingUrl && (
                <Text style={s.qrText}>{data.trackingUrl}</Text>
              )}
            </View>
            <Image src={data.qrDataUrl} style={s.qrImage} />
          </View>
        )}

      </Page>
    </Document>
  )
}
