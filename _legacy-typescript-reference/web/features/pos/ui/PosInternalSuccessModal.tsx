"use client";

import { CheckCircle2, FileText, Plus, X } from "lucide-react";
import { Button } from "@shared/ui/button";

interface Props {
    invoice: {
        id: string;
        number: string;
        issueDate?: Date;
    };
    onClose: () => void;
    onNewSale: () => void;
}

/**
 * Modal de éxito para ventas INTERNAS del POS (sin emisión a DGI).
 *
 * Particularidades vs. el flujo fiscal:
 *   - No hay CUFE / QR / protocolo de autorización.
 *   - El PDF interno ya se descargó automáticamente al confirmar la venta
 *     (ver useCheckout.processInternal).
 *   - Botón principal: "Nueva venta" (limpia carrito y vuelve al estado IDLE).
 */
export function PosInternalSuccessModal({ invoice, onClose, onNewSale }: Props) {
    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="internal-success-title"
        >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white relative">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 top-2 h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <CheckCircle2 className="h-7 w-7" />
                        </div>
                        <div>
                            <h2 id="internal-success-title" className="text-lg font-bold">
                                Comprobante interno generado
                            </h2>
                            <p className="text-sm text-white/90">Venta registrada sin emisión a la DGI.</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-4 border border-gray-100 dark:border-white/[0.08]">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 mb-1">
                            <FileText className="h-3.5 w-3.5" />
                            Número de comprobante
                        </div>
                        <p className="text-xl font-black text-gray-900 dark:text-white">
                            {invoice.number}
                        </p>
                        {invoice.issueDate && (
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(invoice.issueDate).toLocaleString('es-PA')}
                            </p>
                        )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        El PDF del comprobante interno se descargó automáticamente. Si necesita
                        emitir una factura fiscal con CUFE, vaya a Facturas → Editar.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" onClick={onClose} className="h-12 font-bold">
                            Cerrar
                        </Button>
                        <Button onClick={onNewSale} className="h-12 font-bold bg-violet-600 hover:bg-violet-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva venta
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
