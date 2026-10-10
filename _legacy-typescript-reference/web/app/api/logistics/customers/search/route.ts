import { auth } from "@core/auth"
import { NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"

/**
 * GET /api/logistics/customers/search?q=<query>
 * Search customers AND suppliers for the delivery order recipient field.
 * Returns a unified list so the user can pick from existing contacts.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  const searchFilter = q.length > 0
    ? { OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { ruc: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ]}
    : {}

  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      where: {
        clientId,
        isActive: true,
        deletedAt: null,
        ...searchFilter,
      },
      select: {
        id: true,
        name: true,
        ruc: true,
        dv: true,
        email: true,
        phone: true,
        address: true,
      },
      orderBy: { name: "asc" },
      take: 15,
    }),
    prisma.supplier.findMany({
      where: {
        clientId,
        isActive: true,
        deletedAt: null,
        ...searchFilter,
      },
      select: {
        id: true,
        name: true,
        ruc: true,
        dv: true,
        email: true,
        phone: true,
        address: true,
        contactName: true,
        contactPhone: true,
      },
      orderBy: { name: "asc" },
      take: 15,
    }),
  ])

  const results = [
    ...customers.map((c) => ({
      id: c.id,
      name: c.name,
      ruc: c.ruc,
      dv: c.dv,
      email: c.email,
      phone: c.phone,
      address: c.address,
      type: "customer" as const,
    })),
    ...suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      ruc: s.ruc ? `${s.ruc}${s.dv ? `-DV${s.dv}` : ""}` : null,
      dv: s.dv,
      email: s.email,
      phone: s.phone || s.contactPhone,
      address: s.address,
      type: "supplier" as const,
    })),
  ]

  return NextResponse.json(results)
}
