import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { AppAction } from "@shared/lib/workflow-ids"

/**
 * GET /api/invoices/[id]
 *
 * Returns the full invoice data including items.
 * Used by the credit-note form to auto-populate items from the original invoice.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const clientId = session.user.clientId
    if (!clientId) {
      return NextResponse.json({ error: "Usuario sin organización" }, { status: 400 })
    }

    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
      where: { id, clientId },
      select: {
        id: true,
        invoiceNumber: true,
        cufe: true,
        receiverName: true,
        receiverRuc: true,
        receiverDv: true,
        receiverType: true,
        receiverEmail: true,
        receiverPhone: true,
        receiverAddress: true,
        total: true,
        subtotal: true,
        itbms: true,
        discount: true,
        issueDate: true,
        emittedAt: true,
        status: true,
        documentType: true,
        isCancelled: true,
        hkaProtocol: true,
        issuerRuc: true,
        issuerDv: true,
        issuerName: true,
        customerId: true,
        // Needed for item reconstruction fallback
        hkaResponseData: true,
        notes: true,
        items: {
          select: {
            id: true,
            lineNumber: true,
            code: true,
            description: true,
            quantity: true,
            unitPrice: true,
            unit: true,
            discount: true,
            discountRate: true,
            taxRate: true,
            taxAmount: true,
            subtotal: true,
            total: true,
          },
          orderBy: { lineNumber: "asc" },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }

    // ===============================================================
    // FALLBACK: Reconstruct items from hkaResponseData or notes
    // This handles invoices emitted via saveDraft() that never persisted
    // InvoiceItem records in the database.
    // ===============================================================
    interface SerializedItem {
      id: string;
      lineNumber: number;
      code: string;
      description: string;
      quantity: number;
      unitPrice: number;
      unit: string;
      discount: number;
      discountRate: number;
      taxRate: number;
      taxAmount: number;
      subtotal: number;
      total: number;
    }
    let fallbackItems: SerializedItem[] | null = null;

    if (invoice.items.length === 0 && (invoice.status === 'EMITTED' || invoice.status === 'CERTIFIED')) {
      let listaItems: Array<Record<string, unknown>> | null = null;

      // Strategy 1: From hkaResponseData.documentoEnviado.listaItems
      const hkaData = invoice.hkaResponseData as Record<string, unknown> | null;
      const docEnviado = hkaData?.documentoEnviado as Record<string, unknown> | undefined;
      if (docEnviado?.listaItems && Array.isArray(docEnviado.listaItems)) {
        listaItems = docEnviado.listaItems as Array<Record<string, unknown>>;
      }

      // Strategy 2: From notes.documentoCompleto.listaItems
      if (!listaItems && invoice.notes) {
        try {
          const notesData = JSON.parse(invoice.notes);
          if (notesData?.documentoCompleto?.listaItems && Array.isArray(notesData.documentoCompleto.listaItems)) {
            listaItems = notesData.documentoCompleto.listaItems;
          }
        } catch { /* ignore parse errors */ }
      }

      if (listaItems && listaItems.length > 0) {
        console.log(`[API /invoices/${id}] Reconstructing ${listaItems.length} items from HKA data (no items in DB)`);

        // Build already-serialized items (plain numbers, no Decimals)
        fallbackItems = listaItems.map((item, index) => {
          const taxRateCode = String(item.tasaITBMS || '01');
          return {
            id: `reconstructed-${index + 1}`,
            lineNumber: index + 1,
            code: String(item.codigo || item.codigoGTIN || `ITEM-${index + 1}`),
            description: String(item.descripcion || ''),
            quantity: parseFloat(String(item.cantidad || '1')),
            unitPrice: parseFloat(String(item.precioUnitario || '0')),
            unit: String(item.unidadMedida || 'UND'),
            discount: parseFloat(String(item.precioUnitarioDescuento || '0')),
            discountRate: 0,
            taxRate: taxRateCode === '00' ? 0 : taxRateCode === '01' ? 7 : taxRateCode === '02' ? 10 : 15,
            taxAmount: parseFloat(String(item.valorITBMS || '0')),
            subtotal: parseFloat(String(item.precioItem || '0')),
            total: parseFloat(String(item.valorTotal || '0')),
          };
        });

        // Fire-and-forget: persist for next time
        const persistData = fallbackItems.map(item => ({
          invoiceId: invoice.id,
          lineNumber: item.lineNumber,
          code: item.code,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          discount: item.discount,
          discountRate: item.discountRate,
          taxRate: item.taxRate,
          taxCode: item.taxRate === 0 ? '00' : item.taxRate === 7 ? '01' : item.taxRate === 10 ? '02' : '03',
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          total: item.total,
        }));

        prisma.invoiceItem.createMany({ data: persistData })
          .then(() => console.log(`[API /invoices/${id}] Persisted ${persistData.length} reconstructed items`))
          .catch((err: unknown) => console.error(`[API /invoices/${id}] Failed to persist reconstructed items:`, err));
      }
    }

    // Serialize Decimal fields to numbers
    return NextResponse.json({
      data: {
        ...invoice,
        total: Number(invoice.total),
        subtotal: Number(invoice.subtotal),
        itbms: Number(invoice.itbms),
        discount: Number(invoice.discount),
        // Exclude internal fields from response
        hkaResponseData: undefined,
        notes: undefined,
        // Use fallback items if DB items are empty, otherwise serialize DB items
        items: fallbackItems ?? invoice.items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          discountRate: Number(item.discountRate),
          taxRate: Number(item.taxRate),
          taxAmount: Number(item.taxAmount),
          subtotal: Number(item.subtotal),
          total: Number(item.total),
        })),
      },
    })
  } catch (error) {
    console.error("[API] Error getting invoice:", error)
    return NextResponse.json(
      { error: "Error al obtener la factura" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  },
) {
  const { id } = await params
  const action = request.headers.get("X-App-Action")

  console.log(`[Backend-Hollow] Processing DELETE for ${id} with Action: ${action}`)

  switch (action) {
    case AppAction.DELETE_INVOICE:
      // Backend Cleaned: Logic removed.
      return NextResponse.json(
        { error: "Eliminación de factura pendiente de implementación." },
        { status: 501 }
      );

    default:
      return NextResponse.json(
        { error: "Acción no implementada." },
        { status: 501 }
      );
  }
}
