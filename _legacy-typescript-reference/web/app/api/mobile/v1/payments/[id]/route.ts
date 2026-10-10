import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * GET /api/mobile/v1/payments/:id
 * Estado de un pago. Solo lo puede consultar quien lo creó (payerUserId en metadata de la intención).
 * Lectura directa de la tabla compartida (fase de transición, documento 02 §3): nunca escribe.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const payer = token ? await verifyMobileJwt(token) : null
  if (!payer) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { intent: true, attempts: { orderBy: { attemptNumber: "desc" }, take: 1 } },
  })

  const metadata = (payment?.intent.metadata ?? {}) as { payerUserId?: string }
  // 404 (no 403) tanto si no existe como si es de otro: no revelar qué IDs existen.
  if (!payment || metadata.payerUserId !== payer.sub) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
  }

  const attempt = payment.attempts[0]
  const raw = (attempt?.rawResponse ?? {}) as Record<string, unknown>
  return NextResponse.json({
    transactionId: payment.id,
    status: payment.status,
    sandbox: raw.sandbox === true,
    nextActionUrl: typeof raw.nextActionUrl === "string" ? raw.nextActionUrl : "",
    nextActionQrPayload: typeof raw.nextActionQrPayload === "string" ? raw.nextActionQrPayload : "",
    failureReason: attempt?.failureCode ?? "",
  })
}
