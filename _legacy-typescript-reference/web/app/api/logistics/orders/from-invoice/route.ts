import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createFromInvoice } from "@/features/logistics/model/services/delivery-order.service"

const fromInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  customerName: z.string().optional(),
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
  carrierId: z.string().optional(),
  driverId: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  const userId = session.user.id
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  try {
    const body = await request.json()
    const parsed = fromInvoiceSchema.safeParse(body)
    
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
      customerEmail: parsed.data.customerEmail || undefined,
    }

    const order = await createFromInvoice(clientId, userId, input)
    return NextResponse.json(order, { status: 201 })
  } catch (error: unknown) {
    console.error("[LOGISTICS_ORDER_FROM_INVOICE] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Error al procesar la solicitud"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
