import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"
import { createChargeIntent } from "@/lib/payments/orchestrator-client"

/**
 * POST /api/mobile/v1/payments
 * Body: { terminalCode, amountCents, rail, idempotencyKey }
 *
 * El pagador (usuario autenticado en la app) paga a una terminal de un comercio. El cobro se crea en
 * payments-orchestrator con tenantId = comercio dueño de la terminal.
 *
 * ⚠️ Mientras los adaptadores de rieles (Yappy/TELERED/PSP) no tengan credenciales reales, el
 * orquestador responde en MODO SIMULADO y esta ruta lo indica con `sandbox: true`: NO se mueve dinero.
 */

const ALLOWED_RAILS = new Set(["YAPPY", "TELERED_CLAVE", "CARD_VISA", "CARD_MASTERCARD"])
const MAX_AMOUNT_CENTS = 500_000 // $5,000.00 por operación — ajustar con Riesgo/Cumplimiento (documento 03)

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const payer = token ? await verifyMobileJwt(token) : null
  if (!payer) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const terminalCode = typeof body?.terminalCode === "string" ? body.terminalCode : ""
  const rail = typeof body?.rail === "string" ? body.rail : ""
  const clientKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : ""
  const amountCents = body?.amountCents

  if (!/^[A-Za-z0-9_-]{8,64}$/.test(terminalCode)) {
    return NextResponse.json({ error: "terminalCode inválido" }, { status: 400 })
  }
  if (!ALLOWED_RAILS.has(rail)) {
    return NextResponse.json({ error: `rail no permitido. Usa: ${[...ALLOWED_RAILS].join(", ")}` }, { status: 400 })
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
    return NextResponse.json({ error: "amountCents debe ser un entero positivo dentro del límite por operación" }, { status: 400 })
  }
  if (clientKey.length < 16 || clientKey.length > 100) {
    return NextResponse.json({ error: "idempotencyKey debe tener entre 16 y 100 caracteres (usa un UUID)" }, { status: 400 })
  }

  const terminal = await prisma.paymentTerminal.findUnique({
    where: { publicCode: terminalCode },
    include: { client: { select: { isActive: true } } },
  })
  if (!terminal || !terminal.isActive || !terminal.client.isActive) {
    return NextResponse.json({ error: "Terminal no disponible" }, { status: 404 })
  }

  try {
    const intent = await createChargeIntent({
      tenantId: terminal.clientId,
      amountCents,
      currency: "USD",
      rail,
      // Se prefija con el pagador: dos pagadores distintos nunca comparten clave de idempotencia
      // (evita que uno lea o reutilice el resultado de otro adivinando una clave).
      idempotencyKey: `${payer.sub}:${clientKey}`,
      reference: `terminal:${terminal.publicCode}`,
      metadata: { payerUserId: payer.sub, terminalId: terminal.id },
    })
    return NextResponse.json(intent)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    // Idempotencia rechazada por payload distinto = error del cliente, no del servidor.
    const status = message.includes("ya se usó con un payload distinto") ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
