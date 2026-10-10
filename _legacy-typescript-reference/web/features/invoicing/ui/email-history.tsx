"use client"

import { useEffect, useState } from 'react'
import { Mail, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface EmailDelivery {
  id: string
  recipientEmail: string
  hkaTrackingId: string | null
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED'
  sentAt: string | null
  deliveredAt: string | null
  includePDF: boolean
  includeXML: boolean
  customMessage: string | null
  retryCount: number
  lastError: string | null
  createdAt: string
}

interface EmailHistoryProps {
  invoiceId: string
}

export function EmailHistory({ invoiceId }: EmailHistoryProps) {
  const [emails, setEmails] = useState<EmailDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadHistory()
  }, [invoiceId])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invoices/${invoiceId}/email/history`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar historial')
      }

      setEmails(data.data || [])
    } catch (err: any) {
      setError(err.message || 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (hkaTrackingId: string | null) => {
    if (!hkaTrackingId) return

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/email/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hkaTrackingId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al actualizar estado')
      }

      // Recargar historial
      loadHistory()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado')
    }
  }

  const getStatusBadge = (status: EmailDelivery['status']) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      BOUNCED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    }

    const icons = {
      PENDING: Clock,
      SENT: Mail,
      DELIVERED: CheckCircle,
      BOUNCED: XCircle,
      FAILED: AlertCircle,
    }

    const labels = {
      PENDING: 'Pendiente',
      SENT: 'Enviado',
      DELIVERED: 'Entregado',
      BOUNCED: 'Rebotado',
      FAILED: 'Fallido',
    }

    const Icon = icons[status]

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        <Icon className="h-3 w-3" />
        {labels[status]}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('es-PA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Cargando historial...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No se han enviado correos para esta factura
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {emails.map((email) => (
        <div
          key={email.id}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {getStatusBadge(email.status)}
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {email.recipientEmail}
                </span>
              </div>
              {email.hkaTrackingId && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tracking ID: {email.hkaTrackingId}
                </p>
              )}
            </div>
            {(email.status === 'BOUNCED' || email.status === 'FAILED') && email.hkaTrackingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRetry(email.hkaTrackingId)}
              >
                Actualizar Estado
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mt-2">
            <div>
              <span className="font-medium">Enviado:</span> {formatDate(email.sentAt)}
            </div>
            {email.deliveredAt && (
              <div>
                <span className="font-medium">Entregado:</span> {formatDate(email.deliveredAt)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {email.includePDF && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">PDF</span>
            )}
            {email.includeXML && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">XML</span>
            )}
            {email.retryCount > 0 && (
              <span className="text-orange-600 dark:text-orange-400">
                Reintentos: {email.retryCount}
              </span>
            )}
          </div>

          {email.lastError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-200">
              {email.lastError}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
