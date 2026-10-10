"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import { Textarea } from "@shared/ui/textarea"
import { XCircle, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface CancelInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optional callback to refresh invoice list after successful cancellation */
  onSuccess?: () => void
}

export function CancelInvoiceModal({ isOpen, onClose, onSuccess }: CancelInvoiceModalProps) {
  const [cufe, setCufe] = useState("")
  const [motivo, setMotivo] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = async () => {
    if (!cufe.trim()) {
      toast.error("Por favor ingresa el CUFE de la factura")
      return
    }
    if (!motivo.trim()) {
      toast.error("Por favor ingresa el motivo de anulación")
      return
    }
    if (motivo.trim().length < 15) {
      toast.error("El motivo debe tener al menos 15 caracteres")
      return
    }

    setIsLoading(true)

    try {
      toast.info("Enviando solicitud de anulación a la DGI. Esto puede tardar unos segundos...", { duration: 10000, id: 'dgi-loading' })
      const response = await fetch("/api/hka/anulacion-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cufe: cufe.trim(),
          motivo: motivo.trim()
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success("Solicitud de anulación enviada exitosamente")
        handleClose()
        // Trigger invoice list refresh via React Query
        onSuccess?.()
      } else {
        toast.error(data.error || "Error al solicitar la anulación")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCufe("")
    setMotivo("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Anular Factura
          </DialogTitle>
          <DialogDescription>
            Solicita la anulación de una factura certificada ante la DGI
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
          <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <strong>Importante:</strong> La anulación de facturas es un proceso irreversible.
              Asegúrate de que el CUFE y el motivo sean correctos antes de continuar.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cufe">CUFE de la Factura</Label>
            <Input
              id="cufe"
              placeholder="Ej: FE0120000000001..."
              value={cufe}
              onChange={(e) => setCufe(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo de Anulación</Label>
            <Textarea
              id="motivo"
              placeholder="Describe el motivo de la anulación (mínimo 10 caracteres)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
            <p className="text-xs text-gray-500">
              {motivo.length}/15 caracteres mínimos
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading || !cufe.trim() || motivo.trim().length < 15}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Anular Factura
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

