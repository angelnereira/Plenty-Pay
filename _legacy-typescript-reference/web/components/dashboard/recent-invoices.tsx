import { FileText, Eye, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"

interface Invoice {
  id: string
  invoiceNumber: string | null
  total: any
  status: string
  createdAt: Date
}

interface RecentInvoicesProps {
  invoices: Invoice[]
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'CERTIFIED':
    case 'EMITTED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3 mr-1" /> Emitida
        </span>
      )
    case 'ERROR':
    case 'REJECTED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle className="w-3 h-3 mr-1" /> Error
        </span>
      )
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Procesando
        </span>
      )
    case 'QUEUED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3 mr-1" /> En Cola
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
          <AlertCircle className="w-3 h-3 mr-1" /> Cancelada
        </span>
      )
    default: // DRAFT
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Clock className="w-3 h-3 mr-1" /> Borrador
        </span>
      )
  }
}

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/30 overflow-hidden">
      {/* Header removed as it is handled by parent in dashboard page, or we can keep it if needed. 
          The previous code had a header inside the component. I will keep it but cleaner. */}
      <div className="p-6 border-b border-slate-700/30 flex items-center justify-between">
        <h3 className="font-semibold text-white">
          Facturas Recientes
        </h3>
        <Link href="/dashboard/facturas" className="text-sm text-violet-400 hover:text-violet-300 font-medium">
          Ver todas
        </Link>
      </div>

      <div className="p-0">
        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No hay facturas recientes</p>
            <Link
              href="/dashboard/facturacion/nueva"
              className="mt-4 inline-block text-sm font-medium text-violet-400 hover:text-violet-300"
            >
              Crear primera factura
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {invoice.invoiceNumber || "Sin número"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(invoice.createdAt), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {getStatusBadge(invoice.status)}

                  <div className="text-right min-w-[80px]">
                    <p className="font-semibold text-white">
                      ${Number(invoice.total).toFixed(2)}
                    </p>
                  </div>

                  <Link href={`/dashboard/facturas/${invoice.id}`}>
                    <button className="p-2 text-slate-400 hover:text-violet-400 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


export function RecentInvoicesSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/30 overflow-hidden animate-pulse">
      <div className="p-6 border-b border-slate-700/30 flex items-center justify-between">
        <div className="h-5 w-32 bg-slate-700/50 rounded-md" />
        <div className="h-4 w-16 bg-slate-700/50 rounded-md" />
      </div>
      <div className="divide-y divide-slate-700/30">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-700/50 rounded-lg" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-700/50 rounded-md" />
                <div className="h-3 w-16 bg-slate-700/50 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-5 w-20 bg-slate-700/50 rounded-full" />
              <div className="h-5 w-16 bg-slate-700/50 rounded-md" />
              <div className="h-8 w-8 bg-slate-700/50 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
