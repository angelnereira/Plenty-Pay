import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * GET /api/mobile/v1/terminals/:code
 * Resuelve el código opaco de un QR/tag NFC al nombre VERIFICADO del comercio. Es lo que la app
 * muestra antes de pedir la confirmación biométrica: un tag regrabado o un sticker encima solo
 * puede apuntar a otra terminal real, y el pagador ve a quién le va a pagar.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const payload = token ? await verifyMobileJwt(token) : null
  if (!payload) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { code } = await params
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
    return NextResponse.json({ error: "Código de terminal inválido" }, { status: 400 })
  }

  const terminal = await prisma.paymentTerminal.findUnique({
    where: { publicCode: code },
    include: { client: { select: { name: true, isActive: true } } },
  })
  if (!terminal) return NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 })

  return NextResponse.json({
    publicCode: terminal.publicCode,
    label: terminal.label,
    merchantName: terminal.client.name,
    isActive: terminal.isActive && terminal.client.isActive,
  })
}
