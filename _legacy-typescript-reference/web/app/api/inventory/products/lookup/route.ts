import { auth } from "@core/auth"
import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"

/**
 * GET /api/inventory/products/lookup?code=<barcode|sku|id>
 * Looks up a product by barcode, SKU, or partial ID.
 * Used by the barcode scanner to find products.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const code = request.nextUrl.searchParams.get("code")?.trim()
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 })

  // Search by barcode first (exact), then SKU (exact), then by id suffix
  const product = await prisma.product.findFirst({
    where: {
      clientId,
      isActive: true,
      deletedAt: null,
      OR: [
        { barcode: code },
        { sku: code },
        { sku: code.toUpperCase() },
        { id: { endsWith: code.toLowerCase() } },
      ],
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
  })

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    currentStock: Number(product.currentStock),
    salePrice: Number(product.salePrice),
    unitType: product.unitType,
    brand: product.brand,
    image: product.image,
  })
}
