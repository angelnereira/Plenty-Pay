"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DocumentoElectronico } from "@/features/hka/model/types/types"
import { RecentInvoices } from "./recent-invoices"
import { TipsCarousel } from "./tips-carousel"
import { ModuleQuickAccess } from "./module-quick-access"
import { ModuleStatsGrid } from "./module-stats-grid"
import dynamic from 'next/dynamic'

// Lazy load import review modal
const InvoiceReviewModal = dynamic(() => import("@/features/invoicing/ui/invoice-review-modal").then(mod => mod.InvoiceReviewModal), { ssr: false })
const FoliosConsultationModal = dynamic(() => import("@/components/dashboard/folios-consultation-modal").then(mod => mod.FoliosConsultationModal), { ssr: false })

// Components
import { HeroFinancialCard } from "./hero-financial-card"
import { MobileInvoiceItem } from "./mobile-invoice-item"

import { useInvoiceGenerator } from "@/components/dashboard/invoice-generator-provider"

type InputFileType = 'xlsx' | 'xls' | 'xml'
type EnviarFacturaRequest = DocumentoElectronico

import { parseInvoiceFile } from "@/app/actions/invoice/parse-invoice-file.action"
import { toast } from "sonner"
import {
  FileText,
  ChevronRight,
} from "lucide-react"

import type { DashboardData } from "@/actions/dashboard-actions"

interface DashboardContentProps {
  data: DashboardData
  userRole?: string
  inventoryEnabled?: boolean
  posEnabled?: boolean
  paydayEnabled?: boolean
  logisticsEnabled?: boolean
}

import { useDashboardData } from "@shared/hooks/use-dashboard-data"
import { useQueryInvalidation } from "@/hooks/useServerActionMutation"

export function DashboardContent({
  data: initialData,
  userRole,
  inventoryEnabled,
  posEnabled,
  paydayEnabled,
  logisticsEnabled,
}: DashboardContentProps) {
  const { data } = useDashboardData(initialData)
  const { invalidateAll } = useQueryInvalidation()

  const { userName, stats, moduleStats, invoices } = data || initialData

  const router = useRouter()

  // Import state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [invoiceData, setInvoiceData] = useState<EnviarFacturaRequest | null>(null)
  const [isProcessingImport, setIsProcessingImport] = useState(false)

  const { openGenerator } = useInvoiceGenerator()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Folios modal — consulta bajo demanda, no automática
  const [showFoliosModal, setShowFoliosModal] = useState(false)

  const handleEmissionSuccess = () => {
    invalidateAll()
    router.refresh()
  }

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
        setInvoiceData(result.data)
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

  // Handle quick access actions
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'openGenerator':
        openGenerator()
        break
      case 'importFile':
        handleImportClick()
        break
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-transparent pb-20 md:pb-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xml"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Main Content */}
        <div className="px-4 py-5 space-y-6 max-w-7xl mx-auto w-full md:px-8 md:py-8">

          {/* Hero Financial Card */}
          <div className="w-full">
            <HeroFinancialCard
              totalAmount={stats.totalAmount}
              certifiedCount={stats.certifiedInvoices}
              pendingCount={stats.pendingInvoices}
              accumulatedItbms={stats.totalItbms}
              usageCounter={`${stats.totalInvoices}/5k`}
              mode={stats.billingCardMode}
              onFoliosClick={() => setShowFoliosModal(true)}
            />
          </div>

          {/* Tips Carousel — replaces Nueva Factura / Importar actions */}
          <TipsCarousel />

          {/* Module Stats Grid - Hidden on Desktop as requested, visible on Mobile */}
          {moduleStats && (
            <div className="md:hidden">
              <ModuleStatsGrid moduleStats={moduleStats} />
            </div>
          )}

          {/* Module Quick Access - Dynamic shortcuts per module */}
          <ModuleQuickAccess
            inventoryEnabled={inventoryEnabled}
            posEnabled={posEnabled}
            paydayEnabled={paydayEnabled}
            logisticsEnabled={logisticsEnabled}
            onAction={handleQuickAction}
          />

          {/* Recent Invoices Section */}
          <div className="premium-card">
            <div className="p-6 border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.05]">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  Facturas Recientes
                </h3>
                <Link
                  href="/dashboard/facturas"
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-all flex items-center gap-2"
                >
                  Ver todas
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block p-0">
              <RecentInvoices invoices={invoices} />
            </div>

            {/* Mobile List View */}
            <div className="md:hidden p-4 space-y-2">
              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No hay facturas recientes</p>
                  <button
                    onClick={() => openGenerator()}
                    className="mt-3 text-sm font-medium text-blue-500 hover:text-blue-600"
                  >
                    Crear primera factura
                  </button>
                </div>
              ) : (
                invoices.slice(0, 5).map((invoice) => (
                  <MobileInvoiceItem
                    key={invoice.id}
                    id={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    total={invoice.total.toString()}
                    status={invoice.status}
                    createdAt={invoice.createdAt}
                  />
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Import Review Modal */}
      <InvoiceReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        data={invoiceData}
        onSuccess={handleEmissionSuccess}
      />

      {/* Folios Consultation Modal — solo se abre bajo demanda del usuario */}
      <FoliosConsultationModal
        isOpen={showFoliosModal}
        onClose={() => setShowFoliosModal(false)}
      />
    </>
  )
}
