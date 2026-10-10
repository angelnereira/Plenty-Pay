'use client';

import { User, CreditCard, ShoppingCart, CheckCircle2, FileMinus, FilePlus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseDocumentFormReturn } from '@/shared/hooks/use-document-form';
import type { UseInvoiceItemsReturn } from '@/shared/hooks/use-invoice-items';

// ── Constants ────────────────────────────────────────────────────────────────

const FORMAS_PAGO: Record<string, string> = {
    '01': 'Crédito',
    '02': 'Efectivo',
    '03': 'Tarjeta de Crédito',
    '04': 'Tarjeta de Débito',
    '08': 'Transferencia/Depósito',
    '09': 'Cheque',
    '99': 'Otro',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface ReviewStepProps {
    form: UseDocumentFormReturn;
    items: UseInvoiceItemsReturn;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReviewStep({ form, items }: ReviewStepProps) {
    const {
        documentMode, isNoteMode, needsExportFields,
        noteSubtype, noteReason, referencedInvoice,
        clientData, paymentData, exportData, docLabel,
    } = form;
    const { items: lineItems, totals } = items;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* NC/ND Info Banner */}
            {isNoteMode && (
                <div className={cn(
                    'rounded-xl p-4 border',
                    documentMode === 'NOTA_CREDITO'
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        {documentMode === 'NOTA_CREDITO'
                            ? <FileMinus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            : <FilePlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        }
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {docLabel} — {noteSubtype === 'REFERENCED' ? 'Referenciada' : 'Genérica'}
                        </span>
                    </div>
                    {referencedInvoice && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            Ref: {referencedInvoice.folio || referencedInvoice.invoiceNumber} — {referencedInvoice.clientName} — ${referencedInvoice.total.toFixed(2)}
                        </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Motivo: {noteReason}
                    </p>
                </div>
            )}

            {/* Other document type banner */}
            {!isNoteMode && documentMode !== 'FACTURA' && (
                <div className="rounded-xl p-4 border bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{docLabel}</span>
                    </div>
                    {needsExportFields && exportData.incoterm && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                            <p>INCOTERMS: <span className="font-mono font-medium">{exportData.incoterm}</span></p>
                            {exportData.currency && exportData.currency !== 'USD' && (
                                <p>
                                    Moneda: <span className="font-mono font-medium">{exportData.currency}</span>
                                    {exportData.exchangeRate && <> — Tasa: {exportData.exchangeRate}</>}
                                </p>
                            )}
                            {exportData.foreignAmount && (
                                <p>Monto extranjero: <span className="font-mono font-medium">${exportData.foreignAmount}</span></p>
                            )}
                            {exportData.port && <p>Puerto: {exportData.port}</p>}
                        </div>
                    )}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* Cliente */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">Cliente</h4>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Nombre</span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                                {clientData.razonSocial || 'Consumidor Final'}
                            </span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">RUC/ID</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">
                                {clientData.numeroRUC
                                    ? clientData.digitoVerificadorRUC
                                        ? `${clientData.numeroRUC}-${clientData.digitoVerificadorRUC}`
                                        : clientData.numeroRUC
                                    : 'N/A'}
                            </span>
                        </div>
                        {clientData.correoElectronico1 && (
                            <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Email</span>
                                <span className="text-gray-900 dark:text-white truncate">{clientData.correoElectronico1}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pago */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">Pago</h4>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Método</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {FORMAS_PAGO[paymentData.formaPagoFact] || paymentData.formaPagoFact}
                            </span>
                        </div>
                        {paymentData.descFormaPago && (
                            <div className="grid grid-cols-[100px_1fr] gap-2">
                                <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Detalle</span>
                                <span className="text-gray-900 dark:text-white">{paymentData.descFormaPago}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Summary */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white">Items ({lineItems.length})</h4>
                    </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {lineItems.map((item) => (
                        <div key={item.id} className="px-4 py-3 flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-white">{item.descripcion}</p>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {item.cantidad} x ${item.precioUnitario.toFixed(2)}
                                    {item.precioUnitarioDescuento < item.precioUnitario && (
                                        <span className="text-orange-600 ml-1">
                                            (-${(item.precioUnitario - item.precioUnitarioDescuento).toFixed(2)})
                                        </span>
                                    )}
                                    {item.cpbsCode && (
                                        <span className="text-amber-600 ml-1 font-mono">CPBS: {item.cpbsCode} ({item.cpbsUnit})</span>
                                    )}
                                </div>
                            </div>
                            <span className="font-mono font-medium text-sm text-gray-900 dark:text-white">
                                ${item.total.toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Totales */}
            <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 border border-dashed border-gray-200 dark:border-slate-800">
                <div className="space-y-2 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                        <span className="font-medium text-gray-900 dark:text-white">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">ITBMS</span>
                        <span className="font-medium text-gray-900 dark:text-white">${totals.totalITBMS.toFixed(2)}</span>
                    </div>
                    {totals.totalDescuentos > 0 && (
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                            <span>Descuento</span>
                            <span>-${totals.totalDescuentos.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="h-px bg-gray-200 dark:bg-slate-700 my-2" />
                    <div className="flex justify-between text-base font-bold">
                        <span className="text-gray-900 dark:text-white">Total a Pagar</span>
                        <span className="text-purple-600 dark:text-purple-400">${totals.totalGeneral.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Ready banner */}
            <div className="flex gap-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl p-4">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h4 className="font-medium text-sm text-emerald-900 dark:text-emerald-100">Listo para emitir</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        {`La ${docLabel.toLowerCase()} cumple con las validaciones de la DGI y será enviada a HKA para su certificación.`}
                    </p>
                </div>
            </div>
        </div>
    );
}
