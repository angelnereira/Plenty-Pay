import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { NextResponse, NextRequest } from "next/server"

/**
 * GET /api/invoices/search?q=...&status=EMITTED,CERTIFIED&documentType=FACTURA&limit=10
 *
 * Searches invoices by folio, invoiceNumber, clientName, receiverName, clientRuc, receiverRuc, or cufe.
 * Used by the ManualInvoiceGenerator to find referenced invoices for NC/ND.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const clientId = session.user.clientId
    if (!clientId) {
      return NextResponse.json({ error: "Usuario sin organización" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""
    const statusParam = searchParams.get("status") || "EMITTED,CERTIFIED"
    const documentTypeParam = searchParams.get("documentType") || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50)

    if (q.length < 2) {
      return NextResponse.json({ invoices: [] })
    }

    const statuses = statusParam.split(",").map(s => s.trim()).filter(Boolean)
    const documentTypes = documentTypeParam ? documentTypeParam.split(",").map(s => s.trim()).filter(Boolean) : []

    const where: any = {
      clientId,
      deletedAt: null,
      status: { in: statuses },
    }

    if (documentTypes.length > 0) {
      where.documentType = { in: documentTypes }
    }

    // Search across multiple fields
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { receiverName: { contains: q, mode: "insensitive" } },
      { receiverRuc: { contains: q, mode: "insensitive" } },
      { cufe: { contains: q, mode: "insensitive" } },
    ]

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        cufe: true,
        total: true,
        emittedAt: true,
        receiverName: true,
        receiverRuc: true,
        receiverDv: true,
        receiverType: true,
        issuerRuc: true,
        issuerDv: true,
        issuerName: true,
        documentType: true,
        status: true,
      },
      orderBy: { emittedAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      invoices: invoices.map(inv => ({
        id: inv.id,
        folio: inv.invoiceNumber || "N/A",
        invoiceNumber: inv.invoiceNumber,
        cufe: inv.cufe,
        clientName: inv.receiverName || "N/A",
        receiverName: inv.receiverName,
        receiverRuc: inv.receiverRuc,
        receiverDv: inv.receiverDv,
        receiverType: inv.receiverType,
        total: Number(inv.total || 0),
        emittedAt: inv.emittedAt?.toISOString() || "",
      })),
    })
  } catch (error) {
    console.error("[API] Invoice search error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
