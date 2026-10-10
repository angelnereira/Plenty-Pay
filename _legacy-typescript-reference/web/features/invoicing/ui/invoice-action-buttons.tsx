import { Download, Eye, FileText, Copy, Check, Trash2, Ban, RefreshCw, Loader2, RotateCw, Printer, MoreHorizontal } from 'lucide-react';
import { InvoiceReviewModal } from '@/features/invoicing/ui/invoice-review-modal';
// loadDraft imported dynamically to avoid server leakage
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import { refreshInvoiceStatus } from '@/app/actions/invoice/refresh-invoice-status.action';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@shared/ui/alert-dialog';
import { Label } from '@shared/ui/label';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@shared/ui/dropdown-menu';
import Link from 'next/link';
export interface InvoiceActionButtonsProps {
    invoice: any;
    showView?: boolean;
    showDownloadPDF?: boolean;
    showDownloadXML?: boolean;
    showCancel?: boolean;
    showDelete?: boolean;
    showVoid?: boolean;
    showCopyCUFE?: boolean;
    showRefresh?: boolean;
    onActionComplete?: () => void;
    onRefresh?: () => void;
}

// ... (previous imports)

export function InvoiceActionButtons({
    invoice,
    showView = true,
    showDownloadPDF = true,
    showDownloadXML = true,
    showCopyCUFE = true,
    showDelete = false,
    showVoid = true,
    showRefresh = true,
    onActionComplete,
}: InvoiceActionButtonsProps) {
    const [copiedCufe, setCopiedCufe] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVoiding, setIsVoiding] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [voidReason, setVoidReason] = useState('');

    // Retry state
    const [retryModalOpen, setRetryModalOpen] = useState(false);
    const [retryData, setRetryData] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const { toast } = useToast();
    const router = useRouter();

    const canDownload = ['CERTIFIED', 'EMITTED', 'APPROVED'].includes(invoice.status);
    const canDelete = true;
    const canRefresh = ['PROCESSING', 'QUEUED', 'PENDING'].includes(invoice.status);
    const canRetry = ['ERROR', 'REJECTED'].includes(invoice.status);
    const isCertified = ['CERTIFIED', 'EMITTED', 'APPROVED'].includes(invoice.status);

    // Reintento con edición: abre modal para revisar/editar antes de reintentar
    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            const { loadInvoiceForRetry } = await import('@/app/actions/invoice/draft.action');
            const res = await loadInvoiceForRetry(invoice.id);
            if (res.success && res.data) {
                // Preservar invoiceId para modo reintento (no crear nuevo)
                setRetryData({
                    ...res.data.data,
                    invoiceId: invoice.id,
                    isRetry: true,
                    previousStatus: res.data.status,
                    attempts: res.data.hkaAttempts,
                });
                setRetryModalOpen(true);
            } else {
                toast({
                    title: 'Error',
                    description: res.error || 'No se pudieron cargar los datos para reintentar la factura.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Ocurrió un error al cargar la factura.',
                variant: 'destructive',
            });
        } finally {
            setIsRetrying(false);
        }
    };

    // Reintento directo: re-emite inmediatamente sin abrir modal
    const handleDirectRetry = async () => {
        setIsRetrying(true);
        try {
            const { directRetryInvoice } = await import('@/app/actions/invoice/retry-invoice.action');
            const res = await directRetryInvoice(invoice.id);
            if (res.success) {
                toast({
                    title: '✅ Reintento exitoso',
                    description: 'La factura ha sido emitida correctamente.',
                });
                router.refresh();
                onActionComplete?.();
            } else {
                toast({
                    title: 'Error en reintento',
                    description: res.error || 'No se pudo emitir la factura.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Ocurrió un error al reintentar la factura.',
                variant: 'destructive',
            });
        } finally {
            setIsRetrying(false);
        }
    };

    // ... (existing handlers: handleRefresh, handleDownloadPDF, etc.)
    // (copy existing handlers here... for brevity in this replacement block, assuming replace_file_content replaces the whole file if ranges match or uses chunk replacement)
    // Wait, since I'm using replace_file_content with range, let's target specific insertion points or replacement of the component function body.
    // Given the complexity, replacing the whole file content might be safer if I had full content, but I'll use chunks via multi_replace if I could.
    // But here I must use replace_file_content.
    // I shall inject the state, the handler, the button condition, and the modal at the end.

    // Changing strategy: Since I cannot verify 'chunk' logic easily without seeing failures, I will replace the imports and then insert the logic inside the function.
    // Actually, I can replace the whole file content since I have it from view_file step 379.
    // I will act as if I am rewriting the file with the additions.

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await refreshInvoiceStatus(invoice.id);
            if (res.success) {
                toast({ title: 'Estado actualizado' });
                router.refresh();
                onActionComplete?.();
            } else {
                toast({ title: 'Sin cambios', description: res.error || 'No hubo cambios en el estado' });
            }
        } catch (e) {
            toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDownloadPDF = async () => {
        // ... (existing code)
        console.log('📥 Descargando PDF para factura:', invoice.id, 'CUFE:', invoice.cufe);
        if (!invoice.cufe) { toast({ title: 'CUFE no disponible', description: 'La factura debe estar certificada para descargar el PDF.', variant: 'destructive' }); return; }
        try {
            const url = `/api/invoices/${invoice.id}/pdf/download`;
            const response = await fetch(url);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Error al descargar PDF');
            }
            const blob = await response.blob();
            if (blob.size === 0) throw new Error('El PDF descargado está vacío');
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = downloadUrl; a.download = `factura-${invoice.folio || invoice.invoiceNumber || invoice.id}.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(downloadUrl); document.body.removeChild(a);
            toast({ title: 'PDF descargado', description: `Factura ${invoice.folio || invoice.invoiceNumber} descargada correctamente.` });
            onActionComplete?.();
        } catch (error) {
            console.error('❌ Error descargando PDF:', error);
            toast({ title: 'Error al descargar PDF', description: error instanceof Error ? error.message : 'No se pudo descargar el PDF', variant: 'destructive' });
        }
    };

    const handlePrintPDF = async () => {
        console.log('🖨️ Imprimiendo PDF para factura:', invoice.id, 'CUFE:', invoice.cufe);
        if (!invoice.cufe) { toast({ title: 'CUFE no disponible', description: 'La factura debe estar certificada para imprimir el PDF.', variant: 'destructive' }); return; }
        try {
            const url = `/api/invoices/${invoice.id}/pdf/download`;
            const response = await fetch(url);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Error al obtener PDF');
            }
            const blob = await response.blob();
            if (blob.size === 0) throw new Error('El PDF descargado está vacío');
            const fileURL = URL.createObjectURL(blob);
            
            // Open print dialog directly
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = fileURL;
            document.body.appendChild(iframe);
            iframe.onload = function() {
                setTimeout(() => {
                    iframe.contentWindow?.print();
                }, 100);
            };
        } catch (error) {
            console.error('❌ Error imprimiendo PDF:', error);
            toast({ title: 'Error al imprimir', description: error instanceof Error ? error.message : 'No se pudo imprimir el PDF', variant: 'destructive' });
        }
    };

    const handleDownloadXML = async () => {
        // ... (existing code, abbreviated for safety)
        console.log('📥 Descargando XML para factura:', invoice.id, 'CUFE:', invoice.cufe);
        if (!invoice.cufe) { toast({ title: 'CUFE no disponible', description: 'La factura debe estar certificada para descargar el XML.', variant: 'destructive' }); return; }
        try {
            const url = `/api/invoices/${invoice.id}/xml/download`;
            const response = await fetch(url);
            if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Error al descargar XML'); }
            const blob = await response.blob();
            if (blob.size === 0) throw new Error('El XML descargado está vacío');
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = downloadUrl; a.download = `factura-${invoice.folio || invoice.invoiceNumber || invoice.id}.xml`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(downloadUrl); document.body.removeChild(a);
            toast({ title: 'XML descargado', description: `XML de factura ${invoice.folio || invoice.invoiceNumber} descargado correctamente.` });
            onActionComplete?.();
        } catch (error) {
            console.error('❌ Error descargando XML:', error);
            toast({ title: 'Error al descargar XML', description: error instanceof Error ? error.message : 'No se pudo descargar el XML', variant: 'destructive' });
        }
    };

    const handleCopyCUFE = async () => {
        if (!invoice.cufe) return;
        try { await navigator.clipboard.writeText(invoice.cufe); setCopiedCufe(true); setTimeout(() => setCopiedCufe(false), 2000); toast({ title: 'CUFE copiado', description: 'El código CUFE ha sido copiado al portapapeles.' }); }
        catch (error) { toast({ title: 'Error', description: 'No se pudo copiar el CUFE', variant: 'destructive' }); }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/delete`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al eliminar factura');
            toast({ title: 'Factura eliminada', description: `La factura ${invoice.folio || invoice.invoiceNumber} ha sido eliminada exitosamente.` });
            setDeleteDialogOpen(false); router.refresh(); onActionComplete?.();
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo eliminar la factura', variant: 'destructive' });
        } finally { setIsDeleting(false); }
    };

    const handleVoid = async () => {
        if (!voidReason.trim()) { toast({ title: 'Motivo requerido', description: 'Por favor ingresa el motivo de la anulación.', variant: 'destructive' }); return; }
        setIsVoiding(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: voidReason }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al anular factura');
            toast({ title: 'Factura anulada', description: `La factura ${invoice.folio || invoice.invoiceNumber} ha sido anulada exitosamente.` });
            setVoidDialogOpen(false); setVoidReason(''); router.refresh(); onActionComplete?.();
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo anular la factura', variant: 'destructive' });
        } finally { setIsVoiding(false); }
    };

    return (
        <>
            <div className="flex items-center gap-2">
                {/* Botón Imprimir (Primario rápido) */}
                {showDownloadPDF && canDownload && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        onClick={handlePrintPDF}
                        title="Imprimir"
                    >
                        <Printer className="h-4 w-4" />
                        <span className="hidden xl:inline">Imprimir</span>
                    </Button>
                )}

                {/* Dropdown Menu para las demás acciones */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            <span className="hidden md:inline">Opciones</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 font-medium text-slate-700 dark:text-slate-300">
                        {showView && (
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/facturas/${invoice.id}`} className="cursor-pointer flex items-center gap-3 p-3">
                                    <Eye className="h-4 w-4 text-slate-500" />
                                    <span>Ver detalles de factura</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                        {showDownloadPDF && canDownload && (
                            <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer flex items-center gap-3 p-3">
                                <Download className="h-4 w-4 text-slate-500" />
                                <span>Descargar PDF</span>
                            </DropdownMenuItem>
                        )}
                        {showDownloadXML && canDownload && (
                            <DropdownMenuItem onClick={handleDownloadXML} className="cursor-pointer flex items-center gap-3 p-3">
                                <FileText className="h-4 w-4 text-slate-500" />
                                <span>Descargar XML</span>
                            </DropdownMenuItem>
                        )}
                        {showCopyCUFE && invoice.cufe && (
                            <DropdownMenuItem onClick={handleCopyCUFE} className="cursor-pointer flex items-center gap-3 p-3">
                                {copiedCufe ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                                <span>Copiar código CUFE</span>
                            </DropdownMenuItem>
                        )}
                        {showRefresh && canRefresh && (
                            <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing} className="cursor-pointer flex items-center gap-3 p-3">
                                <RefreshCw className={`h-4 w-4 text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span>Actualizar estado DGI</span>
                            </DropdownMenuItem>
                        )}
                        {canRetry && (
                            <DropdownMenuItem onClick={handleRetry} disabled={isRetrying} className="cursor-pointer flex items-center gap-3 p-3 text-orange-600">
                                <RotateCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                                <span>Reintentar emisión HKA</span>
                            </DropdownMenuItem>
                        )}
                        {(showVoid || showDelete) && <DropdownMenuSeparator />}
                        {showVoid && canDownload && (
                            <DropdownMenuItem onClick={() => setVoidDialogOpen(true)} className="cursor-pointer flex items-center gap-3 p-3 text-orange-600 focus:text-orange-700">
                                <Ban className="h-4 w-4" />
                                <span>Anular factura</span>
                            </DropdownMenuItem>
                        )}
                        {showDelete && canDelete && (
                            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="cursor-pointer flex items-center gap-3 p-3 text-red-600 focus:text-red-700">
                                <Trash2 className="h-4 w-4" />
                                <span>Eliminar registro local</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Dialogs exist here... */}
            <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Anular factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción anulará la factura ante la DGI/HKA. Esta acción es irreversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="void-reason">Motivo de anulación</Label>
                        <Input
                            id="void-reason"
                            placeholder="Ej: Error en datos del cliente"
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isVoiding}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleVoid}
                            disabled={isVoiding || !voidReason.trim()}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {isVoiding ? 'Anulando...' : 'Anular Factura'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isCertified ? 'Eliminar factura certificada' : 'Eliminar factura'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            {isCertified ? (
                                <>
                                    <p className="font-semibold text-orange-600">
                                        Esta factura fue EMITIDA exitosamente en HKA (código 200).
                                    </p>
                                    <p>
                                        Al eliminarla de la base de datos local, <strong>NO se anula en DGI</strong>.
                                        La factura seguirá siendo válida fiscalmente.
                                    </p>
                                    <p className="text-sm bg-blue-50 p-2 rounded border border-blue-200">
                                        <strong>Puede recuperarla después</strong> usando:
                                        <br />• Consulta por CUFE: <code className="text-xs bg-white px-1">{invoice.cufe?.substring(0, 20)}...</code>
                                        <br />• Descarga de PDF desde HKA
                                        <br />• Descarga de XML desde HKA
                                    </p>
                                </>
                            ) : (
                                <p>
                                    La factura <strong>{invoice.folio || invoice.invoiceNumber}</strong> y todos sus
                                    datos asociados serán eliminados permanentemente de la base de datos local.
                                </p>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Retry Modal */}
            {retryData && (
                <InvoiceReviewModal
                    isOpen={retryModalOpen}
                    onClose={() => {
                        setRetryModalOpen(false);
                        setRetryData(null);
                    }}
                    data={retryData}
                    onSuccess={() => {
                        setRetryModalOpen(false);
                        setRetryData(null);
                        router.refresh();
                        onActionComplete?.();
                    }}
                />
            )}
        </>
    );
}
