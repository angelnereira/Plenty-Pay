"use client"

import { useState, useEffect } from "react"
import { Download, FileText, Copy, ExternalLink, QrCode as QrCodeIcon, Eye } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { formatPanamaDateReadable } from "@/lib/utils/date-timezone"

interface InvoiceSuccessResponseProps {
  data: {
    invoiceId: string
    cufe?: string
    cafe?: string
    numeroDocumentoFiscal?: string
    qrUrl?: string
    qrCode?: string // QR en Base64
    protocoloAutorizacion?: string
    fechaRecepcionDGI?: string | null
  }
}

export function InvoiceSuccessResponse({ data }: InvoiceSuccessResponseProps) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  const copiarCUFE = () => {
    if (!data.cufe) return

    navigator.clipboard.writeText(data.cufe)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const descargarPDF = async () => {
    try {
      setDownloading(true)

      const response = await fetch(`/api/invoices/${data.invoiceId}/pdf`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error al obtener PDF' }))
        throw new Error(error.error || 'Error al descargar PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${data.numeroDocumentoFiscal || data.invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error al descargar PDF:', error)
      alert('Error al descargar el PDF. Por favor, inténtalo de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  const descargarXML = async () => {
    try {
      setDownloading(true)

      const response = await fetch(`/api/invoices/${data.invoiceId}/xml`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error al obtener XML' }))
        throw new Error(error.error || 'Error al descargar XML')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${data.numeroDocumentoFiscal || data.invoiceId}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error al descargar XML:', error)
      alert('Error al descargar el XML. Por favor, inténtalo de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  const abrirQR = () => {
    if (data.qrUrl) {
      window.open(data.qrUrl, '_blank')
    }
  }

  const verPdfPreview = async () => {
    try {
      const response = await fetch(`/api/invoices/${data.invoiceId}/pdf`)
      if (!response.ok) {
        throw new Error('Error al obtener PDF')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setPdfPreviewUrl(url)
      setShowPdfPreview(true)
    } catch (error) {
      console.error('Error al cargar PDF:', error)
      alert('Error al cargar el PDF. Por favor, inténtalo de nuevo.')
    }
  }

  const cerrarPdfPreview = () => {
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
    setShowPdfPreview(false)
  }

  // URL de consulta DGI (según ambiente)
  const consultaUrl = data.qrUrl || 'https://fe.dgi.mef.gob.pa'

  // Debug: Log para verificar datos recibidos (SIEMPRE en desarrollo, también en producción si hay problemas)
  useEffect(() => {
    console.group('🔍 [InvoiceSuccessResponse] Componente renderizado');
    console.log('📦 Props Data:', {
      invoiceId: data.invoiceId,
      hasCufe: !!data.cufe,
      hasCafe: !!data.cafe,
      hasQrCode: !!data.qrCode,
      hasQrUrl: !!data.qrUrl,
      numeroDocumentoFiscal: data.numeroDocumentoFiscal,
      hasProtocol: !!data.protocoloAutorizacion,
      hasFecha: !!data.fechaRecepcionDGI,
      consultaUrl,
    });
    console.log('✅ Componente se está renderizando correctamente');
    console.groupEnd();
  }, [data.invoiceId, data.cufe, data.cafe, data.qrCode, data.qrUrl, consultaUrl]);

  // Validación: Si no hay invoiceId, no renderizar
  if (!data.invoiceId) {
    console.warn('⚠️ [InvoiceSuccessResponse] Falta invoiceId - No renderizando', data);
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200 font-bold">
          Error: Falta invoiceId en los datos
        </p>
        <pre className="text-xs mt-2 text-red-700 dark:text-red-300 font-mono overflow-auto scrollbar-hide">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  // Mostrar componente incluso sin CUFE/CAFE, pero con mensaje informativo
  const hasMinimumData = data.cufe || data.cafe

  return (
    <>
      {/* Modal de vista previa PDF */}
      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={cerrarPdfPreview}>
          <div className="relative w-full max-w-4xl h-full max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Vista Previa - Factura Certificada
              </h3>
              <button
                onClick={cerrarPdfPreview}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(90vh-4rem)] overflow-auto scrollbar-hide">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Vista previa de factura"
              />
            </div>
          </div>
        </div>
      )}

      {/* Contenedor principal */}
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Mensaje si faltan datos críticos */}
        {!hasMinimumData && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Nota:</strong> Esta factura está certificada pero aún no se han recibido todos los datos de respuesta de HKA.
              Los datos se completarán automáticamente cuando estén disponibles.
            </p>
          </div>
        )}

        {/* Documento tipo CAFE - Similar al documento físico de la DGI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-300 dark:border-gray-600 p-8 space-y-6">
          {/* Header tipo documento oficial */}
          <div className="text-center border-b-2 border-gray-300 dark:border-gray-600 pb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              CAFE de emisión previa, transmisión para la DIRECCIÓN GENERAL DE INGRESOS
            </h1>
            {data.fechaRecepcionDGI && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Válido hasta {formatPanamaDateReadable(data.fechaRecepcionDGI, true)}
              </p>
            )}
          </div>

          {/* Información de consulta */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Consulte en:
            </p>
            <div className="flex items-center gap-2">
              <a
                href={consultaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all font-mono text-sm"
              >
                {consultaUrl}
              </a>
              <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            </div>

            {/* CUFE */}
            {data.cufe ? (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                  Usando el CUFE:
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md font-mono text-xs break-all text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    {data.cufe}
                  </div>
                  <button
                    onClick={copiarCUFE}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors flex-shrink-0"
                    title="Copiar CUFE"
                  >
                    <Copy className={`h-4 w-4 ${copied ? 'text-green-600' : ''}`} />
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ CUFE copiado al portapapeles</p>
                )}
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                  O escaneando el código QR
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 italic">
                CUFE pendiente de asignación por HKA...
              </p>
            )}
          </div>

          {/* QR Code - Visual prominente */}
          <div className="flex justify-center py-6">
            {data.qrCode ? (
              // Si tenemos QR en Base64, mostrarlo directamente
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                <img
                  src={`data:image/png;base64,${data.qrCode}`}
                  alt="Código QR para consulta DGI"
                  className="w-64 h-64"
                />
              </div>
            ) : data.qrUrl ? (
              // Si tenemos URL, generar QR desde la URL
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                <QRCodeSVG
                  value={data.qrUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  className="w-64 h-64"
                />
              </div>
            ) : data.cufe ? (
              // Si tenemos CUFE, generar QR desde la URL de consulta con CUFE
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                <QRCodeSVG
                  value={`${consultaUrl}?cufe=${data.cufe}`}
                  size={256}
                  level="H"
                  includeMargin={true}
                  className="w-64 h-64"
                />
              </div>
            ) : null}
          </div>

          {/* Información de validación (footer) */}
          <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4 text-xs text-gray-600 dark:text-gray-400 text-center">
            <p>
              Documento validado por The Factory HKA, Proveedor Autorizado Calificado
            </p>
            {data.protocoloAutorizacion && (
              <p className="mt-1">
                Protocolo de Autorización: <span className="font-mono">{data.protocoloAutorizacion}</span>
              </p>
            )}
          </div>
        </div>

        {/* Panel de acciones */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Acciones Disponibles
          </h3>

          {/* CAFE destacado */}
          {data.cafe && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                CAFE (Código de Autorización FE)
              </p>
              <p className="text-lg font-bold font-mono text-blue-800 dark:text-blue-300 break-all">
                {data.cafe}
              </p>
            </div>
          )}

          {/* Número de documento fiscal */}
          {data.numeroDocumentoFiscal && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Número de Documento Fiscal
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.numeroDocumentoFiscal}
              </p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={verPdfPreview}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="h-5 w-5" />
              <span>Ver Factura</span>
            </button>

            <button
              onClick={descargarPDF}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5" />
              <span>Descargar PDF</span>
            </button>

            <button
              onClick={descargarXML}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-5 w-5" />
              <span>Descargar XML</span>
            </button>
          </div>

          {/* Botón para consultar en DGI */}
          {data.qrUrl && (
            <button
              onClick={abrirQR}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
            >
              <QrCodeIcon className="h-5 w-5" />
              <span>Consultar en Portal DGI</span>
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nota informativa */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Nota:</strong> Este documento es el CAFE (Código de Autorización de Factura Electrónica)
            emitido por la Dirección General de Ingresos (DGI) de Panamá. El código QR y el CUFE permiten
            verificar la autenticidad de esta factura en el portal oficial de la DGI.
          </p>
        </div>
      </div>
    </>
  )
}
