'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { ScrollArea } from '@shared/ui/scroll-area';
import {
    Download,
    FileText,
    Copy,
    Check,
    Loader2,
    X,
    Truck,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { downloadInvoicePDF, downloadInvoiceXML } from '@/app/actions/invoice/download-documents.action';
import { SendEmailButton } from './send-email-button';
import { cn } from '@/lib/utils';

interface EmissionResultData {
    cufe: string;
    qr: string;
    fechaRecepcionDGI: string;
    nroProtocoloAutorizacion: string;
    codigo: string;
    mensaje: string;
    numeroDocumentoFiscal?: string;
    invoiceId?: string;
}

interface InvoiceEmissionResultProps {
    isOpen: boolean;
    onClose: () => void;
    data: EmissionResultData | null;
}

/**
 * Modal de Resultado de Emisión de Factura
 * Theme-aware: light mode (white) / dark mode (slate)
 */
export function InvoiceEmissionResult({
    isOpen,
    onClose,
    data,
}: InvoiceEmissionResultProps) {
    const [copiedCUFE, setCopiedCUFE] = useState(false);
    const [downloadingXML, setDownloadingXML] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const { data: session } = useSession();
    const logisticsEnabled = session?.user?.logisticsEnabled ?? false;

    if (!data) return null;

    // Detectar si es un error (cualquier cosa que no sea 200 o 102 con CUFE válido)
    const isError = data.codigo !== '200' && !(data.codigo === '102' && data.cufe);

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedCUFE(true);
            toast.success('CUFE copiado al portapapeles');
            setTimeout(() => setCopiedCUFE(false), 2000);
        } catch {
            toast.error('Error al copiar');
        }
    };

    const handleDownloadXML = async () => {
        if (!data.numeroDocumentoFiscal) {
            if (!data.cufe) {
                toast.error('Identificador de documento no disponible');
                return;
            }
        }

        const docId = data.numeroDocumentoFiscal || data.cufe;

        setDownloadingXML(true);
        try {
            const result = await downloadInvoiceXML(docId);

            if (!result.success || !result.documentoBase64) {
                toast.error(result.error || 'Error al descargar XML');
                return;
            }

            const binary = atob(result.documentoBase64);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }

            const blob = new Blob([array], { type: result.mimeType || 'application/xml' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename || `factura_${docId}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('XML descargado exitosamente');
        } catch (error) {
            console.error('Error downloading XML:', error);
            toast.error('Error al descargar XML');
        } finally {
            setDownloadingXML(false);
        }
    };

    const handleDownloadPDF = async () => {
        const docId = data.numeroDocumentoFiscal || data.cufe;

        if (!docId) {
            toast.error('Identificador de documento no disponible');
            return;
        }

        setDownloadingPDF(true);
        try {
            const result = await downloadInvoicePDF(docId);

            if (!result.success || !result.documentoBase64) {
                toast.error(result.error || 'Error al descargar PDF');
                return;
            }

            const binary = atob(result.documentoBase64);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }

            const blob = new Blob([array], { type: result.mimeType || 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename || `factura_${docId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('PDF descargado exitosamente');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Error al descargar PDF');
        } finally {
            setDownloadingPDF(false);
        }
    };

    const handleCreateOrder = async () => {
        if (!data.invoiceId) {
            toast.error('ID de factura no disponible');
            return;
        }

        setIsCreatingOrder(true);
        try {
            const response = await fetch('/api/logistics/orders/from-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: data.invoiceId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al crear la orden de entrega');
            }

            toast.success(`Orden de Entrega ${result.code} creada correctamente`);
        } catch (error: unknown) {
            console.error("Order creation failed", error);
            const message = error instanceof Error ? error.message : 'No se pudo crear la orden de entrega';
            toast.error(message);
        } finally {
            setIsCreatingOrder(false);
        }
    };

    // Format date for display
    const formattedDate = data.fechaRecepcionDGI
        ? new Date(data.fechaRecepcionDGI).toLocaleString('es-PA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
        : new Date().toLocaleString('es-PA');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className={cn(
                    "max-w-md w-full p-0 border-0 shadow-2xl rounded-2xl overflow-hidden", // rounded-2xl matches manual generator
                    // Light: white bg | Dark: slate bg
                    "bg-white dark:bg-slate-900",
                    "text-gray-900 dark:text-white",
                    "max-h-[85vh] flex flex-col" // Constrain height to viewport
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
                    <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                        {isError ? 'Error en Emisión' : 'Factura Certificada'}
                    </DialogTitle>
                </div>

                {/* Scrollable Content */}
                <ScrollArea className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="flex flex-col items-center pt-6 pb-6 px-6">
                        {isError ? (
                            <>
                                {/* ERROR STATE */}
                                {/* Red Check Circle Animation */}
                                <div className="mb-6 relative">
                                    <div className="h-20 w-20 rounded-full border-2 border-red-500 flex items-center justify-center bg-red-50 dark:bg-red-500/10">
                                        <X className="h-10 w-10 text-red-500" />
                                    </div>
                                    {/* Static animation effect ring */}
                                    <div className="absolute top-0 left-0 h-20 w-20 rounded-full border-2 border-red-500 opacity-20 animate-pulse"></div>
                                </div>

                                <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 max-w-xs">
                                    El documento no pudo ser enviado. Intente nuevamente.
                                </p>

                                {/* Error Details */}
                                <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 p-6 rounded-xl mb-8 flex flex-col items-center w-full">
                                    <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-3">
                                        <X className="h-5 w-5 text-red-500" />
                                    </div>
                                    <h3 className="text-red-600 dark:text-red-400 font-medium text-center mb-1">
                                        Código de Error: {data.codigo}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                                        {data.mensaje || 'Error desconocido del servicio HKA'}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* SUCCESS STATE */}
                                <div className="flex flex-col items-center justify-center mb-6 w-full">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                                        Factura Emitida
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6 max-w-xs">
                                        Autorizado por la DGI correctamente
                                    </p>

                                    {/* QR Code Container - Prominent */}
                                    <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-emerald-100 dark:border-emerald-500/20 inline-flex items-center justify-center">
                                        {data.qr ? (
                                            <div className="relative group">
                                                <QRCodeSVG
                                                    value={data.qr}
                                                    size={180}
                                                    level="M"
                                                    includeMargin
                                                    className="rounded-lg"
                                                />
                                                {/* Overlay hint */}
                                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-48 h-48 bg-gray-50 flex flex-col items-center justify-center text-gray-400 gap-3 rounded-lg border border-dashed border-gray-200">
                                                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center animate-bounce">
                                                    <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="text-xs font-medium">QR no disponible</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider font-medium">Escanear para validar en DGI</span>
                                </div>

                                {/* Details Section */}
                                <div className="w-full space-y-3 mb-6 px-2">
                                    <div className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-slate-800 pb-2">
                                        <span className="text-gray-500 dark:text-slate-400">Protocolo</span>
                                        <span className="font-mono text-gray-700 dark:text-slate-200 text-xs">{data.nroProtocoloAutorizacion || '---'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-slate-800 pb-2">
                                        <span className="text-gray-500 dark:text-slate-400">Fecha</span>
                                        <span className="text-gray-700 dark:text-slate-200 text-xs">{formattedDate}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-sm border-b border-gray-200 dark:border-slate-800 pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 dark:text-slate-400">CUFE</span>
                                            <button
                                                onClick={() => handleCopy(data.cufe)}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
                                                title="Copiar CUFE"
                                            >
                                                {copiedCUFE ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                            </button>
                                        </div>
                                        <span className="font-mono text-gray-700 dark:text-slate-200 text-[10px] break-all leading-tight bg-gray-50 dark:bg-slate-800/50 p-2 rounded">
                                            {data.cufe || '---'}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer with Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
                    {isError ? (
                        <div className="flex flex-col gap-3">
                            <Button
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl text-sm"
                                onClick={onClose}
                            >
                                Reintentar
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-sm"
                                onClick={onClose}
                            >
                                Cerrar
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <Button
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-xl text-sm shadow-lg shadow-violet-500/20"
                                onClick={handleDownloadPDF}
                                disabled={downloadingPDF}
                            >
                                {downloadingPDF ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Imprimir PDF
                            </Button>

                            {/* Botón Logística (Modo 1) */}
                            {logisticsEnabled && data.invoiceId && (
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-500/20"
                                    onClick={handleCreateOrder}
                                    disabled={isCreatingOrder}
                                >
                                    {isCreatingOrder ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Truck className="mr-2 h-4 w-4" />
                                    )}
                                    {isCreatingOrder ? 'Creando Orden...' : 'Generar Orden de Entrega'}
                                </Button>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                {data.invoiceId ? (
                                    <SendEmailButton
                                        invoiceId={data.invoiceId}
                                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 py-2.5 rounded-xl text-sm"
                                        variant="outline"
                                    />
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl text-sm opacity-50"
                                        disabled
                                    >
                                        Enviar Email
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 py-2.5 rounded-xl text-sm"
                                    onClick={handleDownloadXML}
                                    disabled={downloadingXML}
                                >
                                    {downloadingXML ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="mr-2 h-4 w-4" />
                                    )}
                                    XML
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-sm h-8"
                                onClick={onClose}
                            >
                                Cerrar
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
