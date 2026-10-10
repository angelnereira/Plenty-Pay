"use client"

import { useState } from 'react'
import { Mail, X, Loader2 } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface SendEmailButtonProps {
  invoiceId: string
  defaultEmail?: string
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  className?: string
}

export function SendEmailButton({ invoiceId, defaultEmail, disabled, variant = "outline", className }: SendEmailButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail || '')
  const [message, setMessage] = useState('')
  const [includePDF, setIncludePDF] = useState(true)
  const [includeXML, setIncludeXML] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSend = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Por favor ingrese un email válido')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email,
          includePDF,
          includeXML,
          customMessage: message || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar correo')
      }

      setSuccess('Factura enviada exitosamente por correo')
      setTimeout(() => {
        setIsOpen(false)
        setEmail(defaultEmail || '')
        setMessage('')
        setSuccess('')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Error al enviar correo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={className}
      >
        <Mail className="mr-2 h-4 w-4" />
        Enviar por Correo
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Enviar Factura por Correo
              </h2>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setError('')
                  setSuccess('')
                }}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Correo del Destinatario *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="cliente@empresa.com"
                />
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Mensaje Personalizado (Opcional)
                </label>
                <textarea
                  id="message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Estimado cliente, adjunto encontrará su factura electrónica..."
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Archivos Adjuntos
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includePDF}
                      onChange={(e) => setIncludePDF(e.target.checked)}
                      disabled={loading}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Incluir PDF</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={includeXML}
                      onChange={(e) => setIncludeXML(e.target.checked)}
                      disabled={loading}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Incluir XML</span>
                  </label>
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false)
                    setError('')
                    setSuccess('')
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSend} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Correo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
