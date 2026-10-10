'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Package, Truck, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrackingData {
  code: string
  status: string
  customerName: string
  scheduledDate: string | null
  estimatedDate: string | null
  deliveredAt: string | null
  carrier: string | null
  driver: string | null
  items: Array<{ description: string; quantity: string }>
  statusHistory: Array<{ status: string; date: string; notes: string | null }>
}

export default function PublicTrackingPage() {
  const params = useParams()
  const qrToken = params.qrToken as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TrackingData | null>(null)

  useEffect(() => {
    async function fetchTracking() {
      try {
        const res = await fetch(`/api/public/track/${qrToken}`)
        const json = await res.json()

        if (!res.ok) {
          setError(json.error || 'No se pudo cargar la información de seguimiento')
          return
        }

        setData(json)
      } catch {
        setError('Ocurrió un error al conectar con el servidor')
      } finally {
        setLoading(false)
      }
    }

    if (qrToken) fetchTracking()
  }, [qrToken])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-600 animate-pulse font-medium">Localizando tu envío...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ups! Algo salió mal</h1>
          <p className="text-slate-500 mb-8">{error || 'La orden que buscas no existe o el enlace ha expirado.'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, label: 'Entregado' }
      case 'IN_TRANSIT':
        return { color: 'text-blue-600', bg: 'bg-blue-50', icon: Truck, label: 'En Camino' }
      case 'CANCELLED':
        return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, label: 'Cancelado' }
      default:
        return { color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, label: 'Pendiente' }
    }
  }

  const statusConfig = getStatusConfig(data.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary/10">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Package className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">PlentyPay</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">Logística & Tracking</p>
            </div>
          </div>
          <div className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase", statusConfig.bg, statusConfig.color)}>
            {statusConfig.label}
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-6 space-y-6">
        {/* Status Card */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <StatusIcon className="h-32 w-32" />
          </div>
          <div className="relative">
            <h2 className="text-slate-500 font-medium mb-1">Orden de Entrega</h2>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-4xl font-extrabold tracking-tight">{data.code}</span>
            </div>
            
            <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", statusConfig.bg)}>
                <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
              </div>
              <div className="flex-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Estado Actual</p>
                <h3 className={cn("text-lg font-bold", statusConfig.color)}>{statusConfig.label}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cliente</p>
                <p className="font-semibold text-slate-700">{data.customerName}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Programado</p>
                <p className="font-semibold text-slate-700">
                  {data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString() : 'Por definir'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <Truck className="h-5 w-5 text-primary" />
              <h3 className="font-bold">Transporte</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Empresa</p>
                <p className="text-sm font-semibold">{data.carrier || 'Asignando...'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Conductor</p>
                <p className="text-sm font-semibold">{data.driver || 'Pendiente de asignar'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-bold">Contenido</h3>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {data.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-600 font-medium truncate pr-4">{item.description}</span>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg font-bold">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Historial de Envío</h3>
          </div>
          <div className="relative pl-6 space-y-10 after:absolute after:left-0 after:top-2 after:bottom-2 after:w-0.5 after:bg-slate-100 after:rounded-full">
            {data.statusHistory.map((history, idx) => (
              <div key={idx} className="relative">
                <div className={cn(
                  "absolute -left-[1.85rem] top-1.5 h-4 w-4 rounded-full border-4 border-white shadow-sm z-10",
                  idx === 0 ? "bg-primary" : "bg-slate-300"
                )} />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                    {new Date(history.date).toLocaleString()}
                  </span>
                  <h4 className={cn("font-bold", idx === 0 ? "text-slate-900" : "text-slate-400")}>
                    {getStatusConfig(history.status).label}
                  </h4>
                  {history.notes && (
                    <p className="mt-1 text-sm text-slate-500 italic">&quot;{history.notes}&quot;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 opacity-40">
          <p className="text-xs font-medium">© 2026 PlentyPay Panama. Todos los derechos reservados.</p>
        </footer>
      </main>
    </div>
  )
}
