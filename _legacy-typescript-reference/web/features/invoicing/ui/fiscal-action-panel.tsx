'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import {
  Download,
  FileCode,
  Mail,
  AlertTriangle,
  Loader2,
  CheckCircle,
  RefreshCw,
  XCircle,
  Clock,
} from 'lucide-react';

interface FiscalActionPanelProps {
  invoiceId: string;
  cufe: string | null;
  status: string;
  customerEmail?: string;
  onStatusChange?: () => void;
}

const statusConfig = {
  DRAFT: {
    label: 'Borrador',
    color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
    icon: '',
  },
  QUEUED: {
    label: 'En Cola',
    color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400',
    icon: '',
  },
  PROCESSING: {
    label: 'Procesando',
    color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400',
    icon: '',
  },
  EMITTED: {
    label: 'Emitida',
    color: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',
    icon: '',
  },
  CERTIFIED: {
    label: 'Certificada',
    color: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',
    icon: '',
  },
  CANCELLED: {
    label: 'Anulada',
    color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
    icon: '',
  },
  ERROR: {
    label: 'Error',
    color: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400',
    icon: '',
  },
};

/**
 * FiscalActionPanel - Panel de Operaciones Fiscales
 * Organiza todas las acciones HKA relacionadas con una factura en un panel contextual
 */
export function FiscalActionPanel({
  invoiceId,
  cufe,
  status,
  customerEmail,
  onStatusChange,
}: FiscalActionPanelProps) {
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const statusInfo =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

  const isEmittedOrCertified =
    status === 'EMITTED' || status === 'CERTIFIED';
  const canBeCancelled = isEmittedOrCertified;

  // Verificar estado del documento con HKA
  const handleCheckStatus = async () => {
    if (!cufe) {
      setError('No se puede verificar el estado sin CUFE');
      return;
    }

    setIsCheckingStatus(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/hka/estado-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cufe }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Estado: ${data.data.estado} - ${data.data.mensaje}`);
        if (onStatusChange) {
          setTimeout(() => onStatusChange(), 1500);
        }
      } else {
        setError(data.error || 'Error al consultar estado');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Descargar PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al obtener PDF' }));
        throw new Error(errorData.error || 'Error al descargar PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${cufe || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Error al descargar PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  // Descargar XML
  const handleDownloadXML = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/xml`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al obtener XML' }));
        throw new Error(errorData.error || 'Error al descargar XML');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${cufe || invoiceId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Error al descargar XML');
    } finally {
      setIsDownloading(false);
    }
  };

  // Anular factura
  const handleCancelInvoice = async () => {
    if (!cufe || !cancelReason.trim()) {
      setError('El motivo de anulación es requerido');
      return;
    }

    setIsCancelling(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/hka/anulacion-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cufe, motivo: cancelReason }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Factura anulada exitosamente');
        setShowCancelModal(false);
        setCancelReason('');
        if (onStatusChange) {
          setTimeout(() => onStatusChange(), 1500);
        }
      } else {
        setError(data.error || 'Error al anular factura');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsCancelling(false);
    }
  };

  // Enviar por email
  const handleSendEmail = async (email: string) => {
    if (!email) {
      setError('Por favor ingresa un email válido');
      return;
    }

    try {
      const response = await fetch('/api/hka/envio-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cufe, email }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Factura enviada por email exitosamente');
      } else {
        setError(data.error || 'Error al enviar email');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <div className="font-semibold mb-1">Error</div>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="font-semibold mb-1 text-green-800 dark:text-green-300">Éxito</div>
          <AlertDescription className="text-green-700 dark:text-green-300">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* A. Estado del Documento */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Estado del Documento</CardTitle>
            <Badge className={statusInfo.color}>
              {statusInfo.icon} {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isEmittedOrCertified && cufe && (
            <Button
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isCheckingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refrescar Estado en HKA
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* B. Documentos Digitales */}
      {isEmittedOrCertified && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentos Digitales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              variant="outline"
              className="w-full justify-start"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF Oficial
            </Button>
            <Button
              onClick={handleDownloadXML}
              disabled={isDownloading}
              variant="outline"
              className="w-full justify-start"
              size="sm"
            >
              <FileCode className="mr-2 h-4 w-4" />
              Descargar XML Firmado
            </Button>
          </CardContent>
        </Card>
      )}

      {/* C. Comunicación */}
      {isEmittedOrCertified && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Envío al Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email del Cliente
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@ejemplo.com"
                defaultValue={customerEmail || ''}
              />
            </div>
            <Button
              onClick={() => {
                const emailInput = document.getElementById('email') as HTMLInputElement;
                handleSendEmail(emailInput?.value || '');
              }}
              className="w-full"
              size="sm"
            >
              <Mail className="mr-2 h-4 w-4" />
              Reenviar Factura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* D. Zona de Peligro - Anulación */}
      {canBeCancelled && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600 dark:text-red-400">
              Zona de Peligro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowCancelModal(true)}
              variant="outline"
              className="w-full border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              size="sm"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Anular Factura Fiscal
            </Button>

            {/* Modal de confirmación */}
            {showCancelModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md mx-4">
                  <CardHeader>
                    <CardTitle className="text-red-600">Confirmar Anulación</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <div className="font-semibold mb-1">Acción Irreversible</div>
                      <AlertDescription>
                        Esta acción no puede deshacerse. La factura será marcada como anulada
                        en el sistema fiscal.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="cancel-reason">
                        Motivo de Anulación (Requerido)
                      </Label>
                      <Textarea
                        id="cancel-reason"
                        placeholder="Ej: Factura emitida por error"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="min-h-24"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setShowCancelModal(false);
                          setCancelReason('');
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCancelInvoice}
                        disabled={isCancelling || !cancelReason.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Anulando...
                          </>
                        ) : (
                          'Anular'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
