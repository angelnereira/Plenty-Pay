'use client';

import { useState } from 'react';
import { Button } from '@shared/ui/button';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Download,
    FileText,
    Mail,
    ExternalLink,
    Copy,
    Check,
    Calendar,
    Loader2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@shared/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { CafePrintButton } from '@/features/cafe/ui/cafe-print-button';
import type { InvoiceForCAFE } from '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper';

interface InvoiceDetailViewProps {
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
        issueDate: Date;
        createdAt: Date;
        emittedAt?: Date;
        receiverName: string;
        receiverRuc?: string;
        receiverDv?: string;
        receiverEmail?: string;
        receiverType?: string;
        fechaLimitePosterior?: Date | null;
        // Issuer snapshot — needed for CAFE ESC/POS
        issuerName?: string;
        issuerRuc?: string;
        issuerDv?: string;
        issuerAddress?: string;
        issuerPhone?: string;
        // Document metadata
        documentType?: string;
        numeroDocumentoFiscal?: string;
        codigoSucursal?: string;
        puntoFacturacion?: string;
        cufeLocal?: string;
        // Payment
        discount?: number;
        paymentMethod?: string;
        // HKA authorisation
        hkaProtocol?: string | null;
        hkaProtocolDate?: Date | null;
        items: Array<{
            id: string;
            description: string;
            quantity: number;
            unitPrice: number;
            total: number;
            taxAmount: number;
            unit?: string | null;
        }>;
    };
}

/** Deriva el badge de tipo de emisión a partir del tipo de receptor */
function getEmissionTypeBadge(receiverType?: string): { label: string; className: string } | null {
    switch (receiverType) {
        case 'CONTRIBUTOR':
        case 'GOVERNMENT':
            return {
                label: 'B2B · Auth. Previa',
                className: 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600',
            };
        case 'FINAL_CONSUMER':
            return {
                label: 'Mostrador · Auth. Posterior',
                className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
            };
        case 'FOREIGN':
            return {
                label: 'Exportación · Auth. Previa',
                className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700',
            };
        default:
            return null;
    }
}

// Componente para botones de acción
function ActionButton({
    icon,
    label,
    onClick,
    loading = false,
    variant = 'default'
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    loading?: boolean;
    variant?: 'default' | 'success' | 'danger';
}) {
    const variantClasses = {
        default: 'text-blue-500 group-hover:text-blue-400',
        success: 'text-emerald-500 group-hover:text-emerald-400',
        danger: 'text-red-500 group-hover:text-red-400'
    };

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 active:scale-95 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
            <div className={`transition-colors ${variantClasses[variant]}`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">{label}</span>
        </button>
    );
}

