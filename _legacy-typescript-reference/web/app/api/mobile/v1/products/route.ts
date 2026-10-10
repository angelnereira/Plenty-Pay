import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import { verifyMobileJwt } from "@/lib/auth/mobile-jwt"

/**
 * GET /api/mobile/v1/products?q=<texto>&limit=<n>
 * Header: Authorization: Bearer <jwt móvil>
 *
 * Catálogo del comercio (tenant) al que pertenece el usuario autenticado en
 * la app Flutter. Es la contraparte con JWT de usuario de
 * /api/public/v1/products/search (ese usa ApiKey servicio-a-servicio, para
 * el mcp-server e integraciones externas).
 *
 * ALCANCE HONESTO: esto sirve el catálogo INTERNO por tenant (el modelo
 * Product de inventario/facturación DGI). Un catálogo de marketplace
 * multi-vendedor (listados públicos entre varios comercios) es un modelo
 * distinto que todavía no existe — ver MIGRATION_STATUS.md.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  if (!token) return NextResponse.json({ error: "Falta Authorization: Bearer <token>" }, { status: 401 })

  const payload = await verifyMobileJwt(token)
  if (!payload || !payload.clientId) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 50)

  const products = await prisma.product.findMany({
    where: {
      clientId: payload.clientId,
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
    select: { id: true, name: true, sku: true, barcode: true, currentStock: true, salePrice: true, unitType: true, brand: true, image: true },
    take: limit,
  })

  // salePrice puede ser Decimal en Prisma — se serializa a string para no perder precisión en JSON.
  type ProductRow = { salePrice: { toString(): string } | null } & Record<string, unknown>
  return NextResponse.json({
    products: products.map((p: ProductRow) => ({ ...p, salePrice: p.salePrice?.toString() ?? null })),
  })
}
