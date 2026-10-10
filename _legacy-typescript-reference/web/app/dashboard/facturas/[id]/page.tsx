import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { InvoiceDetailView } from "@/features/invoicing/ui/invoice-detail-view"
import { Button } from "@/shared/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function FacturaDetallesPage({ params }: PageProps) {
  const session = await auth()

  if (!session) {
    redirect("/")
  }

  // En Next.js 15, params es Promise
  const { id } = await params

  // Obtener factura con items
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      client: {
        select: {
          name: true,
          ruc: true,
          branchCode: true,
          locationCode: true,
        }
      }
    }
  })

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Factura no encontrada
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            La factura que buscas no existe o no tienes acceso a ella
          </p>
          <Link href="/dashboard/facturas">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al historial
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Verificar que el usuario tenga acceso a esta factura
  if (invoice.clientId !== session.user.clientId) {
    redirect("/dashboard/facturas")
  }

  // Obtener items: primero de la tabla, si está vacía intentar desde hkaResponseData
  type SimpleItem = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxAmount: number;
    unit?: string | null;
  };

  let transformedItems: SimpleItem[] = invoice.items.map(item => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
    taxAmount: Number(item.taxAmount),
    unit: item.unit,
  }));

  // Si no hay items en la tabla, intentar obtenerlos del hkaResponseData (facturas legacy)
  if (transformedItems.length === 0 && invoice.hkaResponseData) {
    const hkaData = invoice.hkaResponseData as {
      documentoEnviado?: {
        listaItems?: Array<{
          descripcion: string;
          cantidad: string;
          precioUnitario: string;
          valorTotal: string;
          valorITBMS: string;
        }>
      }
    };

    const listaItems = hkaData?.documentoEnviado?.listaItems;
    if (listaItems && Array.isArray(listaItems)) {
      transformedItems = listaItems.map((item, index) => ({
        id: `legacy-${index}`,
        description: item.descripcion || 'Sin descripción',
        quantity: parseFloat(item.cantidad || '1'),
        unitPrice: parseFloat(item.precioUnitario || '0'),
        total: parseFloat(item.valorTotal || '0'),
        taxAmount: parseFloat(item.valorITBMS || '0'),
      }));
    }
  }

  const DOC_TYPE_CODES: Record<string, string> = {
    FACTURA: '01',
    FACTURA_IMPORTACION: '02',
    FACTURA_EXPORTACION: '03',
    NOTA_CREDITO: '04',
    NOTA_DEBITO: '05',
    FACTURA_ZONA_FRANCA: '08',
    REEMBOLSO: '09',
    FACTURA_EXTRANJERA: '10',
  };

  // Transformar datos para el componente
  const transformedInvoice = {
    id: invoice.id,
    folio: invoice.invoiceNumber || invoice.numeroDocumentoFiscal || undefined,
    invoiceNumber: invoice.invoiceNumber || undefined,
    cufe: invoice.cufe || undefined,
    cufeLocal: invoice.cufeLocal || undefined,
    cafe: invoice.cafe || undefined,
    qrCode: invoice.qrCode || undefined,
    qrUrl: invoice.qrUrl || undefined,
    status: invoice.status || "DRAFT",
    total: Number(invoice.total) || 0,
    subtotal: Number(invoice.subtotal) || 0,
    itbms: Number(invoice.itbms) || 0,
    discount: Number(invoice.discount) || 0,
    currency: invoice.currency || "PAB",
    issueDate: invoice.issueDate || invoice.createdAt,
    createdAt: invoice.createdAt,
    emittedAt: invoice.emittedAt || undefined,
    receiverName: invoice.receiverName || "Cliente",
    receiverRuc: invoice.receiverRuc || undefined,
    receiverDv: invoice.receiverDv || undefined,
    receiverEmail: invoice.receiverEmail || undefined,
    receiverType: invoice.receiverType || undefined,
    fechaLimitePosterior: invoice.fechaLimitePosterior || null,
    // Issuer snapshot
    issuerName: invoice.issuerName,
    issuerRuc: invoice.issuerRuc,
    issuerDv: invoice.issuerDv,
    issuerAddress: invoice.issuerAddress,
    issuerPhone: invoice.issuerPhone || undefined,
    // Document metadata
    documentType: DOC_TYPE_CODES[invoice.documentType] ?? '01',
    numeroDocumentoFiscal: invoice.numeroDocumentoFiscal || undefined,
    codigoSucursal: invoice.client?.branchCode ?? '0001',
    puntoFacturacion: invoice.pointOfSale ?? '001',
    // Payment
    paymentMethod: invoice.paymentMethod || undefined,
    // HKA
    hkaProtocol: invoice.hkaProtocol || null,
    hkaProtocolDate: invoice.hkaProtocolDate || null,
    items: transformedItems,
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Vista de detalle rediseñada */}
      <InvoiceDetailView invoice={transformedInvoice} />
    </div>
  )
}