export function InvoiceDetailView({ invoice }: InvoiceDetailViewProps) {
    const [copiedCufe, setCopiedCufe] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingXml, setIsDownloadingXml] = useState(false);
    // Remove individual states for QR expand if we show it differently
    const { toast } = useToast();

    const qrUrl = invoice.qrCode || invoice.qrUrl;
    const isCertified = ['EMITTED', 'CERTIFIED', 'APPROVED'].includes(invoice.status);

    const cafeInvoice: InvoiceForCAFE = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        documentType: invoice.documentType,
        issueDate: invoice.issueDate,
        currency: invoice.currency,
        issuerName: invoice.issuerName,
        issuerRuc: invoice.issuerRuc,
        issuerDv: invoice.issuerDv,
        issuerAddress: invoice.issuerAddress,
        issuerPhone: invoice.issuerPhone,
        receiverName: invoice.receiverName,
        receiverRuc: invoice.receiverRuc,
        receiverDv: invoice.receiverDv,
        subtotal: invoice.subtotal,
        itbms: invoice.itbms,
        discount: invoice.discount,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod,
        qrUrl: invoice.qrUrl ?? invoice.qrCode,
        cufeLocal: invoice.cufeLocal,
        cufe: invoice.cufe,
        codigoSucursal: invoice.codigoSucursal,
        puntoFacturacion: invoice.puntoFacturacion,
        numeroDocumentoFiscal: invoice.numeroDocumentoFiscal,
        hkaProtocol: invoice.hkaProtocol,
        hkaProtocolDate: invoice.hkaProtocolDate,
        fechaLimitePosterior: invoice.fechaLimitePosterior,
        items: invoice.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            taxAmount: item.taxAmount,
            unit: item.unit,
        })),
    };

    // Obtener iniciales del cliente
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'CERTIFIED':
            case 'EMITTED':
            case 'APPROVED':
                return {
                    icon: <CheckCircle className="w-4 h-4" />,
                    text: 'Emitida Exitosamente',
                    bgClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                };
            case 'ERROR':
            case 'REJECTED':
                return {
                    icon: <XCircle className="w-4 h-4" />,
                    text: 'Error en Emisión',
                    bgClass: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                };
            case 'PROCESSING':
                return {
                    icon: <Loader2 className="w-4 h-4 animate-spin" />,
                    text: 'Procesando',
                    bgClass: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                };
            case 'QUEUED':
                return {
                    icon: <Clock className="w-4 h-4" />,
                    text: 'En Cola',
                    bgClass: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                };
            case 'CANCELLED':
                return {
                    icon: <XCircle className="w-4 h-4" />,
                    text: 'Cancelada',
                    bgClass: 'bg-gray-500/10 border-gray-500/20 text-gray-600 dark:text-gray-400'
                };
            default:
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    text: 'Borrador',
                    bgClass: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400'
                };
        }
    };

    const handleCopyCufe = async () => {
        if (!invoice.cufe) return;
        try {
            await navigator.clipboard.writeText(invoice.cufe);
            setCopiedCufe(true);
            toast({ title: 'CUFE copiado', description: 'El CUFE se ha copiado al portapapeles.' });
            setTimeout(() => setCopiedCufe(false), 2000);
        } catch {
            toast({ title: 'Error', description: 'No se pudo copiar el CUFE', variant: 'destructive' });
        }
    };

    const handleDownloadPdf = async () => {
        setIsDownloadingPdf(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/pdf/download`);
            if (!response.ok) throw new Error('Error al descargar PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.folio || invoice.invoiceNumber || invoice.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'PDF descargado', description: 'El PDF se ha descargado correctamente.' });
        } catch {
            toast({ title: 'Error', description: 'No se pudo descargar el PDF', variant: 'destructive' });
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleDownloadXml = async () => {
        setIsDownloadingXml(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/xml/download`);
            if (!response.ok) throw new Error('Error al descargar XML');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${invoice.folio || invoice.invoiceNumber || invoice.id}.xml`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({ title: 'XML descargado', description: 'El XML se ha descargado correctamente.' });
        } catch {
            toast({ title: 'Error', description: 'No se pudo descargar el XML', variant: 'destructive' });
        } finally {
            setIsDownloadingXml(false);
        }
    };

    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const handleSendEmail = async () => {
        if (!invoice.receiverEmail) {
            toast({
                title: 'Sin correo',
                description: 'Esta factura no tiene correo electrónico del cliente.',
                variant: 'destructive'
            });
            return;
        }

        setIsSendingEmail(true);
        try {
            const { sendInvoiceEmailAction } = await import('@/app/actions/invoice/send-email.action');
            const result = await sendInvoiceEmailAction({
                invoiceId: invoice.id,
                email: invoice.receiverEmail
            });

            if (result.success) {
                toast({
                    title: 'Correo enviado',
                    description: result.message || `Factura enviada a ${invoice.receiverEmail}`
                });
            } else {
                toast({
                    title: 'Error al enviar',
                    description: result.error || 'No se pudo enviar el correo',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Error al enviar el correo. Intente nuevamente.',
                variant: 'destructive'
            });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleVerifyDgi = () => {
        if (qrUrl) {
            window.open(qrUrl, '_blank');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const statusConfig = getStatusConfig(invoice.status);

    return (
        <div className="space-y-6 pb-20">
            {/* --- 1. HEADER HERO --- */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-1">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-600">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Factura {invoice.folio || invoice.invoiceNumber || `#${invoice.id.substring(0, 8)}`}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgClass}`}>
                                {statusConfig.icon}
                                {statusConfig.text}
                            </div>
                            {(() => {
                                const badge = getEmissionTypeBadge(invoice.receiverType);
                                return badge ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                ) : null;
                            })()}
                            <span>•</span>
                            <span className="capitalize">
                                {format(new Date(invoice.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                            </span>
                        </div>
                    </div>
                </div>

                {isCertified && (
                    <div className="flex items-center gap-2">
                        <ActionButton
                            icon={<Download className="w-4 h-4" />}
                            label="PDF"
                            onClick={handleDownloadPdf}
                            loading={isDownloadingPdf}
                        />
                        <ActionButton
                            icon={<Mail className="w-4 h-4" />}
                            label="Email"
                            onClick={handleSendEmail}
                            loading={isSendingEmail}
                        />
                        <CafePrintButton invoice={cafeInvoice} />
                    </div>
                )}
            </div>

            {/* --- 2. DETAILS CARD --- */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">

                {/* Client & Info Grid */}
                <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800">
                    <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{invoice.receiverName}</p>
                        {invoice.receiverRuc && (
                            <p className="text-sm text-gray-600 dark:text-slate-400 font-mono">
                                RUC: {invoice.receiverRuc}{invoice.receiverDv && `-${invoice.receiverDv}`}
                            </p>
                        )}
                        {invoice.receiverEmail && (
                            <p className="text-sm text-blue-500 hover:underline cursor-pointer">{invoice.receiverEmail}</p>
                        )}
                    </div>
                    <div className="space-y-1 md:text-right">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalles</h3>
                        {isCertified && invoice.invoiceNumber && (
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                                <span className="text-gray-400 mr-2">N° Fiscal:</span>
                                <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
                            </p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                            <span className="text-gray-400 mr-2">Emisión:</span>
                            {format(new Date(invoice.issueDate), "dd/MM/yyyy", { locale: es })}
                        </p>
                        {invoice.emittedAt && (
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                                <span className="text-gray-400 mr-2">Hora:</span>
                                {format(new Date(invoice.emittedAt), "hh:mm a", { locale: es })}
                            </p>
                        )}
                    </div>
                </div>

                {/* Alerta fecha límite autorización posterior (B2C/Mostrador) */}
                {invoice.fechaLimitePosterior && (() => {
                    const limite = new Date(invoice.fechaLimitePosterior!);
                    const now = new Date();
                    const expired = limite <= now;
                    const horasRestantes = (limite.getTime() - now.getTime()) / 1000 / 3600;
                    const urgent = !expired && horasRestantes < 8;
                    return (
                        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                            expired
                                ? 'bg-red-100 dark:bg-red-950/40 border-red-400 text-red-900 dark:text-red-200'
                                : urgent
                                ? 'bg-orange-100 dark:bg-orange-950/30 border-orange-400 text-orange-900 dark:text-orange-200 animate-pulse'
                                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-800 dark:text-amber-300'
                        }`} role="alert">
                            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold leading-tight">
                                    {expired ? 'PLAZO DE AUTORIZACIÓN VENCIDO' : 'Pendiente de autorización DGI'}
                                </p>
                                <p className="mt-0.5 text-xs opacity-80">
                                    {expired
                                        ? `Plazo vencido el ${format(limite, "dd/MM/yyyy HH:mm", { locale: es })}. Contacte a soporte.`
                                        : `Límite: ${format(limite, "dd/MM/yyyy HH:mm", { locale: es })} (${Math.ceil(horasRestantes)}h restantes)`
                                    }
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* Items Table */}
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3 font-medium">Descripción</th>
                                <th className="px-6 py-3 font-medium text-right">Cant.</th>
                                <th className="px-6 py-3 font-medium text-right">Precio</th>
                                <th className="px-6 py-3 font-medium text-right">ITBMS</th>
                                <th className="px-6 py-3 font-medium text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {invoice.items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        {item.description}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-slate-400">
                                        {item.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-slate-400 font-mono">
                                        ${formatCurrency(item.unitPrice)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-slate-400 font-mono text-xs">
                                        ${formatCurrency(item.taxAmount)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white font-mono">
                                        ${formatCurrency(item.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Totals */}
                <div className="flex justify-end p-6 md:p-8 bg-gray-50/30 dark:bg-slate-900/30">
                    <div className="w-full max-w-xs space-y-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-mono">${formatCurrency(invoice.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                            <span>ITBMS (7%)</span>
                            <span className="font-mono">${formatCurrency(invoice.itbms)}</span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                ${formatCurrency(invoice.total)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 3. FISCAL INFO (Footer) --- */}
            {isCertified && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-center gap-6">
                    {/* QR Code */}
                    <div className="bg-white p-2 rounded-lg border border-gray-100 shrink-0 shadow-sm">
                        {qrUrl ? (
                            <QRCodeSVG value={qrUrl} size={100} level="M" />
                        ) : (
                            <div className="w-[100px] h-[100px] bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sin QR</div>
                        )}
                    </div>

                    {/* Fiscal Data */}
                    <div className="flex-1 min-w-0 space-y-4 w-full text-center md:text-left">
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Documento Fiscal Electrónico</h4>
                            <p className="text-sm text-gray-500 dark:text-slate-400">Consulta la validez de este documento escaneando el código QR</p>
                        </div>

                        {/* CUFE Box */}
                        <div className="relative group">
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">CUFE</div>
                            <div
                                onClick={handleCopyCufe}
                                className="font-mono text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-gray-600 dark:text-slate-300 break-all hover:border-violet-400 transition-colors cursor-pointer flex items-center justify-between gap-2"
                            >
                                <span>{invoice.cufe || '---'}</span>
                                {copiedCufe ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400 group-hover:text-violet-500" />}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleVerifyDgi} className="h-8 gap-2 bg-white dark:bg-slate-800 text-xs">
                                <ExternalLink className="w-3 h-3" />
                                Validar en DGI
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
