/**
 * DeliveryOrderPDF.tsx
 * PDF template for Logistics Delivery Orders (Orden de Entrega)
 * Follows the official layout: header → info grid → remitente/destinatario →
 * transportista → items table → conditions/totals → POD signatures → footer
 *
 * Uses @react-pdf/renderer (same library as Facturación v2.0)
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

// ─── Fonts (local files — avoids network dependency in serverless) ────────────
// Files are in public/fonts/inter/ (committed to repo)
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'inter')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(FONTS_DIR, 'inter-regular.woff'), fontWeight: 400 },
    { src: path.join(FONTS_DIR, 'inter-bold.woff'), fontWeight: 700 },
  ],
})

// Disable font hyphenation
Font.registerHyphenationCallback((word) => [word])

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryOrderPDFData {
  // Logo (base64 data URL or null)
  logo?: string | null

  // Cabecera
  orderCode: string
  invoiceRef?: string | null
  purchaseOrderRef?: string | null
  issueDate: string
  priority: string
  status: string
  branchPoint?: string | null

  // Remitente (empresa emisora)
  senderName: string
  senderAddress?: string | null
  senderLocation?: string | null
  senderRuc?: string | null
  senderDv?: string | null
  senderPhone?: string | null
  senderEmail?: string | null

  // Destinatario
  receiverName: string
  receiverAddress?: string | null
  receiverLocation?: string | null
  receiverRuc?: string | null
  receiverPhone?: string | null
  receiverEmail?: string | null

  // Transportista
  carrierName?: string | null
  driverName?: string | null
  driverLicense?: string | null
  vehiclePlate?: string | null
  driverIdDoc?: string | null
  insurancePolicy?: string | null

  // Ítems
  items: {
    lineNumber: number
    code?: string | null
    description: string
    quantity: number
    unit: string
    weightKg?: number | null
    dimensions?: string | null
    packaging?: string | null
    unitPrice?: number | null
  }[]

  // Totales
  subtotal?: number | null
  taxAmount?: number | null
  taxPercent?: number | null
  shippingCost?: number | null
  insuranceCost?: number | null
  totalAmount?: number | null

  // Condiciones
  shippingMode?: string | null
  incoterm?: string | null
  controlledTemp?: boolean
  hazardousMat?: boolean
  notes?: string | null

  // QR tracking
  qrDataUrl?: string | null
  trackingUrl?: string | null
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  headerBg: '#2C3E50',
  headerText: '#FFFFFF',
  sectionBg: '#34495E',
  sectionText: '#FFFFFF',
  tableHeaderBg: '#4A5568',
  tableHeaderText: '#FFFFFF',
  rowAlt: '#F7F8FA',
  border: '#CBD5E0',
  label: '#5A6880',
  value: '#1A202C',
  muted: '#718096',
  footerBg: '#EDF2F7',
  footerText: '#4A5568',
  white: '#FFFFFF',
  accent: '#2C3E50',
  totalRowBg: '#EDF2F7',
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: C.value,
    backgroundColor: C.white,
    paddingHorizontal: 28,
    paddingVertical: 28,
  },

  // ── Document Header ──
  docHeader: {
    backgroundColor: C.headerBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 0,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: C.headerText,
    textAlign: 'center',
    marginBottom: 2,
  },
  docSubtitle: {
    fontSize: 7.5,
    color: '#B0BEC5',
    textAlign: 'center',
    marginBottom: 1,
  },

  // ── Info Grid (metadata) ──
  infoGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  infoCell: {
    flex: 1,
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  infoCellLast: {
    flex: 1,
    padding: 5,
  },
  infoLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: C.label,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 8,
    fontWeight: 700,
    color: C.value,
  },

  // ── Section Header ──
  sectionHeader: {
    backgroundColor: C.sectionBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.sectionText,
  },

  // ── Two-panel block (sender / receiver) ──
  panelRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  panel: {
    flex: 1,
    padding: 7,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  panelLast: {
    flex: 1,
    padding: 7,
  },
  panelTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: '#718096',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: C.label,
    width: 52,
  },
  fieldValue: {
    fontSize: 7.5,
    color: C.value,
    flex: 1,
  },

  // ── Carrier strip ──
  carrierRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
    padding: 7,
  },
  carrierCell: {
    flex: 1,
  },

  // ── Items table ──
  table: {
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.tableHeaderBg,
    paddingVertical: 5,
  },
  th: {
    color: C.tableHeaderText,
    fontWeight: 700,
    fontSize: 7,
    paddingHorizontal: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 4,
  },
  tableRowAlt: {
    backgroundColor: C.rowAlt,
  },
  td: {
    fontSize: 7.5,
    paddingHorizontal: 3,
    color: C.value,
  },
  tableSummary: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tableSummaryText: {
    fontSize: 7.5,
    fontWeight: 700,
  },

  // Column widths
  colItem: { width: 24 },
  colCode: { width: 72 },
  colDesc: { width: 120 },
  colQty: { width: 28 },
  colUnit: { width: 28 },
  colWeight: { width: 38 },
  colDim: { width: 46 },
  colPkg: { width: 36 },
  colPrice: { width: 44 },

  // ── Conditions + Totals (two-column) ──
  bottomRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  condPanel: {
    flex: 1,
    padding: 7,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  condTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: C.label,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  condRow: {
    flexDirection: 'row',
    marginBottom: 2.5,
  },
  condLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: C.label,
    width: 70,
  },
  condValue: {
    fontSize: 7.5,
    color: C.value,
    flex: 1,
  },
  totalsPanel: {
    flex: 1,
    padding: 7,
  },
  totalsTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: C.label,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 7.5,
    color: C.muted,
  },
  totalValue: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.value,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  grandTotalLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.value,
  },
  grandTotalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: C.accent,
  },

  // ── POD / Signatures ──
  podHeader: {
    backgroundColor: C.sectionBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  podRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 60,
    marginBottom: 4,
  },
  podCell: {
    flex: 1,
    padding: 7,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  podCellLast: {
    flex: 1,
    padding: 7,
  },
  podLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.value,
    marginBottom: 20,
  },
  podLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginBottom: 3,
  },
  podLineLabel: {
    fontSize: 6,
    color: C.muted,
    marginBottom: 4,
  },

  // ── Observations ──
  obsBlock: {
    borderWidth: 1,
    borderColor: C.border,
    padding: 7,
    marginBottom: 4,
    minHeight: 30,
  },

  // ── Footer ──
  footer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6,
    color: C.muted,
    flex: 1,
  },
  footerPage: {
    fontSize: 6,
    color: C.muted,
    textAlign: 'right',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n?: number | null, decimals = 2) {
  if (n == null) return '--'
  return n.toFixed(decimals)
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}:</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  )
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function DeliveryOrderPDF({ data }: { data: DeliveryOrderPDFData }) {
  const totalItems = data.items.reduce((acc, i) => acc + i.quantity, 0)
  const hasTransport = data.carrierName || data.driverName || data.vehiclePlate
  const hasTotals =
    data.subtotal != null || data.totalAmount != null || data.shippingCost != null

  return (
    <Document
      title={`Orden de Entrega ${data.orderCode}`}
      author="PlentyPay Panamá, S.A."
      subject="Orden de Entrega — Control Logístico"
    >
      <Page size="LETTER" style={s.page}>

        {/* ── Header ── */}
        <View style={s.docHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>Orden de Entrega</Text>
              <Text style={s.docSubtitle}>
                Documento de Control Logístico — República de Panamá
              </Text>
              <Text style={s.docSubtitle}>
                Ref. Ley 51 de 2017 / Estrategia Logística Nacional 2030 / Incoterms® ICC
              </Text>
            </View>
            {data.logo && (
              <Image
                src={data.logo}
                style={{ width: 80, height: 80, objectFit: 'contain' }}
              />
            )}
          </View>
        </View>

        {/* ── Info Grid ── */}
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Documento:</Text>
            <Text style={s.infoValue}>Orden de Entrega</Text>
            {data.invoiceRef && (
              <>
                <Text style={[s.infoLabel, { marginTop: 3 }]}>Factura Ref.:</Text>
                <Text style={s.infoValue}>{data.invoiceRef}</Text>
              </>
            )}
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Sucursal/Punto:</Text>
            <Text style={s.infoValue}>{data.branchPoint ?? '0000/001'}</Text>
            {data.purchaseOrderRef && (
              <>
                <Text style={[s.infoLabel, { marginTop: 3 }]}>Pedido Ref.:</Text>
                <Text style={s.infoValue}>{data.purchaseOrderRef}</Text>
              </>
            )}
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Fecha emisión:</Text>
            <Text style={s.infoValue}>{data.issueDate}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Número:</Text>
            <Text style={s.infoValue}>{data.orderCode}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Prioridad:</Text>
            <Text style={s.infoValue}>{data.priority}</Text>
          </View>
          <View style={s.infoCellLast}>
            <Text style={s.infoLabel}>Estado:</Text>
            <Text style={s.infoValue}>{data.status}</Text>
          </View>
        </View>

        {/* ── Sender / Receiver ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Remitente (Embarcador){'                                                      '}Destinatario (Consignatario)</Text>
        </View>
        <View style={s.panelRow}>
          {/* Sender */}
          <View style={s.panel}>
            <Field label="Nombre" value={data.senderName} />
            <Field label="Dirección" value={data.senderAddress} />
            <Field label="Ubicación" value={data.senderLocation} />
            {data.senderRuc && (
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>RUC:</Text>
                <Text style={s.fieldValue}>
                  {data.senderRuc}
                  {data.senderDv ? `   DV: ${data.senderDv}` : ''}
                </Text>
              </View>
            )}
            <Field label="Teléfono" value={data.senderPhone} />
            <Field label="Correo" value={data.senderEmail} />
          </View>
          {/* Receiver */}
          <View style={s.panelLast}>
            <Field label="Nombre" value={data.receiverName} />
            <Field label="Dirección" value={data.receiverAddress} />
            <Field label="Ubicación" value={data.receiverLocation} />
            <Field label="RUC/Cédula" value={data.receiverRuc} />
            <Field label="Teléfono" value={data.receiverPhone} />
            <Field label="Correo" value={data.receiverEmail} />
          </View>
        </View>

        {/* ── Transport ── */}
        {hasTransport && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Datos del Transportista</Text>
            </View>
            <View style={s.carrierRow}>
              <View style={s.carrierCell}>
                <Field label="Empresa" value={data.carrierName} />
                <Field label="Placa" value={data.vehiclePlate} />
              </View>
              <View style={s.carrierCell}>
                <Field label="Conductor" value={data.driverName} />
                <Field label="Cédula" value={data.driverIdDoc} />
              </View>
              <View style={s.carrierCell}>
                <Field label="Licencia" value={data.driverLicense} />
                <Field label="Seguro" value={data.insurancePolicy} />
              </View>
            </View>
          </>
        )}

        {/* ── Items Table ── */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colItem]}>Ítem</Text>
            <Text style={[s.th, s.colCode]}>Código</Text>
            <Text style={[s.th, s.colDesc]}>Descripción</Text>
            <Text style={[s.th, s.colQty]}>Cant.</Text>
            <Text style={[s.th, s.colUnit]}>Unidad</Text>
            <Text style={[s.th, s.colWeight]}>Peso (kg)</Text>
            <Text style={[s.th, s.colDim]}>Dimensiones</Text>
            <Text style={[s.th, s.colPkg]}>Embalaje</Text>
            <Text style={[s.th, s.colPrice]}>Valor (B/.)</Text>
          </View>

          {/* Rows */}
          {data.items.map((item, idx) => (
            <View
              key={idx}
              style={[s.tableRow, idx % 2 === 0 ? s.tableRowAlt : {}]}
            >
              <Text style={[s.td, s.colItem]}>{item.lineNumber}</Text>
              <Text style={[s.td, s.colCode]}>{item.code ?? '--'}</Text>
              <Text style={[s.td, s.colDesc]}>{item.description}</Text>
              <Text style={[s.td, s.colQty]}>{item.quantity.toFixed(2)}</Text>
              <Text style={[s.td, s.colUnit]}>{item.unit}</Text>
              <Text style={[s.td, s.colWeight]}>
                {item.weightKg != null ? item.weightKg.toFixed(2) : '--'}
              </Text>
              <Text style={[s.td, s.colDim]}>{item.dimensions ?? '--'}</Text>
              <Text style={[s.td, s.colPkg]}>{item.packaging ?? 'Unidad'}</Text>
              <Text style={[s.td, s.colPrice]}>
                {item.unitPrice != null
                  ? (item.unitPrice * item.quantity).toFixed(2)
                  : '--'}
              </Text>
            </View>
          ))}

          {/* Summary */}
          <View style={s.tableSummary}>
            <Text style={s.tableSummaryText}>
              Cantidad Total de Ítems: {data.items.length}
              {'   '}Unidades totales: {totalItems.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ── Conditions + Totals ── */}
        <View style={s.bottomRow}>
          {/* Conditions */}
          <View style={s.condPanel}>
            <Text style={s.condTitle}>Condiciones de Transporte</Text>
            <View style={s.condRow}>
              <Text style={s.condLabel}>Modo:</Text>
              <Text style={s.condValue}>{data.shippingMode ?? 'Terrestre'}</Text>
            </View>
            {data.incoterm && (
              <View style={s.condRow}>
                <Text style={s.condLabel}>Incoterm:</Text>
                <Text style={s.condValue}>
                  {data.incoterm} —{' '}
                  {INCOTERM_LABELS[data.incoterm] ?? data.incoterm}
                </Text>
              </View>
            )}
            <View style={s.condRow}>
              <Text style={s.condLabel}>Temp. controlada:</Text>
              <Text style={s.condValue}>{data.controlledTemp ? 'Sí' : 'No'}</Text>
            </View>
            <View style={s.condRow}>
              <Text style={s.condLabel}>Mat. peligrosos:</Text>
              <Text style={s.condValue}>{data.hazardousMat ? 'Sí' : 'No'}</Text>
            </View>
            {data.notes && (
              <View style={s.condRow}>
                <Text style={s.condLabel}>Instrucciones:</Text>
                <Text style={s.condValue}>{data.notes}</Text>
              </View>
            )}
          </View>

          {/* Totals */}
          <View style={s.totalsPanel}>
            <Text style={s.totalsTitle}>Totales (B/.)</Text>
            {hasTotals ? (
              <>
                {data.subtotal != null && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Subtotal mercancía:</Text>
                    <Text style={s.totalValue}>{fmt(data.subtotal)}</Text>
                  </View>
                )}
                {data.taxAmount != null && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>
                      Impuestos (ITBMS {data.taxPercent != null ? `${(data.taxPercent * 100).toFixed(0)}%` : ''}):
                    </Text>
                    <Text style={s.totalValue}>{fmt(data.taxAmount)}</Text>
                  </View>
                )}
                {data.shippingCost != null && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Costo de flete:</Text>
                    <Text style={s.totalValue}>{fmt(data.shippingCost)}</Text>
                  </View>
                )}
                {data.insuranceCost != null && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Seguro:</Text>
                    <Text style={s.totalValue}>{fmt(data.insuranceCost)}</Text>
                  </View>
                )}
                <View style={s.grandTotalRow}>
                  <Text style={s.grandTotalLabel}>Total orden:</Text>
                  <Text style={s.grandTotalValue}>
                    {fmt(
                      data.totalAmount ??
                        (data.subtotal ?? 0) + (data.taxAmount ?? 0) + (data.shippingCost ?? 0) + (data.insuranceCost ?? 0)
                    )}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 4 }}>
                Sin valoración económica registrada
              </Text>
            )}
          </View>
        </View>

        {/* ── POD Signatures ── */}
        <View style={s.podHeader}>
          <Text style={s.sectionTitle}>Acuse de Recibo (Prueba de Entrega / POD)</Text>
        </View>
        <View style={s.podRow}>
          <View style={s.podCell}>
            <Text style={s.podLabel}>Despachado por:</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Nombre y firma del remitente</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Fecha/Hora: ____/____/______  ____:____</Text>
          </View>
          <View style={s.podCell}>
            <Text style={s.podLabel}>Transportado por:</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Nombre y firma del conductor</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Fecha/Hora: ____/____/______  ____:____</Text>
          </View>
          <View style={s.podCellLast}>
            <Text style={s.podLabel}>Recibido por:</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Nombre y firma del destinatario</Text>
            <View style={s.podLine} />
            <Text style={s.podLineLabel}>Fecha/Hora: ____/____/______  ____:____</Text>
          </View>
        </View>

        {/* ── QR Tracking ── */}
        {data.qrDataUrl && (
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginBottom: 4, padding: 8, alignItems: 'center' }}>
            <Image src={data.qrDataUrl} style={{ width: 72, height: 72 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: C.value, marginBottom: 3 }}>
                Código QR de Rastreo
              </Text>
              <Text style={{ fontSize: 7, color: C.muted, marginBottom: 2 }}>
                Escanee este código con su teléfono para verificar el estado de la entrega en tiempo real.
              </Text>
              {data.trackingUrl && (
                <Text style={{ fontSize: 6.5, color: C.label }}>
                  {data.trackingUrl}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Observations ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Observaciones / Condición de la mercancía al momento de entrega</Text>
        </View>
        <View style={s.obsBlock}>
          <Text style={{ fontSize: 7.5, color: C.muted }}>
            {data.notes ?? ' '}
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Documento generado conforme a estándares logísticos de Panamá (Ley 51/2017) e internacionales (Incoterms® ICC, WTO).{'\n'}
            Este documento no tiene valor fiscal. Para efectos fiscales consulte la factura electrónica asociada en https://dgi-fep.mef.gob.pa
          </Text>
          <Text style={s.footerPage}>Pág. 1 de 1</Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Incoterm descriptions ────────────────────────────────────────────────────

const INCOTERM_LABELS: Record<string, string> = {
  DAP: 'Entregado en Lugar (Delivered at Place)',
  DDP: 'Entregado con Derechos Pagados',
  DAT: 'Entregado en Terminal',
  FOB: 'Franco a Bordo',
  CIF: 'Costo, Seguro y Flete',
  CFR: 'Costo y Flete',
  EXW: 'En Fábrica',
  FCA: 'Franco Transportista',
  CPT: 'Transporte Pagado Hasta',
  CIP: 'Transporte y Seguro Pagados Hasta',
  DPU: 'Entregado en lugar, Descargado',
  FAS: 'Franco al Costado del Buque',
}
