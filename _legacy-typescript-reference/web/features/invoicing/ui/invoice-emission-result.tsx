'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { Separator } from '@shared/ui/separator';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
    Download,
    FileText,
    Mail,
    Copy,
    Check,
    CheckCircle2,
    XCircle,
    Loader2,
    ExternalLink,
    QrCode,
    Hash,
    Calendar,
    DollarSign,
    User,
    Building2,
    Receipt,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@shared/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface InvoiceEmissionResultProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: {
        id: string;
        folio?: string;
        invoiceNumber?: string;
        cufe?: string;
        cafe?: string;
        qrCode?: string;
        qrUrl?: string;
        status: string;
        total: number;
        subtotal: number;
        itbms: number;
        currency: string;
        receiverName: string;
        receiverEmail?: string;
        receiverRuc?: string;
        emittedAt?: Date;
        createdAt: Date;
        hkaMessage?: string;
        hkaResponseCode?: string;
    };
}

export function InvoiceEmissionResult({ isOpen, onClose, invoice: initialInvoice }: InvoiceEmissionResultProps) {
    const [invoice, setInvoice] = useState(initialInvoice);
    const [copiedCufe, setCopiedCufe] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState(initialInvoice.receiverEmail || '');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const isSuccess = ['EMITTED', 'CERTIFIED', 'APPROVED'].includes(invoice.status);
    const isProcessing = ['PROCESSING', 'QUEUED'].includes(invoice.status);
    const isError = ['ERROR', 'REJECTED'].includes(invoice.status);

    // Polling para actualizar estado si está procesando
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (isOpen && isProcessing) {
            intervalId = setInterval(async () => {
                try {
                    const response = await fetch(`/api/invoices/${invoice.id}/status`);
                    if (response.ok) {
                        const data = await response.json();
                        // Si el estado cambió, actualizar factura
                        if (data.status !== invoice.status) {
                            setInvoice(prev => ({ ...prev, ...data }));

                            // Si terminó, refrescar la página de fondo
                            if (!['PROCESSING', 'QUEUED'].includes(data.status)) {
                                router.refresh();
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error polling invoice status:', error);
                }
            }, 3000); // Consultar cada 3 segundos
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isOpen, isProcessing, invoice.id, invoice.status, router]);

    // Actualizar estado local si cambia la prop
    useEffect(() => {
        setInvoice(initialInvoice);
    }, [initialInvoice]);

    const handleCopyCufe = async () => {
        if (!invoice.cufe) return;

        try {
            await navigator.clipboard.writeText(invoice.cufe);
            setCopiedCufe(true);
            setTimeout(() => setCopiedCufe(false), 2000);

            toast({
                title: 'CUFE copiado',
                description: 'El código CUFE ha sido copiado al portapapeles.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo copiar el CUFE',
                variant: 'destructive',
            });
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/pdf/download`);

            if (!response.ok) {
                throw new Error('Error al descargar PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.folio || invoice.invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'PDF descargado',
                description: 'El PDF se ha descargado correctamente.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo descargar el PDF',
                variant: 'destructive',
            });
        }
    };

    const handleDownloadXML = async () => {
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/xml/download`);

            if (!response.ok) {
                throw new Error('Error al descargar XML');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.folio || invoice.invoiceNumber}.xml`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: 'XML descargado',
                description: 'El XML se ha descargado correctamente.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo descargar el XML',
                variant: 'destructive',
            });
        }
    };

    const handleSendEmail = async () => {
        if (!emailRecipient) {
            toast({
                title: 'Email requerido',
                description: 'Por favor ingresa un email válido',
                variant: 'destructive',
            });
            return;
        }

        setIsSendingEmail(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailRecipient }),
            });

            if (!response.ok) {
                throw new Error('Error al enviar email');
            }

            toast({
                title: 'Email enviado',
                description: `La factura ha sido enviada a ${emailRecipient}`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo enviar el email',
                variant: 'destructive',
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto scrollbar-hide">
                {/* Header con Icono Grande de Éxito */}
                <div className="text-center pt-6 pb-4">
                    <div className="mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
                        {isSuccess && <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />}
                        {isProcessing && <Loader2 className="h-12 w-12 text-white animate-spin" />}
                        {isError && <XCircle className="h-12 w-12 text-white" />}
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {isSuccess && '¡Factura Emitida Exitosamente!'}
                        {isProcessing && 'Procesando Factura...'}
                        {isError && 'Error al Emitir Factura'}
                    </h2>
                    {isSuccess && (
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            La factura ha sido certificada por la DGI
                        </p>
                    )}
                </div>

                <div className="space-y-6">
                    {/* Estado y Folio - Banner destacado */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 border-2 border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                                    <Receipt className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Estado</p>
                                    <div className="flex items-center gap-2">
                                        {isSuccess && <Badge className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 text-base">Certificada</Badge>}
                                        {isProcessing && <Badge className="bg-blue-600 hover:bg-blue-700 px-4 py-1 text-base">Procesando</Badge>}
                                        {isError && <Badge variant="destructive" className="px-4 py-1 text-base">Error</Badge>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Folio</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{invoice.folio || invoice.invoiceNumber}</p>
                            </div>
                        </div>
                    </div>

                    {/* Mensaje de HKA */}
                    {invoice.hkaMessage && (
                        <div className={`p-4 rounded-xl ${isError ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800'}`}>
                            <p className={`text-sm font-medium ${isError ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                {invoice.hkaMessage}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Información Fiscal */}
                        <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-xl flex items-center gap-2 text-gray-900 dark:text-white pb-2 border-b-2 border-gray-200 dark:border-gray-700">
                                <Hash className="h-6 w-6 text-indigo-600" />
                                Información Fiscal
                            </h3>

                            {/* CUFE */}
                            {invoice.cufe && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">CUFE / UUID</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={invoice.cufe}
                                            readOnly
                                            className="font-mono text-xs bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCopyCufe}
                                            className="min-w-[44px] hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-900/20"
                                        >
                                            {copiedCufe ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    {copiedCufe && (
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ CUFE copiado al portapapeles</p>
                                    )}
                                </div>
                            )}

                            {/* CAFE */}
                            {invoice.cafe && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">CAFE</Label>
                                    <Input
                                        value={invoice.cafe}
                                        readOnly
                                        className="font-mono text-xs bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                                    />
                                </div>
                            )}

                            {/* QR Code */}
                            {(invoice.qrCode || invoice.qrUrl || invoice.cufe) && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <QrCode className="h-4 w-4" />
                                        Código QR
                                    </Label>
                                    <div className="flex justify-center p-6 bg-white dark:bg-gray-900 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                                        {invoice.qrCode ? (
                                            <img
                                                src={`data:image/png;base64,${invoice.qrCode}`}
                                                alt="QR Code"
                                                className="w-48 h-48"
                                            />
                                        ) : invoice.qrUrl ? (
                                            <QRCodeSVG value={invoice.qrUrl} size={192} level="H" />
                                        ) : (
                                            <QRCodeSVG value={invoice.cufe || ''} size={192} level="H" />
                                        )}
                                    </div>
                                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                        Escanea para verificar la autenticidad
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Detalles de la Factura */}
                        <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-xl flex items-center gap-2 text-gray-900 dark:text-white pb-2 border-b-2 border-gray-200 dark:border-gray-700">
                                <FileText className="h-6 w-6 text-indigo-600" />
                                Detalles de la Factura
                            </h3>

                            <div className="space-y-4">
                                {/* Cliente */}
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Building2 className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Cliente</span>
                                    </div>
                                    <p className="font-bold text-lg text-gray-900 dark:text-white">{invoice.receiverName}</p>
                                    {invoice.receiverRuc && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1">
                                            RUC: {invoice.receiverRuc}
                                        </p>
                                    )}
                                    {invoice.receiverEmail && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {invoice.receiverEmail}
                                        </p>
                                    )}
                                </div>

                                <Separator />

                                {/* Montos */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-base">
                                        <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                                        <span className="font-semibold">${invoice.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-base">
                                        <span className="text-gray-600 dark:text-gray-400">ITBMS (Impuesto):</span>
                                        <span className="font-semibold">${invoice.itbms.toFixed(2)}</span>
                                    </div>
                                    
                                    <Separator className="my-3" />
                                    
                                    {/* Total destacado */}
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold text-gray-900 dark:text-white">Monto Total:</span>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                                    ${invoice.total.toFixed(2)}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                    {invoice.currency || 'PAB'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Fecha */}
                                <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-500" />
                                        <span className="text-gray-600 dark:text-gray-400 font-medium">Fecha de emisión:</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {format(invoice.emittedAt || invoice.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección de Acciones Post-Emisión */}
                    {isSuccess && (
                        <>
                            <Separator className="my-6" />

                            {/* Descargar Documentos */}
                            <div className="space-y-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                    <Download className="h-5 w-5 text-indigo-600" />
                                    Opciones de Descarga
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Descarga los documentos fiscales oficiales de tu factura
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Button
                                        onClick={handleDownloadPDF}
                                        className="gap-2 h-auto py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all"
                                        size="lg"
                                    >
                                        <Download className="h-5 w-5" />
                                        <div className="text-left">
                                            <div className="font-bold">Descargar PDF</div>
                                            <div className="text-xs opacity-90">Documento imprimible</div>
                                        </div>
                                    </Button>
                                    <Button
                                        onClick={handleDownloadXML}
                                        className="gap-2 h-auto py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg hover:shadow-xl transition-all"
                                        size="lg"
                                    >
                                        <FileText className="h-5 w-5" />
                                        <div className="text-left">
                                            <div className="font-bold">Descargar XML</div>
                                            <div className="text-xs opacity-90">Formato fiscal digital</div>
                                        </div>
                                    </Button>
                                </div>
                            </div>

                            {/* Enviar por Email */}
                            <div className="space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                    <Mail className="h-5 w-5 text-blue-600" />
                                    Enviar por Email
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Envía la factura (PDF y XML) directamente al correo del cliente
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <Input
                                            type="email"
                                            placeholder="correo@ejemplo.com"
                                            value={emailRecipient}
                                            onChange={(e) => setEmailRecipient(e.target.value)}
                                            className="h-12 text-base border-2"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSendEmail}
                                        disabled={isSendingEmail || !emailRecipient}
                                        className="gap-2 h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                                        size="lg"
                                    >
                                        {isSendingEmail ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span>Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="h-5 w-5" />
                                                <span>Enviar Factura</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Botones de Acción Final */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-gray-200 dark:border-gray-700 mt-6">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 h-12 text-base font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                            size="lg"
                        >
                            <span className="sm:hidden">Cerrar</span>
                            <span className="hidden sm:inline">✕ Cerrar</span>
                        </Button>
                        {isSuccess && (
                            <Button
                                onClick={() => window.location.href = `/dashboard/facturas/${invoice.id}`}
                                className="flex-1 h-12 gap-2 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                                size="lg"
                            >
                                <ExternalLink className="h-5 w-5" />
                                Ver Detalles Completos
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
