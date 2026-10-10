import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import {
  getDeliveryOrderById,
  updateDeliveryOrder,
} from "@/features/logistics/model/services/delivery-order.service"
import { z } from "zod"

const updateSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  deliveryAddress: z
    .object({ text: z.string(), lat: z.number().optional(), lng: z.number().optional() })
    .optional(),
  scheduledDate: z.string().datetime().optional(),
  estimatedDate: z.string().datetime().optional(),
  carrierId: z.string().optional(),
  driverId: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  emitInvoice: z.boolean().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const { id } = await params
  const order = await getDeliveryOrderById(id, clientId)
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json(order)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 422 })
  }

  const { id } = await params
  await updateDeliveryOrder(id, clientId, {
    ...parsed.data,
    scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
    estimatedDate: parsed.data.estimatedDate ? new Date(parsed.data.estimatedDate) : undefined,
    customerEmail: parsed.data.customerEmail || undefined,
  })

  return NextResponse.json({ ok: true })
}
