'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import {
  CheckCircle,
  AlertTriangle,
  Download,
  Copy,
  Clock,
  FileText,
  QrCode,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatPanamaDateReadable } from '@/lib/utils/date-timezone';

interface HkaResponseDisplayProps {
  /**
   * Datos de respuesta de HKA
   */
  data: {
    invoiceId: string;
    status: 'CERTIFIED' | 'EMITTED' | 'ERROR' | 'PROCESSING';
    hkaResponseCode?: string;
    hkaResponseMessage?: string;
    cufe?: string;
    cafe?: string;
    numeroDocumentoFiscal?: string;
    qrUrl?: string;
    qrCode?: string; // Base64
    pdfBase64?: string;
    hkaProtocolDate?: string;
    protocoloAutorizacion?: string;
  };
  onDownloadPDF?: () => Promise<void>;
  onDownloadXML?: () => Promise<void>;
  onRefreshStatus?: () => Promise<void>;
}

/**
 * HKA Response Display
 * Muestra la respuesta de HKA de forma clara y organizada
 * Incluye CUFE, QR, PDF, y opciones de gestión
 */
export function HkaResponseDisplay({
  data,
  onDownloadPDF,
  onDownloadXML,
  onRefreshStatus,
}: HkaResponseDisplayProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isSuccess = data.status === 'CERTIFIED' || data.status === 'EMITTED';
  const isError = data.status === 'ERROR';
  const isProcessing = data.status === 'PROCESSING';

  const statusConfig = {
    CERTIFIED: {
      icon: CheckCircle,
      label: 'Certificada',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      badgeColor: 'bg-green-600 dark:bg-green-700',
    },
    EMITTED: {
      icon: CheckCircle,
      label: 'Emitida',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      badgeColor: 'bg-blue-600 dark:bg-blue-700',
    },
    ERROR: {
      icon: AlertTriangle,
      label: 'Error',
      color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      badgeColor: 'bg-red-600 dark:bg-red-700',
    },
    PROCESSING: {
      icon: Clock,
      label: 'Procesando',
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      badgeColor: 'bg-yellow-600 dark:bg-yellow-700',
    },
  };

  const config = statusConfig[data.status] || statusConfig.PROCESSING;
  const Icon = config.icon;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!onDownloadPDF) return;
    setIsDownloading(true);
    try {
      await onDownloadPDF();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadXML = async () => {
    if (!onDownloadXML) return;
    setIsDownloading(true);
    try {
      await onDownloadXML();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!onRefreshStatus) return;
    setIsRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Alert className={config.color}>
        <Icon className="h-5 w-5" />
        <AlertTitle className="text-lg font-semibold">
          Factura {config.label}
        </AlertTitle>
        <AlertDescription className="mt-2">
          {data.hkaResponseMessage || `Estado: ${config.label}`}
        </AlertDescription>
      </Alert>

      {/* Error Details */}
      {isError && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Detalles del Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.hkaResponseCode && (
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Código de Error
                </p>
                <p className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
                  {data.hkaResponseCode}
                </p>
              </div>
            )}
            {data.hkaResponseMessage && (
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Mensaje
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {data.hkaResponseMessage}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success Content */}
      {isSuccess && (
        <>
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CUFE */}
            {data.cufe && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    CUFE (Código Único de Factura Electrónica)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <code className="text-xs break-all font-mono text-gray-600 dark:text-gray-300">
                      {data.cufe}
                    </code>
                  </div>
                  <button
                    onClick={() => handleCopy(data.cufe!, 'cufe')}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedField === 'cufe' ? 'Copiado!' : 'Copiar CUFE'}
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Protocolo de Autorización */}
            {data.protocoloAutorizacion && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Protocolo de Autorización
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <code className="text-xs break-all font-mono text-gray-600 dark:text-gray-300">
                      {data.protocoloAutorizacion}
                    </code>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(data.protocoloAutorizacion!, 'protocol')
                    }
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedField === 'protocol' ? 'Copiado!' : 'Copiar Protocolo'}
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Número de Documento Fiscal */}
            {data.numeroDocumentoFiscal && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Número de Documento Fiscal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {data.numeroDocumentoFiscal}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fecha de Certificación */}
            {data.hkaProtocolDate && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    Fecha de Certificación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {formatPanamaDateReadable(
                      new Date(data.hkaProtocolDate),
                      false
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* QR Code */}
          {(data.qrCode || data.qrUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Código QR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="p-6 bg-white border border-gray-200 dark:border-gray-700 rounded-lg">
                    {data.qrCode ? (
                      <img
                        src={`data:image/png;base64,${data.qrCode}`}
                        alt="QR Factura"
                        className="w-48 h-48 object-contain"
                      />
                    ) : data.qrUrl ? (
                      <QRCodeSVG value={data.qrUrl} size={192} />
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                    Escanea este código QR para verificar la factura en DGI
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Downloads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Descargar Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {onDownloadPDF && (
                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {isDownloading ? 'Descargando PDF...' : 'Descargar PDF Oficial'}
                </button>
              )}
              {onDownloadXML && (
                <button
                  onClick={handleDownloadXML}
                  disabled={isDownloading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {isDownloading
                    ? 'Descargando XML...'
                    : 'Descargar XML Firmado'}
                </button>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50">
            <CardHeader>
              <CardTitle className="text-sm">Próximos Pasos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
              <p>✓ Tu factura ha sido autorizada exitosamente por HKA</p>
              <p>✓ Puedes descargar el PDF y XML para tus registros</p>
              <p>✓ Comparte el PDF con tu cliente o envía por email</p>
              <p>
                ✓ El código QR permite que el cliente verifique la factura en
                DGI
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Processing State */}
      {isProcessing && (
        <Card className="border-yellow-200 dark:border-yellow-900/50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
              </div>
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  Procesando Factura
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Tu factura está siendo procesada por HKA. Esto puede tomar
                  algunos segundos.
                </p>
              </div>
              {onRefreshStatus && (
                <button
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  className="ml-auto px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="inline h-4 w-4 mr-1 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="inline h-4 w-4 mr-1" />
                      Verificar
                    </>
                  )}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
