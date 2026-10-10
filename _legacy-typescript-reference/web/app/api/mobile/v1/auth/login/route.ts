import { NextRequest, NextResponse } from "next/server"
import { compare } from "bcryptjs"
import { prismaServer as prisma } from "@core/database"
import { signMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * POST /api/mobile/v1/auth/login
 * Body: { email, password }
 *
 * Replica la validación de core/auth/auth.config.ts (usuario activo, cliente
 * activo salvo SUPER_ADMIN, bcrypt) pero devuelve un JWT de portador en vez de
 * fijar una cookie de sesión — necesario porque un cliente móvil nativo no
 * participa del flujo de cookies de NextAuth de la misma forma que un
 * navegador. Si alguna vez se corrige/cambia la lógica de validación en
 * auth.config.ts, replicar el cambio aquí también (o, mejor, extraer ambas a
 * una función compartida — no se hizo en este scaffold para no tocar el
 * archivo de NextAuth existente sin que el equipo lo revise primero).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null
  const password = typeof body?.password === "string" ? body.password : null

  if (!email || !password) {
    return NextResponse.json({ error: "email y password son obligatorios" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } })

  if (!user || !user.password) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "Usuario inactivo" }, { status: 403 })
  }
  if (user.role !== "SUPER_ADMIN" && (!user.client || !user.client.isActive)) {
    return NextResponse.json({ error: "Organización inactiva o suspendida" }, { status: 403 })
  }

  const passwordsMatch = await compare(password, user.password)
  if (!passwordsMatch) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
  }

  const token = await signMobileJwt({ sub: user.id, clientId: user.clientId ?? "", role: user.role })

  return NextResponse.json({
    token,
    tenantId: user.clientId,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
}
