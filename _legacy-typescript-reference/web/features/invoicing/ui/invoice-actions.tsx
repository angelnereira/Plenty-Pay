
'use client';

import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Download, Mail, XCircle, Loader2 } from 'lucide-react';
import type { DatosDocumento } from '@/features/hka/model/types/types';

// Aliases for backwards compatibility
type DescargaRequest = DatosDocumento;
type AnulacionDocumentoRequest = DatosDocumento & { motivoAnulacion: string; invoiceId: string };
import { DeliveryModal } from './delivery-modal';
import { CancelInvoiceModal } from './cancel-invoice-modal'; // Will be created in Phase 5

interface InvoiceActionsProps {
    status: string;
    descargaRequest: DescargaRequest;
    anulacionRequest?: AnulacionDocumentoRequest;
    emailDefault?: string;
}

export function InvoiceActions({ status, descargaRequest, anulacionRequest, emailDefault }: InvoiceActionsProps) {
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const isCertified = ['EMITTED', 'CERTIFIED', 'APPROVED', 'ACEPTADO'].includes(status);
    // const isCancellable = isCertified; // Add more logic if needed (e.g. time limit)

    if (!isCertified) return null;

    return (
        <>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeliveryModal(true)}
                    className="gap-1.5 text-xs sm:text-sm"
                >
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Entregar</span>
                </Button>

                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowCancelModal(true)}
                    className="gap-1.5 text-xs sm:text-sm"
                >
                    <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Anular</span>
                </Button>
            </div>

            <DeliveryModal
                isOpen={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                invoiceDetails={descargaRequest}
                emailDefault={emailDefault}
            />

            {anulacionRequest && (
                <CancelInvoiceModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    request={anulacionRequest}
                    onSuccess={() => {
                        // Optional: trigger refresh if needed
                    }}
                />
            )}
        </>
    );
}
