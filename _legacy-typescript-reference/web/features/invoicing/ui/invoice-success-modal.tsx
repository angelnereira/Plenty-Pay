import { CheckCircle, Download, FileText, Mail, Plus, X, Loader2, Truck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/hooks/use-toast";
import { sendInvoiceEmailAction } from "@/app/actions/invoice/send-email.action";

interface OfflineInvoiceData {
    items: Array<{ id?: string; name: string; quantity: number; price: number; taxRate?: number }>;
    subtotal: number;
    tax: number;
    total: number;
    discount?: number;
    paymentMethod: string;
    issueDate: Date;
    businessName: string;
    businessRuc: string;
    businessDv: string;
    businessAddress: string;
}

interface Props {
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    cufe: string;
    qrCodeUrl: string;
    pdfBase64?: string; // Optional legacy support
    onClose?: () => void;
    onNewInvoice?: () => void;
    logisticsEnabled?: boolean;
    /** True when the invoice was created offline and lives only in IndexedDB */
    isOffline?: boolean;
    /** Required when isOffline=true — used to generate the PDF client-side */
    offlineData?: OfflineInvoiceData;
    /** Pre-generated blob URL created at sale time using static imports (works offline) */
    offlinePdfBlobUrl?: string;
}

export const InvoiceSuccessModal = ({
    isOpen,
    invoiceId,
    cufe,
    qrCodeUrl,
    invoiceNumber,
    onClose,
    onNewInvoice,
    logisticsEnabled = false,
    isOffline = false,
    offlineData: _offlineData,
    offlinePdfBlobUrl,
}: Props) => {
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [email, setEmail] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const { toast } = useToast();

    if (!isOpen) return null;

    const handleDownloadPdf = async () => {
        // Offline: use the blob URL pre-generated at sale time (static imports, no network).
        // Dynamic imports are NOT used here — they fail with ChunkLoadError when offline.
        if (isOffline) {
            if (offlinePdfBlobUrl) {
                const a = document.createElement('a');
                a.href = offlinePdfBlobUrl;
                a.download = `Comprobante-Offline-${invoiceNumber}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast({ title: 'Comprobante descargado' });
            } else {
                toast({
                    title: 'Comprobante no disponible',
                    description: 'Vuelva a conectarse y reintente, o descargue desde el historial de facturas.',
                    variant: 'destructive',
                });
            }
            return;
        }

        setIsDownloading(true);
        try {
            const url = `/api/invoices/${invoiceId}/pdf/download`;
            const response = await fetch(url);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Error al descargar PDF');
            }

            const blob = await response.blob();
            if (blob.size === 0) throw new Error('El PDF descargado está vacío');

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `Factura-${invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            toast({ title: 'PDF descargado' });
        } catch (error) {
            console.error("Download failed", error);
            toast({
                title: 'Error al descargar PDF',
                description: 'Intente nuevamente.',
                variant: 'destructive'
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!email || !email.includes('@')) {
            toast({ title: "Correo inválido", description: "Ingrese un correo válido.", variant: "destructive" });
            return;
        }

        setIsSendingEmail(true);
        try {
            const result = await sendInvoiceEmailAction({
                invoiceId,
                email
            });

            if (result.success) {
                toast({
                    title: "Correo enviado",
                    description: `Factura enviada a ${email}`
                });
                setEmail(""); // Clear after success
            } else {
                throw new Error(result.error);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "No se pudo enviar.";
            toast({
                title: "Error al enviar correo",
                description: message,
                variant: 'destructive'
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleCreateOrder = async () => {
        setIsCreatingOrder(true);
        try {
            const response = await fetch('/api/logistics/orders/from-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al crear la orden de entrega');
            }

            toast({
                title: "Orden de Entrega creada",
                description: `Se ha generado la orden ${data.code} correctamente.`
            });
            
            // Opcional: Redirigir a la orden de entrega
            // router.push(`/dashboard/logistics/orders/${data.id}`);
        } catch (error: unknown) {
            console.error("Order creation failed", error);
            const message = error instanceof Error ? error.message : 'No se pudo crear la orden de entrega';
            toast({
                title: 'Error',
                description: message,
                variant: 'destructive'
            });
        } finally {
            setIsCreatingOrder(false);
        }
    };

    const handleCopyCufe = () => {
        navigator.clipboard.writeText(cufe);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl text-center border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-hide">

                <div className="flex justify-end absolute top-4 right-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="mx-auto bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4 ring-8 ring-green-50 dark:ring-green-900/10">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">¡Factura Emitida!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Autorización DGI: <span className="font-semibold text-gray-900 dark:text-white">{invoiceNumber}</span>
                </p>

                {/* Zona Fiscal Visual */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 flex gap-4 items-center text-left">
                    <div className="bg-white p-2 rounded-lg shadow-sm shrink-0">
                        <QRCodeSVG value={qrCodeUrl} size={80} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            CUFE
                        </label>
                        <div
                            onClick={handleCopyCufe}
                            className="group relative cursor-pointer font-mono text-[10px] leading-tight text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition-colors break-all"
                        >
                            {cufe}
                            <div className="absolute top-1 right-1 opacity-100 md:opacity-0 group-hover:opacity-100">
                                {copyFeedback ? <CheckCircle size={10} className="text-green-500" /> : <CheckCircle size={10} className="text-gray-300" />}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Botón Descargar PDF */}
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDownloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                        {isDownloading
                            ? 'Generando...'
                            : isOffline
                            ? 'Descargar Comprobante Offline'
                            : 'Descargar PDF Original'}
                    </button>

                    {/* Botón Logística (Modo 1) */}
                    {logisticsEnabled && (
                        <button
                            onClick={handleCreateOrder}
                            disabled={isCreatingOrder}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/20"
                        >
                            {isCreatingOrder ? <Loader2 className="animate-spin" size={20} /> : <Truck size={20} />}
                            {isCreatingOrder ? 'Creando Orden...' : 'Generar Orden de Entrega'}
                        </button>
                    )}

                    {/* Envío por Correo */}
                    <div className="bg-gray-50 dark:bg-gray-800/30 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <Input
                                    placeholder="correo@cliente.com"
                                    className="pl-9 h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleSendEmail}
                                disabled={isSendingEmail || !email}
                                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 rounded-lg font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {isSendingEmail ? <Loader2 className="animate-spin" size={14} /> : 'Enviar'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={onNewInvoice}
                            className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                        >
                            <Plus size={16} /> Nueva Factura
                        </button>
                        <Link href="/dashboard/facturas" className="w-full">
                            <button
                                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                            >
                                <FileText size={16} /> Ver Historial
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

