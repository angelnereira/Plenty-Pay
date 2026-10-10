import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  // Search all active products (not just in-stock) — delivery orders may
  // reference products the user doesn't track in inventory
  const products = await prisma.product.findMany({
    where: {
      clientId,
      deletedAt: null,
      isActive: true,
      ...(q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      unitType: true,
      currentStock: true,
      salePrice: true,
      taxRate: true,
      weight: true,
      dimensions: true,
    },
    orderBy: { name: "asc" },
    take: 30,
  })

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      unitType: p.unitType,
      currentStock: Number(p.currentStock),
      salePrice: Number(p.salePrice),
      taxRate: Number(p.taxRate),
      weight: p.weight,
      dimensions: p.dimensions,
    }))
  )
}
