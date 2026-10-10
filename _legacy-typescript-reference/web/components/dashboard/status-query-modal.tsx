"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import { Search, Loader2, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@shared/ui/badge"

interface StatusQueryModalProps {
  isOpen: boolean
  onClose: () => void
}

interface StatusResult {
  cufe: string
  estado: string
  fechaEmision?: string
  fechaAutorizacion?: string
  motivoRechazo?: string
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  AUTORIZADO: { icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-100 text-green-700", label: "Autorizado" },
  APROBADO: { icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-100 text-green-700", label: "Aprobado" },
  PENDIENTE: { icon: <Clock className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-700", label: "Pendiente" },
  PROCESANDO: { icon: <Clock className="h-4 w-4" />, color: "bg-blue-100 text-blue-700", label: "Procesando" },
  RECHAZADO: { icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-700", label: "Rechazado" },
  ERROR: { icon: <AlertCircle className="h-4 w-4" />, color: "bg-red-100 text-red-700", label: "Error" },
}

export function StatusQueryModal({ isOpen, onClose }: StatusQueryModalProps) {
  const [cufe, setCufe] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<StatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleQuery = async () => {
    if (!cufe.trim()) {
      toast.error("Por favor ingresa el CUFE de la factura")
      return
    }

    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch("/api/hka/estado-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cufe: cufe.trim() }),
      })
      const data = await response.json()

      if (data.success) {
        const responseData = data.data || data;
        setResult({
          cufe: responseData.cufe || cufe.trim(),
          estado: responseData.estatusDocumento || responseData.hkaStatus || responseData.status || "DESCONOCIDO",
          fechaEmision: responseData.fechaEmisionDocumento || responseData.fechaEmision,
          fechaAutorizacion: responseData.fechaRecepcionDocumento || responseData.fechaAutorizacion,
          motivoRechazo: responseData.mensajeDocumento || responseData.hkaMessage,
        })
        toast.success("Estado consultado exitosamente")
      } else {
        setError(data.error || "Error al consultar el estado")
        toast.error(data.error || "Error al consultar el estado")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de conexión"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCufe("")
    setResult(null)
    setError(null)
    onClose()
  }

  const getStatusDisplay = (estado: string) => {
    const config = statusConfig[estado.toUpperCase()] || statusConfig.PENDIENTE
    return config
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Consultar Estado de Factura
          </DialogTitle>
          <DialogDescription>
            Verifica el estado de certificación de una factura en HKA/DGI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cufe">CUFE de la Factura</Label>
            <Input
              id="cufe"
              placeholder="Ej: FE0120000000001..."
              value={cufe}
              onChange={(e) => setCufe(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              El CUFE es el código único de la factura electrónica
            </p>
          </div>

          {/* Resultado */}
          {result && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Estado:</span>
                <Badge className={`${getStatusDisplay(result.estado).color} flex items-center gap-1`}>
                  {getStatusDisplay(result.estado).icon}
                  {getStatusDisplay(result.estado).label}
                </Badge>
              </div>
              
              <div className="text-xs font-mono text-gray-500 break-all">
                CUFE: {result.cufe}
              </div>

              {result.fechaEmision && (
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fecha Emisión:</span>{" "}
                  <span className="font-medium">{result.fechaEmision}</span>
                </div>
              )}

              {result.fechaAutorizacion && (
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fecha Autorización:</span>{" "}
                  <span className="font-medium">{result.fechaAutorizacion}</span>
                </div>
              )}

              {result.motivoRechazo && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-400">
                  <strong>Motivo de Rechazo:</strong> {result.motivoRechazo}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cerrar
          </Button>
          <Button onClick={handleQuery} disabled={isLoading || !cufe.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Consultar Estado
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

