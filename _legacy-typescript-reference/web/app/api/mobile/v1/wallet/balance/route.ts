import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * GET /api/mobile/v1/wallet/balance
 * Header: Authorization: Bearer <jwt móvil>
 *
 * Lee directo de la tabla `wallets` vía Prisma en vez de llamar por gRPC a
 * services/wallet-ledger. Es válido durante la fase de transición descrita en
 * el documento 02 (sección 3): el monolito y los servicios nuevos comparten
 * el mismo Postgres, y ESTA es una lectura pura (nunca una escritura — toda
 * escritura de saldo debe pasar por wallet-ledger, que es quien mantiene la
 * invariante de bloqueo optimista vía `version`). Si esto se vuelve un
 * patrón repetido, migrar a llamar por gRPC en vez de leer la tabla directo.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: "Falta Authorization: Bearer <token>" }, { status: 401 })

  const payload = await verifyMobileJwt(token)
  if (!payload) return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })

  // ⚠️ BRECHA DE DISEÑO REAL, no resuelta todavía (ver MIGRATION_STATUS.md):
  // `payload.sub` es un User.id (cuenta de login). `Wallet.entityId` apunta a
  // un MotorEntity.id (la parte — persona o empresa — dueña del saldo). Hoy
  // NO existe un mapeo formal User ↔ MotorEntity en el schema. Se usa
  // `payload.sub` directo como marcador de posición para que este endpoint
  // sea ejecutable de punta a punta, pero antes de producción hay que decidir
  // y modelar ese mapeo (lo más probable: crear el MotorEntity automáticamente
  // al registrar un User que necesita wallet, y guardar la relación).
  const wallet = await prisma.wallet.findUnique({ where: { entityId: payload.sub } })

  if (!wallet) {
    // El usuario todavía no tiene wallet — es un estado válido (nunca ha
    // recibido/hecho un pago), no un error.
    return NextResponse.json({
      currency: "USD",
      availableCents: "0",
      heldCents: "0",
      pendingSettlementCents: "0",
    })
  }

  return NextResponse.json({
    currency: wallet.currency,
    availableCents: wallet.availableBalanceCents.toString(),
    heldCents: wallet.heldBalanceCents.toString(),
    pendingSettlementCents: wallet.pendingSettlementCents.toString(),
  })
}
