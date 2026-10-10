"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Download,
  Eye,
  FileDown,
  Trash2,
  MoreVertical,
  FileText,
  Loader2,
  RotateCw
} from "lucide-react"
import { InvoiceReviewModal } from "@/features/invoicing/ui/invoice-review-modal"
// Removed static import of loadDraft
import { formatPanamaDateShortMonth } from "@/lib/utils/date-timezone"
import { apiClient } from "@/lib/api-client"
import { AppAction } from "@shared/lib/workflow-ids"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu"
import { Button } from "@shared/ui/button"
import { cn } from "@/lib/utils"

interface Invoice {
  id: string
  invoiceNumber: string | null
  receiverName: string
  receiverRuc: string | null
  total: number
  status: string
  createdAt: string
  issueDate: string | null
  canDelete: boolean
  hasPdf: boolean
  hasXml: boolean
}

interface InvoiceListProps {
  invoices: Invoice[]
  currentPage: number
  totalPages: number
  currentStatus?: string
}

// ... statusConfig and statusLabels definitions

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" },
  QUEUED: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  PROCESSING: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  CERTIFIED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  EMITTED: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  REJECTED: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  CANCELLED: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
  ERROR: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
}

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  CERTIFIED: "Certificada",
  EMITTED: "Emitida",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  ERROR: "Error",
}

type DownloadType = "pdf" | "xml"

