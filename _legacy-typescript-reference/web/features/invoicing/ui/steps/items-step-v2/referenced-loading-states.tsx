'use client';

import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@shared/ui/button';
import type { DocumentMode } from '@/shared/hooks/use-document-form';
import type { ReferencedInvoice } from '@/shared/hooks/use-document-form';

interface ReferencedLoadingProps {
    documentMode: DocumentMode;
    referencedInvoice: ReferencedInvoice;
    onRetryFetch: () => void;
    status: 'loading' | 'error';
}

export function ReferencedLoadingStates({ documentMode, referencedInvoice, onRetryFetch, status }: ReferencedLoadingProps) {
    const noteLabel = documentMode === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito';

    if (status === 'loading') {
        return (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{noteLabel} Referenciada</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Cargando ítems de la factura original...</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-gray-200 dark:border-slate-800">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Importando ítems de la factura {referencedInvoice.folio || referencedInvoice.invoiceNumber}...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-100">No se pudieron cargar los ítems de la factura original</p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">Puede reintentar la carga o volver al paso anterior y seleccionar otra factura.</p>
                    <Button variant="outline" size="sm" className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30" onClick={onRetryFetch}>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5" />
                        Reintentar carga
                    </Button>
                </div>
            </div>
        </div>
    );
}
