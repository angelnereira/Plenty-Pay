"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import { Textarea } from "@shared/ui/textarea"
import { Checkbox } from "@shared/ui/checkbox"
import { Mail, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface SendEmailModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SendEmailModal({ isOpen, onClose }: SendEmailModalProps) {
  const [cufe, setCufe] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [includePDF, setIncludePDF] = useState(true)
  const [includeXML, setIncludeXML] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSend = async () => {
    if (!cufe.trim()) {
      toast.error("Por favor ingresa el CUFE de la factura")
      return
    }
    if (!email.trim()) {
      toast.error("Por favor ingresa el correo electrónico")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Por favor ingresa un correo electrónico válido")
      return
    }

    setIsLoading(true)
    setSuccess(false)

    try {
      toast.info("Conectando con la DGI para generar archivos adjuntos. Esto puede tardar unos segundos...", { duration: 10000, id: 'dgi-loading' })
      const response = await fetch("/api/hka/envio-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cufe: cufe.trim(),
          email: email.trim(),
          includePDF,
          includeXML,
          message: message.trim() || undefined
        }),
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        toast.success("Factura enviada por correo exitosamente")
        setTimeout(() => {
          handleClose()
        }, 2000)
      } else {
        toast.error(data.error || "Error al enviar el correo")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCufe("")
    setEmail("")
    setMessage("")
    setIncludePDF(true)
    setIncludeXML(true)
    setSuccess(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Enviar Factura por Email
          </DialogTitle>
          <DialogDescription>
            Envía la factura directamente al cliente por correo electrónico
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              ¡Correo Enviado!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              La factura ha sido enviada a {email}
            </p>
          </div>
        ) : (
          <>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo del Destinatario</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensaje Personalizado (opcional)</Label>
                <Textarea
                  id="message"
                  placeholder="Escribe un mensaje para el cliente..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isLoading}
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <Label>Archivos a Incluir</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    {...({
                      id: "includePDF",
                      checked: includePDF,
                      onCheckedChange: (checked: any) => setIncludePDF(checked as boolean),
                      disabled: isLoading
                    } as any)}
                  />
                  <label htmlFor="includePDF" className="text-sm text-gray-700 dark:text-gray-300">
                    Incluir PDF de la factura
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    {...({
                      id: "includeXML",
                      checked: includeXML,
                      onCheckedChange: (checked: any) => setIncludeXML(checked as boolean),
                      disabled: isLoading
                    } as any)}
                  />
                  <label htmlFor="includeXML" className="text-sm text-gray-700 dark:text-gray-300">
                    Incluir XML firmado
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={isLoading || !cufe.trim() || !email.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Correo
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

