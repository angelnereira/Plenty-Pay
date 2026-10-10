'use client'

import { useState, useRef, useEffect } from 'react'
import {
  FileText, Upload, CheckCircle, Search, FileMinus,
  Database, WifiOff, Download, ChevronRight, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TipStep {
  title: string
  description: string
}

interface Tip {
  id: string
  color: keyof typeof COLOR_MAP
  icon: React.ElementType
  title: string
  preview: string
  steps: TipStep[]
}

// ─── Color tokens ─────────────────────────────────────────────────────────────

const COLOR_MAP = {
  violet: {
    card: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40',
    iconWrap: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
    cta: 'text-violet-500 dark:text-violet-400',
    stepNum: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
    header: 'bg-violet-600',
  },
  emerald: {
    card: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    cta: 'text-emerald-500 dark:text-emerald-400',
    stepNum: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    header: 'bg-emerald-600',
  },
  blue: {
    card: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
    iconWrap: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    cta: 'text-blue-500 dark:text-blue-400',
    stepNum: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    header: 'bg-blue-600',
  },
  indigo: {
    card: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40',
    iconWrap: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
    cta: 'text-indigo-500 dark:text-indigo-400',
    stepNum: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
    header: 'bg-indigo-600',
  },
  amber: {
    card: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    cta: 'text-amber-500 dark:text-amber-400',
    stepNum: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    header: 'bg-amber-500',
  },
  cyan: {
    card: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/40',
    iconWrap: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400',
    cta: 'text-cyan-500 dark:text-cyan-400',
    stepNum: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
    header: 'bg-cyan-600',
  },
  rose: {
    card: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40',
    iconWrap: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400',
    cta: 'text-rose-500 dark:text-rose-400',
    stepNum: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
    header: 'bg-rose-600',
  },
  slate: {
    card: 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60',
    iconWrap: 'bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300',
    cta: 'text-slate-500 dark:text-slate-400',
    stepNum: 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300',
    header: 'bg-slate-700',
  },
} as const

// ─── Tip content ──────────────────────────────────────────────────────────────

const TIPS: Tip[] = [
  {
    id: 'emitir',
    color: 'violet',
    icon: FileText,
    title: 'Emitir una Factura',
    preview: 'Crea y certifica tu primera factura electrónica ante la DGI',
    steps: [
      { title: 'Accede al módulo', description: 'Ve a "Facturas" desde el menú y toca "Nueva Factura" en la esquina superior.' },
      { title: 'Completa los datos', description: 'Ingresa el RUC del cliente, los productos o servicios con sus precios.' },
      { title: 'Revisa y emite', description: 'Verifica la información y presiona "Emitir". La factura se envía a la DGI en segundos.' },
      { title: 'Descarga el PDF', description: 'Una vez certificada, descarga el comprobante para tu cliente.' },
    ],
  },
  {
    id: 'importar',
    color: 'emerald',
    icon: Upload,
    title: 'Importar desde Excel',
    preview: 'Sube un .xlsx o .xml para generar facturas automáticamente',
    steps: [
      { title: 'Prepara tu archivo', description: 'Usa una hoja con columnas: RUC, Nombre del cliente, Producto, Cantidad y Precio.' },
      { title: 'Importa el archivo', description: 'Toca "Importar" en Facturas y selecciona tu archivo .xlsx o .xml.' },
      { title: 'Revisa y emite', description: 'El sistema pre-llena todos los campos. Revisa los datos y emite con un clic.' },
    ],
  },
  {
    id: 'ruc',
    color: 'blue',
    icon: CheckCircle,
    title: 'Validar un RUC',
    preview: 'Verifica que el RUC de tu cliente esté activo en la DGI',
    steps: [
      { title: 'Abre la validación', description: 'En Facturas, toca "Validar RUC" en la barra de acciones rápidas.' },
      { title: 'Ingresa el RUC', description: 'Escribe el número de RUC y presiona buscar. Consulta la DGI en tiempo real.' },
      { title: 'Confirma el resultado', description: 'Verás el nombre registrado y si el RUC está habilitado para facturación.' },
    ],
  },
  {
    id: 'estado',
    color: 'indigo',
    icon: Search,
    title: 'Estado en la DGI',
    preview: 'Consulta si tu documento fue aprobado o rechazado',
    steps: [
      { title: 'Abre la consulta', description: 'En Facturas, toca "Estado DGI" en la barra de acciones rápidas.' },
      { title: 'Ingresa el CUFE', description: 'Pega el código CUFE de la factura que deseas consultar.' },
      { title: 'Revisa el estado', description: 'Verás si fue APROBADA, RECHAZADA o está en PROCESO ante la DGI.' },
    ],
  },
  {
    id: 'nota-credito',
    color: 'amber',
    icon: FileMinus,
    title: 'Nota de Crédito',
    preview: 'Anula o ajusta el monto de una factura certificada',
    steps: [
      { title: 'Selecciona la opción', description: 'Toca "Nota de Crédito" en la barra de acciones rápidas de Facturas.' },
      { title: 'Referencia la factura', description: 'Ingresa el número de la factura original que deseas ajustar o anular.' },
      { title: 'Define el ajuste', description: 'Especifica el monto o los ítems a ajustar y el motivo de la nota.' },
      { title: 'Certifica', description: 'La nota queda certificada ante la DGI y vinculada a la factura original.' },
    ],
  },
  {
    id: 'folios',
    color: 'cyan',
    icon: Database,
    title: 'Consultar Folios',
    preview: 'Revisa cuántos números de factura te quedan disponibles',
    steps: [
      { title: 'Abre la consulta', description: 'En Facturas, toca "Folios" en la barra de acciones rápidas.' },
      { title: 'Revisa tu saldo', description: 'Verás el rango de folios asignados y cuántos quedan disponibles.' },
      { title: 'Solicita más', description: 'Si quedan pocos, solicita una nueva asignación directamente desde la DGI.' },
    ],
  },
  {
    id: 'contingencia',
    color: 'rose',
    icon: WifiOff,
    title: 'Modo Contingencia',
    preview: 'Sigue emitiendo facturas aunque la DGI no esté disponible',
    steps: [
      { title: 'Activación automática', description: 'El modo contingencia se activa solo cuando los servidores DGI no responden.' },
      { title: 'Emite con normalidad', description: 'Continúa emitiendo. Las facturas se guardan con numeración de contingencia.' },
      { title: 'Sincronización', description: 'Al restaurarse la conexión, todas las facturas se certifican automáticamente.' },
    ],
  },
  {
    id: 'pdf',
    color: 'slate',
    icon: Download,
    title: 'Descargar PDF',
    preview: 'Obtén el comprobante en PDF de cualquier factura certificada',
    steps: [
      { title: 'Busca la factura', description: 'Ve a Facturas y localiza el documento certificado que necesitas.' },
      { title: 'Abre el detalle', description: 'Toca la factura para ver su detalle completo con CUFE y datos del receptor.' },
      { title: 'Descarga', description: 'Presiona "Descargar PDF" para obtener el comprobante oficial listo para el cliente.' },
    ],
  },
]

// ─── Tip Modal ────────────────────────────────────────────────────────────────

function TipModal({ tip, onClose }: { tip: Tip | null; onClose: () => void }) {
  if (!tip) return null

  const colors = COLOR_MAP[tip.color]
  const Icon = tip.icon

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className={cn('px-5 py-4 flex items-center justify-between', colors.header)}>
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20">
              <Icon className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-black text-white text-base uppercase tracking-tight">
              {tip.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Steps */}
        <div className="overflow-y-auto scrollbar-hide flex-1 p-5 space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {tip.preview}
          </p>

          {tip.steps.map((step, i) => (
            <div
              key={i}
              className="flex gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50"
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs',
                colors.stepNum
              )}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {step.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-sm transition-colors"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tips Carousel ────────────────────────────────────────────────────────────

interface TipsCarouselProps {
  className?: string
}

export function TipsCarousel({ className }: TipsCarouselProps) {
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll every 3.5 s
  useEffect(() => {
    if (isPaused) return
    const el = containerRef.current
    if (!el) return

    const interval = setInterval(() => {
      const cardWidth = el.scrollWidth / TIPS.length
      const maxScroll = el.scrollWidth - el.clientWidth
      const next = el.scrollLeft + cardWidth
      el.scrollTo({ left: next >= maxScroll - 4 ? 0 : next, behavior: 'smooth' })
    }, 3500)

    return () => clearInterval(interval)
  }, [isPaused])

  const handleCardClick = (tip: Tip) => {
    setIsPaused(true)
    setSelectedTip(tip)
  }

  const handleModalClose = () => {
    setSelectedTip(null)
    setIsPaused(false)
  }

  return (
    <div className={className}>
      {/* Label */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Guías rápidas
        </p>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          Toca para aprender
        </span>
      </div>

      {/* Scrollable cards */}
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-1"
        onTouchStart={() => setIsPaused(true)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {TIPS.map((tip) => {
          const colors = COLOR_MAP[tip.color]
          const Icon = tip.icon

          return (
            <button
              key={tip.id}
              onClick={() => handleCardClick(tip)}
              className={cn(
                'snap-start flex-shrink-0 w-[200px] md:w-[220px] rounded-2xl border p-4 text-left',
                'transition-transform duration-200 active:scale-[0.97] hover:scale-[1.02]',
                colors.card
              )}
            >
              {/* Icon */}
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', colors.iconWrap)}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Title */}
              <p className="font-black text-xs uppercase tracking-tight text-slate-900 dark:text-white mb-1 leading-tight">
                {tip.title}
              </p>

              {/* Preview */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                {tip.preview}
              </p>

              {/* CTA */}
              <div className={cn('flex items-center gap-0.5 mt-3 text-[10px] font-bold uppercase tracking-wide', colors.cta)}>
                Ver guía
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal */}
      <TipModal tip={selectedTip} onClose={handleModalClose} />
    </div>
  )
}