export function InvoiceList({ invoices, currentPage, totalPages }: InvoiceListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadType, setDownloadType] = useState<DownloadType | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Retry state
  const [retryModalOpen, setRetryModalOpen] = useState(false)
  const [retryData, setRetryData] = useState<any>(null)
  const [isLoadingRetry, setIsLoadingRetry] = useState(false)

  const handleRetry = async (invoiceId: string) => {
    try {
      setIsLoadingRetry(true)
      const { loadDraft } = await import('@/app/actions/invoice/draft.action')
      const res = await loadDraft(invoiceId)

      if (res.success && res.data) {
        setRetryData(res.data.data) // data.data es el DocumentoElectronico
        setRetryModalOpen(true)
      } else {
        alert("No se pudieron cargar los datos originales de la factura para reintentar.")
      }
    } catch (e) {
      console.error("Error loading retry data", e)
      alert("Error al cargar datos para reintento")
    } finally {
      setIsLoadingRetry(false)
    }
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", page.toString())
    router.push(`/dashboard/facturas?${params.toString()}`)
  }

  const handleDownload = async (invoiceId: string, type: DownloadType, fileNameHint: string | null) => {
    try {
      setDownloadingId(invoiceId)
      setDownloadType(type)

      const response = await apiClient.fetch(`/api/invoices/${invoiceId}/${type}`, {
        method: "GET",
        action: type === "pdf" ? AppAction.DOWNLOAD_INVOICE_PDF : AppAction.DOWNLOAD_INVOICE_XML
      })

      if (!response.ok) throw new Error("Error detallado en consola")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      const extension = type === "pdf" ? "pdf" : "xml"
      const filename = fileNameHint
        ? `${fileNameHint}.${extension}`
        : `factura-${invoiceId}.${extension}`
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("[InvoiceList] Download Error", error)
      alert("No se pudo descargar el archivo. Intenta nuevamente.")
    } finally {
      setDownloadingId(null)
      setDownloadType(null)
    }
  }

  const handleDelete = async (invoiceId: string) => {
    if (!window.confirm("¿Eliminar factura permanentemente?")) return

    try {
      setDeletingId(invoiceId)
      const response = await apiClient.fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
        action: AppAction.DELETE_INVOICE
      })
      if (response.ok) router.refresh()
      else alert("Error al eliminar")
    } catch (error) {
      console.error(error)
    } finally {
      setDeletingId(null)
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-20 w-20 bg-gradient-to-br from-violet-500/20 to-violet-600/10 rounded-2xl flex items-center justify-center mb-5 border border-violet-500/20">
          <FileText className="h-10 w-10 text-violet-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Sin documentos</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          No se encontraron facturas con los filtros actuales.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Invoice Cards */}
      <div className="space-y-2">
        {invoices.map((invoice) => {
          const status = statusConfig[invoice.status] || statusConfig.DRAFT
          const isLoading = downloadingId === invoice.id || deletingId === invoice.id || (isLoadingRetry && retryData?.id === invoice.id)

          return (
            <div
              key={invoice.id}
              className={cn(
                "group relative bg-slate-900/50 hover:bg-slate-800/70 border border-slate-800 hover:border-violet-500/30 rounded-xl p-4 transition-all duration-200",
                isLoading && "opacity-60 pointer-events-none"
              )}
            >
              {/* Main Row */}
              <div className="flex items-center gap-4">
                {/* Invoice Number / ID */}
                <div className="min-w-[120px]">
                  <Link href={`/dashboard/facturas/${invoice.id}`} className="block group/link">
                    <span className="font-mono text-sm font-bold text-white group-hover/link:text-violet-400 transition-colors">
                      {invoice.invoiceNumber || "---"}
                    </span>
                  </Link>
                </div>

                {/* Client */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate" title={invoice.receiverName}>
                    {invoice.receiverName}
                  </p>
                  {invoice.receiverRuc && (
                    <p className="text-xs text-slate-500 font-mono">
                      {invoice.receiverRuc}
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="text-right min-w-[100px]">
                  <span className="text-sm font-bold text-white font-mono">
                    ${invoice.total.toLocaleString("es-PA", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="min-w-[110px] flex justify-center">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                    status.bg, status.text
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                    {statusLabels[invoice.status] || invoice.status}
                  </span>
                </div>

                {/* Date */}
                <div className="min-w-[90px] text-right">
                  <span className="text-xs text-slate-400" suppressHydrationWarning>
                    {formatPanamaDateShortMonth(invoice.issueDate || invoice.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Retry Button - Only for ERROR or REJECTED */}
                  {(invoice.status === 'ERROR' || invoice.status === 'REJECTED') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg"
                      onClick={() => handleRetry(invoice.id)}
                      disabled={isLoadingRetry}
                      title="Reintentar Emisión"
                    >
                      <RotateCw className={cn("h-4 w-4", isLoadingRetry && "animate-spin")} />
                    </Button>
                  )}

                  {/* Quick View */}
                  <Link href={`/dashboard/facturas/${invoice.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>

                  {/* Quick PDF Download */}
                  {invoice.hasPdf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                      onClick={() => handleDownload(invoice.id, "pdf", invoice.invoiceNumber)}
                      disabled={downloadingId === invoice.id}
                    >
                      {downloadingId === invoice.id && downloadType === "pdf" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* More Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 bg-slate-900 border-slate-700 text-slate-200"
                    >
                      <Link href={`/dashboard/facturas/${invoice.id}`}>
                        <DropdownMenuItem className="hover:bg-slate-800 focus:bg-slate-800">
                          <Eye className="h-4 w-4 mr-2" /> Ver Detalles
                        </DropdownMenuItem>
                      </Link>

                      {(invoice.hasPdf || invoice.hasXml) && <DropdownMenuSeparator className="bg-slate-700" />}

                      {invoice.hasPdf && (
                        <DropdownMenuItem
                          onClick={() => handleDownload(invoice.id, "pdf", invoice.invoiceNumber)}
                          disabled={downloadingId === invoice.id}
                          className="hover:bg-slate-800 focus:bg-slate-800"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Descargar PDF
                        </DropdownMenuItem>
                      )}

                      {invoice.hasXml && (
                        <DropdownMenuItem
                          onClick={() => handleDownload(invoice.id, "xml", invoice.invoiceNumber)}
                          disabled={downloadingId === invoice.id}
                          className="hover:bg-slate-800 focus:bg-slate-800"
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Descargar XML
                        </DropdownMenuItem>
                      )}

                      {invoice.canDelete && (
                        <>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(invoice.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            Anterior
          </Button>
          <div className="flex items-center gap-1 px-3">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                    page === currentPage
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {page}
                </button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            Siguiente
          </Button>
        </div>
      )}
      {/* Retry Modal */}
      {retryData && (
        <InvoiceReviewModal
          isOpen={retryModalOpen}
          onClose={() => {
            setRetryModalOpen(false)
            setRetryData(null)
          }}
          data={retryData}
          onSuccess={() => {
            setRetryModalOpen(false)
            setRetryData(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
