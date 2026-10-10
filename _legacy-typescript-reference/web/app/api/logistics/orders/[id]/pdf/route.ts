/**
 * GET /api/logistics/orders/[id]/pdf
 * Generates a PDF for a specific Delivery Order and returns it as a binary response.
 * Also persists the generation event in delivery_events (REGLA 10).
 *
 * Response: application/pdf stream
 */

import { auth } from '@core/auth'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import ReactPDF from '@react-pdf/renderer'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { prismaServer as prisma } from '@core/database'
import { DeliveryOrderPDF, DeliveryOrderPDFData } from '@/features/logistics/ui/pdf/DeliveryOrderPDF'
import { CommercialOrderPDF } from '@/features/logistics/ui/pdf/CommercialOrderPDF'
import { SimpleOrderPDF } from '@/features/logistics/ui/pdf/SimpleOrderPDF'

/**
 * @react-pdf/renderer only supports JPEG and PNG images.
 * WebP (or any other format stored as data URL) must be converted to JPEG first.
 */
async function toJpegDataUrl(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null
  try {
    const match = dataUrl.match(/^data:image\/[\w+]+;base64,(.+)$/)
    if (!match) return null
    // If it's already a JPEG or PNG data URL, react-pdf can handle it — still re-encode
    // through sharp to guarantee valid output and strip any unsupported metadata.
    const buf = Buffer.from(match[1], 'base64')
    const jpeg = await sharp(buf)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

const TEMPLATE_COMPONENTS = {
  logistics: DeliveryOrderPDF,
  commercial: CommercialOrderPDF,
  simple: SimpleOrderPDF,
} as const

type TemplateKey = keyof typeof TEMPLATE_COMPONENTS

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  IN_PICKING: 'En Preparación',
  READY_TO_SHIP: 'Listo para Envío',
  IN_TRANSIT: 'En Tránsito',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
  }

  const { id } = await params

  // ── Resolve template ──
  const templateParam = request.nextUrl.searchParams.get('template') || 'logistics'
  const templateKey: TemplateKey = (templateParam in TEMPLATE_COMPONENTS)
    ? templateParam as TemplateKey
    : 'logistics'
  const TemplateComponent = TEMPLATE_COMPONENTS[templateKey]

  // ── Load order with all needed details ──
  const order = await prisma.deliveryOrder.findFirst({
    where: { id, clientId },
    include: {
      items: { orderBy: { id: 'asc' } },
      client: {
        select: {
          name: true,
          ruc: true,
          dv: true,
          address: true,
          province: true,
          district: true,
          phone: true,
          email: true,
          logo: true,
        },
      },
      carrier: { select: { name: true } },
      driver: { select: { firstName: true, lastName: true, phone: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // ── Build PDF data ──
  const issueDate = new Date(order.createdAt).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Panama',
  })

  const address = order.deliveryAddress as { text?: string } | null

  // Resolve logo: prefer user's profile image, fallback to client logo.
  // Then convert to JPEG — react-pdf only supports JPEG/PNG, not WebP.
  let logo: string | null = null
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    })
    const raw = user?.image || order.client.logo || null
    logo = await toJpegDataUrl(raw)
  } catch {
    logo = await toJpegDataUrl(order.client.logo || null)
  }

  const pdfData: DeliveryOrderPDFData = {
    logo,
    orderCode: order.code,
    invoiceRef: (order as { linkedInvoiceId?: string | null }).linkedInvoiceId
      ? `Factura adjunta`
      : null,
    purchaseOrderRef: order.purchaseOrderRef ?? null,
    issueDate,
    priority: order.priority ?? 'Normal',
    status: STATUS_LABELS[order.status] ?? order.status,
    branchPoint: '0000/001',

    // Sender (company/tenant)
    senderName: order.client.name,
    senderRuc: order.client.ruc ?? null,
    senderDv: order.client.dv ?? null,
    senderAddress: order.client.address ?? null,
    senderLocation: order.client.province
      ? `${order.client.district ?? ''}, ${order.client.province}`
      : null,
    senderPhone: order.client.phone ?? null,
    senderEmail: order.client.email ?? null,

    // Receiver
    receiverName: order.customerName,
    receiverRuc: order.customerRuc ?? null,
    receiverPhone: order.customerPhone ?? null,
    receiverEmail: order.customerEmail ?? null,
    receiverAddress: address?.text ?? order.deliveryLocation ?? null,
    receiverLocation: order.deliveryLocation ?? null,

    // Transport
    carrierName: order.carrierName ?? order.carrier?.name ?? null,
    driverName: order.driverName ?? (order.driver
      ? `${order.driver.firstName} ${order.driver.lastName}`
      : null),
    driverLicense: order.driverLicense ?? null,
    vehiclePlate: order.vehiclePlate ?? null,
    driverIdDoc: order.driverIdDoc ?? null,
    insurancePolicy: order.insurancePolicy ?? null,

    // Items
    items: order.items.map((item, idx) => ({
      lineNumber: idx + 1,
      code: item.productId ?? null,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.packaging ?? 'und',
      weightKg: item.weightKg ? Number(item.weightKg) : null,
      dimensions: item.dimensions ?? null,
      packaging: item.packaging ?? 'Unidad',
      unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
    })),

    // Totals
    subtotal: order.subtotal ? Number(order.subtotal) : null,
    taxAmount: order.taxAmount ? Number(order.taxAmount) : null,
    taxPercent: 0.07,
    shippingCost: order.shippingCost ? Number(order.shippingCost) : null,
    insuranceCost: order.insuranceCost ? Number(order.insuranceCost) : null,
    totalAmount: order.totalAmount ? Number(order.totalAmount) : null,

    // Conditions
    shippingMode: order.shippingMode ?? 'Terrestre',
    incoterm: order.incoterm ?? null,
    controlledTemp: order.controlledTemp ?? false,
    hazardousMat: order.hazardousMat ?? false,
    notes: order.notes ?? null,
  }

  // Generate QR code data URL for tracking
  if (order.qrToken) {
    const baseUrl = request.headers.get('origin')
      || request.headers.get('x-forwarded-host')
        ? `https://${request.headers.get('x-forwarded-host')}`
        : 'https://app.plentypay.com'
    const trackingUrl = `${baseUrl}/track/${order.qrToken}`
    try {
      pdfData.qrDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
      pdfData.trackingUrl = trackingUrl
    } catch {
      // QR generation failed silently — PDF still works without it
    }
  }

  // ── Generate PDF using @react-pdf/renderer ──
  // Helper to render one attempt
  async function renderPdf(data: DeliveryOrderPDFData): Promise<Buffer> {
    const element = React.createElement(TemplateComponent, { data })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await ReactPDF.renderToStream(element as any)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  try {
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await renderPdf(pdfData)
    } catch (imgErr) {
      // If PDF fails (likely malformed image), retry without logo
      console.warn('[LOGISTICS_PDF] Retrying without logo:', imgErr)
      pdfBuffer = await renderPdf({ ...pdfData, logo: null })
    }

    // ── Log PDF generation event (REGLA 10) ──
    // Fire-and-forget: don't block the response on this
    prisma.deliveryEvent
      .create({
        data: {
          deliveryOrderId: id,
          eventType: 'PDF_GENERATED',
          actorType: 'USER',
          actorId: session.user.id,
          actorName: session.user.name ?? 'Usuario',
          metadata: {
            sizeBytes: pdfBuffer.byteLength,
            generatedAt: new Date().toISOString(),
          },
        },
      })
      .catch((e) => console.error('[PDF] Failed to log event:', e))

    // ── Return PDF as binary response ──
    // Cast a Uint8Array para satisfacer BodyInit en Node 22+ (Buffer<ArrayBufferLike>
    // no es estrictamente asignable a BodyInit aunque en runtime funciona).
    const filename = `OE-${order.code.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[LOGISTICS_PDF] Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Error al generar el PDF de la orden de entrega' },
      { status: 500 }
    )
  }
}
