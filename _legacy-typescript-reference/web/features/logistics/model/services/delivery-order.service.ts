import { prismaServer as prisma } from '@core/database'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import {
  CreateDeliveryOrderInput,
  CreateFromInvoiceInput,
  UpdateDeliveryOrderInput,
  UpdateStatusInput,
  DeliveryOrderListItem,
  DeliveryOrderDetail,
  DeliveryOrderItemInput,
  DeliveryOrderStatus,
  DeliveryAddress,
} from '@/features/logistics/model/types'
import { InventoryRepository } from '@/features/inventory/model/repositories/inventory.repository'

const inventoryRepo = new InventoryRepository()

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function generateOrderCode(clientId: string, tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `OE-${year}-`
  const last = await tx.deliveryOrder.findFirst({
    where: { clientId, code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })
  let seq = 1
  if (last?.code) {
    const n = parseInt(last.code.slice(prefix.length), 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefix}${String(seq).padStart(6, '0')}`
}

function computeTotals(items: DeliveryOrderItemInput[]) {
  let subtotal = 0
  let taxTotal = 0
  const processedItems = items.map((item) => {
    const unitPrice = item.unitPrice ?? 0
    const qty = item.quantity
    const net = unitPrice * qty
    const taxRate = item.taxRate ?? 0
    const tax = parseFloat((net * taxRate).toFixed(2))
    const line = parseFloat((net + tax).toFixed(2))
    subtotal += net
    taxTotal += tax
    return { ...item, computedTaxAmount: tax, computedLineTotal: line }
  })
  subtotal = parseFloat(subtotal.toFixed(2))
  taxTotal = parseFloat(taxTotal.toFixed(2))
  const total = parseFloat((subtotal + taxTotal).toFixed(2))
  return { subtotal, taxTotal, total, processedItems }
}

function generateQrToken(orderCode: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderCode}-${Date.now()}`)
    .digest('hex')
}

/**
 * Parse "LxAxH" or "L×A×H" dimension string → volumetric weight (kg).
 * Formula: (L × A × H) / 5000
 */
function computeVolWeight(dimensions: string | undefined | null): number | null {
  if (!dimensions) return null
  const parts = dimensions.split(/[xX×*]/gi).map((p) => parseFloat(p.trim()))
  if (parts.length < 3 || parts.some(isNaN)) return null
  const [l, a, h] = parts
  return parseFloat(((l * a * h) / 5000).toFixed(2))
}

/**
 * Generate auto-SKU: [CAT3]-[DESC3]-[CORRELATIVE]
 * e.g. ROA-ZAP-000042
 */
function generateAutoSku(category: string | undefined | null, description: string, seq: number): string {
  const cat = (category ?? 'GEN').slice(0, 3).toUpperCase()
  const desc = description
    .replace(/[^a-zA-ZÀ-ÿ0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')
  return `${cat}-${desc}-${String(seq).padStart(6, '0')}`
}

/**
 * SHA-256 fingerprint over sku+price+taxRate+description
 */
function computeItemHash(sku: string, description: string, unitPrice: number | undefined, taxRate: number | undefined): string {
  const payload = `${sku}|${description}|${unitPrice ?? 0}|${taxRate ?? 0}`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

async function logEvent(
  tx: Prisma.TransactionClient,
  deliveryOrderId: string,
  event: {
    eventType: string
    fromStatus?: string
    toStatus?: string
    actorType: string
    actorId?: string
    actorName?: string
    metadata?: Prisma.InputJsonValue
  }
) {
  await tx.deliveryEvent.create({
    data: {
      deliveryOrderId,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      actorId: event.actorId,
      actorName: event.actorName,
      metadata: event.metadata || {},
    },
  })
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export async function listDeliveryOrders(
  clientId: string,
  filters?: { status?: string; search?: string }
): Promise<DeliveryOrderListItem[]> {
  const where: Prisma.DeliveryOrderWhereInput = { clientId }
  if (filters?.status) where.status = filters.status as DeliveryOrderStatus
  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const orders = await prisma.deliveryOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      status: true,
      originMode: true,
      customerName: true,
      deliveryAddress: true,
      carrier: { select: { id: true, name: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
      totalAmount: true,
      createdAt: true,
    },
  })

  return orders.map((o) => ({
    ...o,
    deliveryAddress: o.deliveryAddress as DeliveryAddress | null,
    totalAmount: o.totalAmount?.toString() ?? null,
  }))
}

export async function getDeliveryOrderById(
  id: string,
  clientId: string
): Promise<DeliveryOrderDetail | null> {
  const order = await prisma.deliveryOrder.findFirst({
    where: { id, clientId },
    include: {
      carrier: { select: { id: true, name: true } },
      driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
      items: {
        orderBy: { id: 'asc' },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    deliveryAddress: order.deliveryAddress as DeliveryAddress | null,
    subtotal: order.subtotal?.toString() ?? null,
    taxAmount: order.taxAmount?.toString() ?? null,
    totalAmount: order.totalAmount?.toString() ?? null,
    items: order.items.map((i) => ({
      ...i,
      quantity: i.quantity.toString(),
      unitPrice: i.unitPrice?.toString() ?? null,
      taxRate: i.taxRate?.toString() ?? null,
      taxAmount: i.taxAmount?.toString() ?? null,
      lineTotal: i.lineTotal?.toString() ?? null,
      weightKg: i.weightKg?.toString() ?? null,
      volWeight: i.volWeight?.toString() ?? null,
      categoryMeta: i.categoryMeta as Record<string, string | number | null> | null,
    })),
    statusHistory: order.statusHistory.map((h) => ({
      ...h,
      fromStatus: h.fromStatus as DeliveryOrderStatus | null,
      toStatus: h.toStatus as DeliveryOrderStatus,
    })),
  } as DeliveryOrderDetail
}

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export async function createDeliveryOrder(
  clientId: string,
  userId: string,
  input: CreateDeliveryOrderInput
): Promise<{ id: string; code: string }> {
  const { subtotal, taxTotal, total, processedItems } = computeTotals(input.items)
  const hasPrice = input.items.some((i) => i.unitPrice != null)

  const order = await prisma.$transaction(async (tx) => {
    const code = await generateOrderCode(clientId, tx)
    const client = await tx.client.findFirst({
      where: { id: clientId },
      select: { logisticsSecret: true, name: true },
    })
    const secret = client?.logisticsSecret || 'default-secret'
    const qrToken = generateQrToken(code, secret)

    const created = await tx.deliveryOrder.create({
      data: {
        clientId,
        code,
        qrToken,
        status: 'PENDING',
        originMode: 'DIRECT',
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        deliveryAddress: (input.deliveryAddress as unknown as Prisma.InputJsonValue) ?? undefined,
        scheduledDate: input.scheduledDate ?? null,
        estimatedDate: input.estimatedDate ?? null,
        carrierId: input.carrierId ?? null,
        driverId: input.driverId ?? null,
        notes: input.notes ?? null,
        priority: input.priority || "Normal",
        purchaseOrderRef: input.purchaseOrderRef ?? null,
        customerRuc: input.customerRuc ?? null,
        deliveryLocation: input.deliveryLocation ?? null,
        carrierName: input.carrierName ?? null,
        driverName: input.driverName ?? null,
        driverIdDoc: input.driverIdDoc ?? null,
        driverLicense: input.driverLicense ?? null,
        vehiclePlate: input.vehiclePlate ?? null,
        insurancePolicy: input.insurancePolicy ?? null,
        shippingMode: input.shippingMode || "Terrestre",
        incoterm: input.incoterm ?? null,
        controlledTemp: input.controlledTemp ?? false,
        hazardousMat: input.hazardousMat ?? false,
        shippingCost: input.shippingCost ?? null,
        insuranceCost: input.insuranceCost ?? null,
        emitInvoice: input.emitInvoice ?? false,
        subtotal: hasPrice ? subtotal : null,
        taxAmount: hasPrice ? taxTotal : null,
        totalAmount: hasPrice ? total : null,
        createdById: userId,
        items: {
          create: processedItems.map((item, idx) => {
            const sku = item.sku?.trim() || generateAutoSku(item.category, item.description, idx + 1)
            const volWeight = computeVolWeight(item.dimensions)
            const itemHash = computeItemHash(sku, item.description, item.unitPrice, item.taxRate)
            return {
              productId: item.productId ?? null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? null,
              taxRate: item.taxRate ?? null,
              taxAmount: item.unitPrice != null ? item.computedTaxAmount : null,
              lineTotal: item.unitPrice != null ? item.computedLineTotal : null,
              packaging: item.packaging ?? null,
              weightKg: item.weightKg ?? null,
              dimensions: item.dimensions ?? null,
              // Category fields
              category: item.category ?? null,
              sku,
              barcode: item.barcode ?? null,
              umc: item.umc ?? null,
              cpbsCode: item.cpbsCode ?? null,
              categoryMeta: (item.categoryMeta as Prisma.InputJsonValue) ?? undefined,
              volWeight: volWeight ?? null,
              itemHash,
            }
          }),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING',
            notes: 'Orden creada manualmente',
            changedById: userId,
          },
        },
      },
      select: { id: true, code: true },
    })

    await logEvent(tx, created.id, {
      eventType: 'ORDER_CREATED',
      toStatus: 'PENDING',
      actorType: 'USER',
      actorId: userId,
      actorName: 'Usuario',
      metadata: { input: input as unknown as Prisma.InputJsonValue },
    })

    return created
  })

  // ─── Descuento de inventario (fuera de la transacción principal) ───
  const itemsWithProduct = input.items.filter((i) => i.productId)
  if (itemsWithProduct.length > 0) {
    let allDeducted = true
    const deductionResults: Record<string, unknown>[] = []

    for (const item of itemsWithProduct) {
      try {
        const result = await inventoryRepo.reserveStockWithOCC(
          item.productId!,
          item.quantity,
          order.id,
          'DeliveryOrder',
          userId
        )
        deductionResults.push({
          productId: item.productId,
          qty: item.quantity,
          movementId: result.movementId,
          ok: true,
        })
      } catch (err: unknown) {
        allDeducted = false
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        deductionResults.push({ productId: item.productId, qty: item.quantity, ok: false, error: msg })
        console.error(`[Logistics] No se pudo descontar inventario para producto ${item.productId}:`, msg)
      }
    }

    await prisma.deliveryOrder.update({
      where: { id: order.id },
      data: { inventoryDeducted: allDeducted },
    })

    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: order.id,
        eventType: 'INVENTORY_DEDUCTED',
        actorType: 'SYSTEM',
        actorId: userId,
        metadata: { results: deductionResults, allDeducted } as Prisma.InputJsonValue,
      },
    })
  }

  return order
}


export async function createFromInvoice(
  clientId: string,
  userId: string,
  input: CreateFromInvoiceInput
): Promise<{ id: string; code: string }> {
  // Load invoice with items
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, clientId },
    include: {
      items: true,
      customer: true,
    },
  })

  if (!invoice) throw new Error('Factura no encontrada')

  return prisma.$transaction(async (tx) => {
    const code = await generateOrderCode(clientId, tx)
    const client = await tx.client.findFirst({
      where: { id: clientId },
      select: { logisticsSecret: true, name: true },
    })
    const secret = client?.logisticsSecret || 'default-secret'
    const qrToken = generateQrToken(code, secret)

    const order = await tx.deliveryOrder.create({
      data: {
        clientId,
        code,
        qrToken,
        status: 'PENDING',
        originMode: 'FROM_INVOICE',
        linkedInvoiceId: invoice.id,
        customerName: input.customerName ?? (invoice.customer as unknown as { name: string })?.name ?? 'Sin nombre',
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        deliveryAddress: (input.deliveryAddress as unknown as Prisma.InputJsonValue) ?? undefined,
        scheduledDate: input.scheduledDate ?? null,
        carrierId: input.carrierId ?? null,
        driverId: input.driverId ?? null,
        notes: input.notes ?? null,
        emitInvoice: false,
        subtotal: (invoice as unknown as { subtotal: Prisma.Decimal | string }).subtotal?.toString() ?? null,
        taxAmount: (invoice as unknown as { taxAmount: Prisma.Decimal | string }).taxAmount?.toString() ?? null,
        totalAmount: (invoice as unknown as { total: Prisma.Decimal | string }).total?.toString() ?? null,
        createdById: userId,
        items: {
          create: invoice.items.map((item) => ({
            productId: item.productId ?? null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
            taxRate: item.taxRate ?? null,
            taxAmount: item.taxAmount ?? null,
            lineTotal: item.total ?? null,
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING',
            notes: `Creada desde factura ${(invoice as unknown as { invoiceNumber: string }).invoiceNumber ?? invoice.id}`,
            changedById: userId,
          },
        },
      },
      select: { id: true, code: true },
    })

    await logEvent(tx, order.id, {
      eventType: 'ORDER_CREATED_FROM_INVOICE',
      toStatus: 'PENDING',
      actorType: 'USER',
      actorId: userId,
      metadata: { invoiceId: invoice.id, invoiceNumber: (invoice as unknown as { invoiceNumber: string }).invoiceNumber },
    })

    return order
  })
}

export async function updateDeliveryOrder(
  id: string,
  clientId: string,
  input: UpdateDeliveryOrderInput
): Promise<void> {
  await prisma.deliveryOrder.updateMany({
    where: { id, clientId },
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      deliveryAddress: (input.deliveryAddress as unknown as Prisma.InputJsonValue) ?? undefined,
      scheduledDate: input.scheduledDate,
      estimatedDate: input.estimatedDate,
      carrierId: input.carrierId,
      driverId: input.driverId,
      notes: input.notes,
      internalNotes: input.internalNotes,
      emitInvoice: input.emitInvoice,
    },
  })
}

export async function updateOrderStatus(
  id: string,
  clientId: string,
  userId: string,
  input: UpdateStatusInput
): Promise<void> {
  const current = await prisma.deliveryOrder.findFirst({
    where: { id, clientId },
    select: { status: true },
  })
  if (!current) throw new Error('Orden no encontrada')

  const updateData: Prisma.DeliveryOrderUpdateInput = { status: input.status }
  if (input.status === 'DELIVERED') {
    updateData.deliveredAt = new Date()
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryOrder.updateMany({
      where: { id, clientId },
      data: updateData,
    })
    await tx.deliveryOrderStatusHistory.create({
      data: {
        deliveryOrderId: id,
        fromStatus: current.status as DeliveryOrderStatus,
        toStatus: input.status as DeliveryOrderStatus,
        notes: input.notes ?? null,
        changedById: userId,
      },
    })
    await logEvent(tx, id, {
      eventType: 'STATUS_CHANGE',
        fromStatus: current.status as DeliveryOrderStatus,
        toStatus: input.status as DeliveryOrderStatus,
      actorType: 'USER',
      actorId: userId,
      metadata: { notes: input.notes },
    })
  })
}

export async function assignQrToken(id: string, clientId: string): Promise<string> {
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { logisticsSecret: true, name: true },
  })
  const order = await prisma.deliveryOrder.findFirst({
    where: { id, clientId },
    select: { code: true },
  })
  if (!order) throw new Error('Orden no encontrada')

  const secret = client?.logisticsSecret || 'default-secret'
  const token = generateQrToken(order.code, secret)
  await prisma.deliveryOrder.updateMany({
    where: { id, clientId },
    data: { qrToken: token },
  })
  return token
}
