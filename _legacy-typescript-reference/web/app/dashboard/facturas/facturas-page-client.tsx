"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Plus,
  Upload,
  CheckCircle,
  Database,
  WifiOff,
  MoreHorizontal,
  FileSearch,
  Loader2,
  Calculator,
  Eye,
  EyeOff,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import type { PendingInvoice } from "@/lib/offline-db"

// Unified Components
import { ResponsiveInvoiceList } from "@/features/invoicing/ui/responsive-invoice-list"
import { InvoiceFilters, FilterType } from "@/features/invoicing/ui/invoice-filters"
import { ContingencyBanner } from "@/features/invoicing/ui/contingency-banner"
import { ItbmsReportButton } from "@/features/invoicing/ui/itbms-report-button"

// Cache invalidation for optimistic updates
import { useQueryInvalidation } from "@/hooks/useServerActionMutation"

// Mobile Specific (Layout)

import { useInvoices } from "@shared/hooks/use-invoices"
import { InvoicesData } from "@/actions/invoice-actions"
import { useInvoiceGenerator } from "@/components/dashboard/invoice-generator-provider"
import { parseInvoiceFile } from "@/app/actions/invoice/parse-invoice-file.action"
import { InvoiceSort, SortType } from "@/features/invoicing/ui/invoice-sort"

// Lazy load heavy modals
const RucValidationModal = dynamic(() => import("@/components/dashboard/ruc-validation-modal").then(mod => mod.RucValidationModal), { ssr: false })
const StatusQueryModal = dynamic(() => import("@/components/dashboard/status-query-modal").then(mod => mod.StatusQueryModal), { ssr: false })
const FoliosConsultationModal = dynamic(() => import("@/components/dashboard/folios-consultation-modal").then(mod => mod.FoliosConsultationModal), { ssr: false })

// ─── Pending Offline Invoices ────────────────────────────────────────────────

