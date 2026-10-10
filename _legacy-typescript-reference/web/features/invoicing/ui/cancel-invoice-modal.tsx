
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { Textarea } from '@shared/ui/textarea';
import { Label } from '@shared/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { DatosDocumento } from '@/features/hka/model/types/types';

// Alias for backwards compatibility
type AnulacionDocumentoRequest = DatosDocumento & { motivoAnulacion: string; invoiceId: string };
import { cancelInvoice } from '@/app/actions/invoice/cancel-invoice.action';

interface CancelInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: AnulacionDocumentoRequest;
    /** Optional callback to refresh invoice list after successful cancellation */
    onSuccess?: () => void;
}

export function CancelInvoiceModal({ isOpen, onClose, request, onSuccess }: CancelInvoiceModalProps) {
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCancel = async () => {
        if (reason.length < 15) {
            toast.error('El motivo debe tener al menos 15 caracteres');
            return;
        }

        setIsProcessing(true);
        try {
            // Inject reason into request
            const finalRequest = {
                invoiceId: request.invoiceId, // Ensure invoiceId is passed
                motivoAnulacion: reason
            };

            const res = await cancelInvoice(finalRequest);

            if (res.success) {
                toast.success('Factura anulada correctamente');
                onClose();
                // Trigger invoice list refresh via React Query
                onSuccess?.();
            } else {
                toast.error(res.error || 'Error al anular factura');
            }
        } catch (error) {
            toast.error('Error inesperado al anular');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Anular Factura
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción es irreversible. La factura quedará anulada en DGI.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-red-50 p-3 rounded text-sm text-red-800 border border-red-200">
                        Estás a punto de anular la factura <strong>{request.numeroDocumentoFiscal}</strong>.
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Motivo de Anulación</Label>
                        <Textarea
                            id="reason"
                            placeholder="Describa el motivo de la anulación (mínimo 15 caracteres)..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[100px]"
                        />
                        <p className="text-xs text-gray-500 text-right">
                            {reason.length}/15 caracteres mínimos
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={isProcessing || reason.length < 15}
                        className="gap-2"
                    >
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar Anulación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

