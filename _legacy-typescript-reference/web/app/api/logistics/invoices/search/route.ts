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

  const invoices = await prisma.invoice.findMany({
    where: {
      clientId,
      // Solo facturas emitidas (excluyendo borradores, anuladas y errores)
      status: { in: ["EMITTED", "INTERNAL", "CERTIFIED"] },
      ...(q.length > 0
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { numeroDocumentoFiscal: { contains: q, mode: "insensitive" } },
              { clientReferenceId: { contains: q, mode: "insensitive" } },
              { receiverName: { contains: q, mode: "insensitive" } },
              { receiverRuc: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      numeroDocumentoFiscal: true,
      clientReferenceId: true,
      receiverName: true,
      receiverRuc: true,
      receiverPhone: true,
      receiverEmail: true,
      receiverAddress: true,
      total: true,
      createdAt: true,
      status: true,
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          taxRate: true,
          taxAmount: true,
          total: true,
          productId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json(
    invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      numeroDocumentoFiscal: inv.numeroDocumentoFiscal,
      clientReferenceId: inv.clientReferenceId,
      receiverName: inv.receiverName,
      receiverRuc: inv.receiverRuc,
      receiverPhone: inv.receiverPhone,
      receiverEmail: inv.receiverEmail,
      receiverAddress: inv.receiverAddress,
      total: inv.total?.toString() ?? null,
      createdAt: inv.createdAt,
      status: inv.status,
      itemCount: inv.items.length,
    }))
  )
}
