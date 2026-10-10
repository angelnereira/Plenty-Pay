'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Eye,
    Download,
    FileText,
    Mail,
    XCircle,
    Copy,
    X,
    Loader2,
    CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InvoiceActionsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceId: string;
    folio: string;
    status: string;
    cufe?: string;
    clientEmail?: string;
    /** Optional callback to refresh invoice list after successful operations */
    onSuccess?: () => void;
}

export function InvoiceActionsSheet({
    isOpen,
    onClose,
    invoiceId,
    folio,
    status,
    cufe,
    clientEmail,
    onSuccess,
}: InvoiceActionsSheetProps) {
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState(clientEmail || '');
    const [showEmailInput, setShowEmailInput] = useState(false);

    const isCertified = ['CERTIFIED', 'EMITTED', 'APPROVED'].includes(status);
    const canCancel = isCertified;

    const handleViewDetails = () => {
        router.push(`/dashboard/facturas/${invoiceId}`);
        onClose();
    };

    const handleDownloadPDF = async () => {
        if (!cufe) {
            toast.error('CUFE no disponible para esta factura');
            return;
        }
        setLoadingAction('pdf');
        try {
            const response = await fetch('/api/hka/descargar-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cufe }),
            });

            if (!response.ok) {
                // Try to parse error message
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const error = await response.json();
                    throw new Error(error.error || 'Error al descargar PDF');
                }
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Get blob and download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${folio}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('PDF descargado exitosamente');
            onClose();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Error al descargar PDF');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDownloadXML = async () => {
        if (!cufe) {
            toast.error('CUFE no disponible para esta factura');
            return;
        }
        setLoadingAction('xml');
        try {
            const response = await fetch('/api/hka/descargar-xml', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cufe }),
            });

            if (!response.ok) {
                // Try to parse error message
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const error = await response.json();
                    throw new Error(error.error || 'Error al descargar XML');
                }
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Get blob and download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura-${folio}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('XML descargado exitosamente');
            onClose();
        } catch (error) {
            console.error('Error downloading XML:', error);
            toast.error(error instanceof Error ? error.message : 'Error al descargar XML');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleSendEmail = async () => {
        if (!showEmailInput) {
            setShowEmailInput(true);
            return;
        }

        if (!emailInput || !emailInput.trim()) {
            toast.error('Ingrese un correo electrónico');
            return;
        }

        if (!cufe) {
            toast.error('CUFE no disponible para esta factura');
            return;
        }

        setLoadingAction('email');
        try {
            const response = await fetch('/api/hka/envio-correo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cufe,
                    email: emailInput.trim(),
                    includePDF: true,
                    includeXML: true,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Error al enviar correo');
            }

            toast.success('Factura enviada por correo exitosamente');
            setShowEmailInput(false);
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al enviar correo');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleCopyCUFE = () => {
        if (cufe) {
            navigator.clipboard.writeText(cufe);
            toast.success('CUFE copiado al portapapeles');
        }
        onClose();
    };

    const handleCancel = async () => {
        if (!cufe) {
            toast.error('CUFE no disponible para anular');
            return;
        }

        // Prompt for cancellation reason (API requires 15+ chars)
        const reason = prompt(
            'Ingrese el motivo de anulación (mínimo 15 caracteres):\n\nEjemplo: Error en datos del cliente, factura duplicada, etc.',
            'Anulación solicitada por el emisor'
        );

        if (!reason) {
            return;
        }

        if (reason.trim().length < 15) {
            toast.error('El motivo debe tener al menos 15 caracteres');
            return;
        }

        setLoadingAction('cancel');
        try {
            const response = await fetch('/api/hka/anulacion-documento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cufe,
                    motivo: reason.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Error al anular factura');
            }

            toast.success('Factura anulada exitosamente');
            onClose();
            // Trigger invoice list refresh via React Query
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al anular factura');
        } finally {
            setLoadingAction(null);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 dark:bg-black/60 z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div
                className={cn(
                    'fixed bottom-0 left-0 right-0 z-50',
                    // Light: white | Dark: slate
                    'bg-white dark:bg-slate-900',
                    'border-t border-gray-200 dark:border-slate-800',
                    'rounded-t-2xl',
                    'animate-in slide-in-from-bottom duration-300',
                    'pb-safe shadow-2xl'
                )}
            >
                {/* Handle */}
                <div className="flex justify-center py-3">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-700" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-slate-800">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Acciones de Factura</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-500">Folio: #{folio}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Actions List */}
                <div className="py-2 max-h-[60vh] overflow-y-auto scrollbar-hide">
                    <ActionButton
                        icon={Eye}
                        label="Ver Detalles"
                        description="Ver información completa de la factura"
                        onClick={handleViewDetails}
                    />

                    {isCertified && (
                        <>
                            <ActionButton
                                icon={Download}
                                label="Descargar PDF"
                                description="Obtener el documento en formato PDF"
                                onClick={handleDownloadPDF}
                                isLoading={loadingAction === 'pdf'}
                            />
                            <ActionButton
                                icon={FileText}
                                label="Descargar XML"
                                description="Obtener el documento firmado en XML"
                                onClick={handleDownloadXML}
                                isLoading={loadingAction === 'xml'}
                            />

                            {/* Email Section */}
                            <div className={cn(showEmailInput && 'bg-gray-50 dark:bg-slate-800/50')}>
                                <ActionButton
                                    icon={Mail}
                                    label={showEmailInput ? 'Confirmar Envío' : 'Enviar por Email'}
                                    description={showEmailInput ? 'Presione para enviar' : 'Enviar factura al cliente por correo'}
                                    onClick={handleSendEmail}
                                    isLoading={loadingAction === 'email'}
                                />
                                {showEmailInput && (
                                    <div className="px-4 pb-3">
                                        <input
                                            type="email"
                                            value={emailInput}
                                            onChange={(e) => setEmailInput(e.target.value)}
                                            placeholder="correo@ejemplo.com"
                                            className={cn(
                                                'w-full px-4 py-2.5 rounded-xl text-sm',
                                                'bg-white dark:bg-slate-900',
                                                'border border-gray-300 dark:border-slate-700',
                                                'text-gray-900 dark:text-white',
                                                'placeholder:text-gray-400 dark:placeholder:text-slate-500',
                                                'focus:outline-none focus:ring-2 focus:ring-blue-500'
                                            )}
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setShowEmailInput(false)}
                                            className="text-xs text-gray-500 dark:text-slate-400 mt-2 hover:underline"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {cufe && (
                                <ActionButton
                                    icon={Copy}
                                    label="Copiar CUFE"
                                    description="Copiar código único al portapapeles"
                                    onClick={handleCopyCUFE}
                                />
                            )}
                        </>
                    )}

                    {canCancel && (
                        <ActionButton
                            icon={XCircle}
                            label="Anular Factura"
                            description="Solicitar anulación ante la DGI"
                            onClick={handleCancel}
                            variant="danger"
                            isLoading={loadingAction === 'cancel'}
                        />
                    )}

                    {/* Spacer for bottom nav */}
                    <div className="h-20" />
                </div>
            </div>
        </>
    );
}

interface ActionButtonProps {
    icon: typeof Eye;
    label: string;
    description: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    isLoading?: boolean;
}

function ActionButton({
    icon: Icon,
    label,
    description,
    onClick,
    variant = 'default',
    isLoading = false,
}: ActionButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={cn(
                'w-full flex items-center gap-4 px-4 py-3',
                'transition-colors disabled:opacity-50',
                variant === 'danger'
                    ? 'hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800 active:bg-gray-100 dark:active:bg-slate-700'
            )}
        >
            <div
                className={cn(
                    'p-2 rounded-lg',
                    variant === 'danger'
                        ? 'bg-red-100 dark:bg-red-500/10'
                        : 'bg-blue-50 dark:bg-slate-800'
                )}
            >
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                    <Icon
                        className={cn(
                            'h-5 w-5',
                            variant === 'danger'
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-blue-600 dark:text-slate-300'
                        )}
                    />
                )}
            </div>
            <div className="text-left flex-1">
                <p
                    className={cn(
                        'font-medium',
                        variant === 'danger'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-900 dark:text-white'
                    )}
                >
                    {label}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500">{description}</p>
            </div>
        </button>
    );
}