function PendingOfflineInvoices({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState<PendingInvoice[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { getPendingInvoices } = await import('@/lib/offline-db')
        const items = await getPendingInvoices(clientId)
        if (mounted) setPending(items)
      } catch { /* IndexedDB may not be available */ }
    }
    load()
    return () => { mounted = false }
  }, [clientId])

  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">
          {pending.length} factura{pending.length > 1 ? 's' : ''} offline pendiente{pending.length > 1 ? 's' : ''} de sincronización
        </span>
      </div>
      <div className="space-y-2">
        {pending.map(inv => (
          <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-200">
                {inv.invoiceNumber}
              </span>
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                {new Date(inv.createdAt).toLocaleString('es-PA')} · ${inv.total.toFixed(2)}
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
              {inv.syncStatus === 'failed' ? 'Error de sync' : 'Pendiente'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-amber-600 dark:text-amber-400">
        Se enviarán a la DGI automáticamente al restaurar la conexión.
        El comprobante PDF se descarga desde la pantalla del POS al momento de la venta.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type InputFileType = 'xlsx' | 'xls' | 'xml'

interface FacturasPageClientProps {
  initialData: InvoicesData
  userName: string
}

export function FacturasPageClient({ initialData, userName }: FacturasPageClientProps) {
  const { data: session } = useSession()
  const clientId = session?.user?.clientId ?? null
  const { data } = useInvoices(initialData)
  const { invalidateAll } = useQueryInvalidation()

  const invoices = useMemo(() => data?.invoices || [], [data?.invoices])
  const stats = data?.stats || {
    total: 0,
    emitted: 0,
    draft: 0,
    processing: 0,
    error: 0,
    canceled: 0,
    totalAmount: 0,
    totalItbms: 0
  }

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [showItbms, setShowItbms] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('date_desc')
  const { openGenerator, optimisticInvoices } = useInvoiceGenerator()

  // HKA Modal states
  const [showRucModal, setShowRucModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showFoliosModal, setShowFoliosModal] = useState(false)
  const [isToolsOpen, setIsToolsOpen] = useState(false)

  // Import state
  const [isProcessingImport, setIsProcessingImport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Merge real invoices with optimistic ones
  const allInvoices = useMemo(() => {
    return [...optimisticInvoices, ...invoices]
  }, [invoices, optimisticInvoices])

  // Filter and Sort invoices logic
  const filteredInvoices = useMemo(() => {
    let filtered = allInvoices

    // 1. Apply Filters
    switch (activeFilter) {
      case 'certified':
        filtered = filtered.filter(inv => ['CERTIFIED', 'EMITTED', 'APPROVED'].includes(inv.status))
        break
      case 'draft':
        filtered = filtered.filter(inv => inv.status === 'DRAFT')
        break
      case 'canceled':
        filtered = filtered.filter(inv => ['CANCELLED'].includes(inv.status))
        break
      case 'processing':
        filtered = filtered.filter(inv => ['PROCESSING', 'QUEUED'].includes(inv.status))
        break
      case 'error':
        filtered = filtered.filter(inv => ['ERROR', 'REJECTED'].includes(inv.status))
        break
      case 'recent':
        const dayAgo = new Date()
        dayAgo.setDate(dayAgo.getDate() - 1)
        filtered = filtered.filter(inv => new Date(inv.createdAt) > dayAgo)
        break
      default:
        break
    }

    // 2. Apply Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(invoice =>
        invoice.folio?.toLowerCase().includes(search) ||
        invoice.invoiceNumber?.toLowerCase().includes(search) ||
        invoice.clientName?.toLowerCase().includes(search) ||
        invoice.receiverName?.toLowerCase().includes(search) ||
        invoice.clientRuc?.toLowerCase().includes(search) ||
        invoice.receiverRuc?.toLowerCase().includes(search) ||
        invoice.cufe?.toLowerCase().includes(search)
      )
    }

    // 3. Apply Sorting
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'amount_desc':
          return (b.total || 0) - (a.total || 0);
        case 'amount_asc':
          return (a.total || 0) - (b.total || 0);
        case 'number_desc':
          return (b.folio || '').localeCompare(a.folio || '', undefined, { numeric: true, sensitivity: 'base' });
        case 'number_asc':
          return (a.folio || '').localeCompare(b.folio || '', undefined, { numeric: true, sensitivity: 'base' });
        case 'client_asc':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'client_desc':
          return (b.clientName || '').localeCompare(a.clientName || '');
        case 'items_desc':
          return (b.items?.length || 0) - (a.items?.length || 0);
        case 'status_group':
          const priority: Record<string, number> = { 'ERROR': 0, 'REJECTED': 0, 'PROCESSING': 1, 'QUEUED': 2, 'DRAFT': 3, 'CERTIFIED': 4, 'EMITTED': 4, 'APPROVED': 4, 'CANCELLED': 5 };
          return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
        case 'dueDate_asc':
          // Assume issueDate + 30 days if no due date, but model has it sometimes
          const dateA = a.issueDate ? new Date(a.issueDate) : new Date(a.createdAt);
          const dateB = b.issueDate ? new Date(b.issueDate) : new Date(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        default:
          return 0;
      }
    });
  }, [allInvoices, activeFilter, searchTerm, sortBy])

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    let type: InputFileType = 'xlsx'
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.xls')) type = 'xls'
    else if (fileName.endsWith('.xlsx')) type = 'xlsx'
    else if (fileName.endsWith('.xml')) type = 'xml'
    else {
      toast.error('Formato no soportado. Use Excel (.xlsx, .xls) o XML (.xml)')
      return
    }

    setIsProcessingImport(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const result = await parseInvoiceFile(formData)
      if (result.success && result.data) {
        toast.success('Archivo procesado correctamente')
        openGenerator(result.data)
      } else {
        toast.error(result.error || 'Error al procesar archivo')
      }
    } catch {
      toast.error('Error inesperado al procesar el archivo')
    } finally {
      setIsProcessingImport(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-transparent pb-24 md:pb-12">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      <main className="max-w-7xl mx-auto px-4 pt-4 md:px-8 md:pt-8 space-y-6">
        {/* Banner de Modo Contingencia — visible solo cuando contingencia está activa */}
        <ContingencyBanner />

        {/* Facturas offline pendientes de sincronización (IndexedDB) */}
        {clientId && <PendingOfflineInvoices clientId={clientId} />}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-[64px] md:static z-30 bg-gray-50 dark:bg-transparent md:bg-transparent py-3 md:py-0 border-b border-gray-200 dark:border-white/[0.1] md:border-none shadow-sm md:shadow-none">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              Gestión de Facturas
            </h1>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full md:w-auto">

            <InvoiceSort currentSort={sortBy} onSortChange={setSortBy} />

            {/* Reporte ITBMS (PDF con desglose mensual) */}
            <ItbmsReportButton />

            {/* Subir Excel */}
            <button
              onClick={handleImportClick}
              disabled={isProcessingImport}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors shadow-sm p-2.5 md:px-4 md:py-2.5 disabled:opacity-60 disabled:cursor-wait"
              aria-label="Subir Excel"
            >
              {isProcessingImport ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Upload size={18} className="text-emerald-500" />}
              <span className="hidden md:inline">{isProcessingImport ? "Procesando..." : "Subir Excel"}</span>
            </button>

            {/* Primary: New Document (opens wizard directly) */}
            <button
              onClick={() => openGenerator()}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-violet-500/20 p-2.5 md:px-4 md:py-2.5 whitespace-nowrap"
              aria-label="Crear factura"
            >
              <Plus size={18} />
              <span className="hidden md:inline">Crear factura</span>
            </button>

            {/* Secondary: overflow menu with DGI tools only (Import moved out) */}
            <ToolsMenu
              isOpen={isToolsOpen}
              onOpenChange={setIsToolsOpen}
              onStatus={() => setShowStatusModal(true)}
              onRuc={() => setShowRucModal(true)}
              onFolios={() => setShowFoliosModal(true)}
            />
          </div>
        </div>

        {/* Resumen fiscal: recaudación de impuestos (ITBMS) — colapsable */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/20 shrink-0">
              <Calculator size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300 truncate">
              Recaudación de impuestos (ITBMS)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg md:text-xl font-black text-violet-700 dark:text-violet-300 tabular-nums">
              {showItbms ? formatCurrency(stats.totalItbms) : '••••••'}
            </span>
            <button
              type="button"
              onClick={() => setShowItbms((v) => !v)}
              aria-label={showItbms ? 'Ocultar recaudación' : 'Mostrar recaudación'}
              className="p-1 rounded-md text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
            >
              {showItbms ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente, folio, RUC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1] rounded-xl",
              "py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-violet-500 transition-all shadow-sm"
            )}
          />
        </div>

        {/* Unified Filters */}
        <InvoiceFilters
          stats={stats}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Unified List */}
        <ResponsiveInvoiceList invoices={filteredInvoices} onSuccess={invalidateAll} />

        {/* Results Count */}
        <p className="text-center text-xs text-slate-500">
          Mostrando {filteredInvoices.length} de {invoices.length} documentos
        </p>
      </main>

      {/* ==================== MODALS ==================== */}
      <RucValidationModal
        isOpen={showRucModal}
        onClose={() => setShowRucModal(false)}
      />
      <StatusQueryModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      />
      <FoliosConsultationModal
        isOpen={showFoliosModal}
        onClose={() => setShowFoliosModal(false)}
      />
    </div>
  )
}

// ─── Tools overflow menu (import + DGI lookups) ──────────────────────────────

interface ToolsMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onStatus: () => void
  onRuc: () => void
  onFolios: () => void
}

function ToolsMenu({
  isOpen,
  onOpenChange,
  onStatus,
  onRuc,
  onFolios,
}: ToolsMenuProps) {
  const handlePick = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Más acciones"
        className={cn(
          "flex items-center justify-center p-2.5 rounded-xl transition-all",
          "bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1]",
          "text-gray-700 dark:text-gray-300 hover:border-violet-400 dark:hover:border-violet-500/50 shadow-sm",
          isOpen && "ring-2 ring-violet-500/20 border-violet-500"
        )}
      >
        <MoreHorizontal size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "absolute right-0 mt-2 w-64 z-50 p-2 overflow-hidden",
                "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
                "border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                Consultas DGI
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => handlePick(onStatus)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <FileSearch size={16} className="text-blue-500" />
                Estado DGI
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handlePick(onRuc)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <CheckCircle size={16} className="text-emerald-500" />
                Validar RUC
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handlePick(onFolios)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <Database size={16} className="text-violet-500" />
                Consultar Folios
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
