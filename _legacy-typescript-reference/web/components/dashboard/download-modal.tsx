"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import { Download, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DownloadModalProps {
  isOpen: boolean
  onClose: () => void
  type: "pdf" | "xml"
}

export function DownloadModal({ isOpen, onClose, type }: DownloadModalProps) {
  const [cufe, setCufe] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    if (!cufe.trim()) {
      toast.error("Por favor ingresa el CUFE de la factura")
      return
    }

    setIsLoading(true)
    try {
      toast.info("Conectando con la DGI. Esto puede tardar unos 10 segundos...", { duration: 10000, id: 'dgi-loading' })
      const endpoint = type === "pdf" ? "/api/hka/descargar-pdf" : "/api/hka/descargar-xml"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cufe: cufe.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Error al descargar")
      }

      // Obtener el blob y descargar
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `factura-${cufe.substring(0, 8)}.${type}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${type.toUpperCase()} descargado exitosamente`)
      setCufe("")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al descargar el archivo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "pdf" ? (
              <FileText className="h-5 w-5 text-red-500" />
            ) : (
              <Download className="h-5 w-5 text-blue-500" />
            )}
            Descargar {type.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Ingresa el CUFE de la factura para descargar el archivo {type.toUpperCase()}
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
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleDownload} disabled={isLoading || !cufe.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar {type.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

