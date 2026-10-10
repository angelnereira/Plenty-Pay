"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import { CheckCircle, Loader2, AlertCircle, User, Building2 } from "lucide-react"
import { toast } from "sonner"

interface RucValidationModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ValidationResult {
  ruc: string
  dv: string
  nombre: string
  tipoContribuyente: string
}

export function RucValidationModal({ isOpen, onClose }: RucValidationModalProps) {
  const [ruc, setRuc] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    if (!ruc.trim()) {
      toast.error("Por favor ingresa el RUC a validar")
      return
    }

    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch(`/api/ruc/${encodeURIComponent(ruc.trim())}/validate`)
      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        toast.success("RUC validado exitosamente")
      } else {
        setError(data.error || "Error al validar el RUC")
        toast.error(data.error || "Error al validar el RUC")
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
    setRuc("")
    setResult(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Validar RUC
          </DialogTitle>
          <DialogDescription>
            Consulta y valida la información fiscal de un contribuyente en la DGI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ruc">RUC del Contribuyente</Label>
            <Input
              id="ruc"
              placeholder="Ej: 155738031"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Ingresa el RUC sin guiones ni dígito verificador
            </p>
          </div>

          {/* Resultado */}
          {result && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">RUC Válido</span>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">Nombre:</span>
                  <span className="font-medium">{result.nombre || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">RUC:</span>
                  <span className="font-mono font-medium">{result.ruc}-{result.dv}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                  <span className="font-medium">{result.tipoContribuyente || "Contribuyente"}</span>
                </div>
              </div>
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
          <Button onClick={handleValidate} disabled={isLoading || !ruc.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Validar RUC
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

