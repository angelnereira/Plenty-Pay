import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import {
  listDeliveryOrders,
  createDeliveryOrder,
} from "@/features/logistics/model/services/delivery-order.service"

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  packaging: z.string().optional(),
  weightKg: z.number().optional(),
  dimensions: z.string().optional(),
  // Category classification fields
  category: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  umc: z.string().optional(),
  cpbsCode: z.string().optional(),
  categoryMeta: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
})

const createSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  deliveryAddress: z
    .object({
      text: z.string(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
  scheduledDate: z.string().datetime().optional(),
  estimatedDate: z.string().datetime().optional(),
  carrierId: z.string().optional(),
  driverId: z.string().optional(),
  notes: z.string().optional(),
  emitInvoice: z.boolean().optional(),
  items: z.array(itemSchema).min(1),
  
  // New API fields for Loguistics Order Manual Capture
  priority: z.string().optional(),
  purchaseOrderRef: z.string().optional(),
  customerRuc: z.string().optional(),
  deliveryLocation: z.string().optional(),
  carrierName: z.string().optional(),
  driverName: z.string().optional(),
  driverIdDoc: z.string().optional(),
  driverLicense: z.string().optional(),
  vehiclePlate: z.string().optional(),
  insurancePolicy: z.string().optional(),
  shippingMode: z.string().optional(),
  incoterm: z.string().optional(),
  controlledTemp: z.boolean().optional(),
  hazardousMat: z.boolean().optional(),
  shippingCost: z.number().optional(),
  insuranceCost: z.number().optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") ?? undefined
  const search = searchParams.get("search") ?? undefined

  const orders = await listDeliveryOrders(clientId, { status, search })
  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  const userId = session.user.id
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 422 }
    )
  }

  const input = {
    ...parsed.data,
    scheduledDate: parsed.data.scheduledDate
      ? new Date(parsed.data.scheduledDate)
      : undefined,
    estimatedDate: parsed.data.estimatedDate
      ? new Date(parsed.data.estimatedDate)
      : undefined,
    customerEmail: parsed.data.customerEmail || undefined,
  }

  const order = await createDeliveryOrder(clientId, userId, input)
  return NextResponse.json(order, { status: 201 })
}
