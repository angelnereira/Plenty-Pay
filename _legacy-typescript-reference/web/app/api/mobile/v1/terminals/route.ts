import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * POST /api/mobile/v1/terminals   Body: { label }
 * Crea una terminal de cobro del comercio (tenant) del usuario autenticado.
 * Devuelve su publicCode: lo ÚNICO que va en el QR y en el tag NFC.
 *
 * TODO(permisos): exigir un permiso explícito (p. ej. "payments:manage" en TeamRole) en vez de
 * "cualquier usuario del tenant". Riesgo actual acotado: una terminal solo puede COBRAR a favor
 * del propio tenant, nunca redirigir fondos a otro.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const payload = token ? await verifyMobileJwt(token) : null
  if (!payload || !payload.clientId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : ""
  if (!label) return NextResponse.json({ error: "label es obligatorio" }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: payload.clientId }, select: { name: true, isActive: true } })
  if (!client?.isActive) return NextResponse.json({ error: "Organización inactiva" }, { status: 403 })

  // 12 bytes aleatorios → 16 caracteres base64url: no adivinable, cumple ^[A-Za-z0-9_-]{8,64}$ de la app.
  const publicCode = randomBytes(12).toString("base64url")

  const terminal = await prisma.paymentTerminal.create({
    data: { clientId: payload.clientId, publicCode, label, createdById: payload.sub },
  })

  return NextResponse.json(
    { publicCode: terminal.publicCode, label: terminal.label, merchantName: client.name, isActive: terminal.isActive },
    { status: 201 }
  )
}
