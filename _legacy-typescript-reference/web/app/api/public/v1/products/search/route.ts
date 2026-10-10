import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"

/**
 * GET /api/public/v1/products/search?q=<texto>&limit=<n>
 * Header: Authorization: Bearer <api_key>
 *
 * NUEVO — a diferencia de /api/inventory/products/lookup (que exige sesión de
 * navegador vía NextAuth), este endpoint se autentica con una ApiKey de la
 * tabla api_keys, para llamadas servicio-a-servicio: el nuevo services/mcp-server,
 * un bot de Jelou en WhatsApp, o cualquier integración externa (ver documento 03,
 * addon "apiAccess" — este es exactamente el endpoint que ese addon necesitaba
 * y todavía no existía).
 *
 * Si más adelante se necesitan más endpoints así, seguir este mismo patrón de
 * validación en vez de duplicarlo — vale la pena extraerlo a un middleware
 * compartido (`lib/auth/api-key.ts`, a crear) en cuanto haya un tercer endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const rawKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null

  if (!rawKey) {
    return NextResponse.json({ error: "Falta Authorization: Bearer <api_key>" }, { status: 401 })
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { key: rawKey } })

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json({ error: "API key inválida o inactiva" }, { status: 401 })
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json({ error: "API key expirada" }, { status: 401 })
  }

  // TODO(seguridad): esto compara la key en texto plano contra la columna `key`.
  // Antes de producción, migrar a comparar un hash (bcrypt/sha256) igual que se
  // hace con las credenciales HKA — nunca guardar ni comparar secretos en claro
  // a largo plazo. Se deja explícito aquí en vez de asumir que ya está resuelto.

  const permissions: string[] = JSON.parse(apiKey.permissions || "[]")
  if (!permissions.includes("products:read") && !permissions.includes("*")) {
    return NextResponse.json({ error: "La API key no tiene permiso products:read" }, { status: 403 })
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 10, 50)

  const products = await prisma.product.findMany({
    where: {
      clientId: apiKey.clientId,
      isActive: true,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { barcode: query },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      currentStock: true,
      salePrice: true,
      unitType: true,
      brand: true,
      image: true,
    },
    take: limit,
  })

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })

  return NextResponse.json({ products })
}
