import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import { updateOrderStatus } from "@/features/logistics/model/services/delivery-order.service"
import { z } from "zod"

const VALID_STATUSES = [
  "DRAFT", "PENDING", "IN_PICKING", "READY_TO_SHIP",
  "IN_TRANSIT", "DELIVERED", "CANCELLED",
] as const

const schema = z.object({
  status: z.enum(VALID_STATUSES),
  notes: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  const userId = session.user.id
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 422 })
  }

  try {
    const { id } = await params
    await updateOrderStatus(id, clientId, userId, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
