'use client';

import { Lock, AlertCircle, Trash2, Package } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { cn } from '@/lib/utils';
import type { DocumentMode } from '@/shared/hooks/use-document-form';
import type { UseInvoiceItemsReturn } from '@/shared/hooks/use-invoice-items';
import type { ReferencedInvoice } from '@/shared/hooks/use-document-form';

function itbmsLabel(code: string) {
    return code === '00' ? '0%' : code === '01' ? '7%' : code === '02' ? '10%' : '15%';
}

interface ReferencedNoteViewProps {
    documentMode: DocumentMode;
    referencedInvoice: ReferencedInvoice;
    items: UseInvoiceItemsReturn;
}

export function ReferencedNoteView({ documentMode, referencedInvoice, items }: ReferencedNoteViewProps) {
    const originalTotal = referencedInvoice.total;
    const ncTotal = items.totals.totalGeneral;
    const pct = originalTotal > 0 ? Math.min((ncTotal / originalTotal) * 100, 100) : 0;
    const exceeds = ncTotal > originalTotal;

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Modo restringido — {documentMode === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'} Referenciada
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Los ítems fueron importados de la factura original. Puede <strong>reducir cantidades</strong> o <strong>eliminar ítems</strong> para reflejar
                        una devolución parcial o descuento. No se pueden agregar productos nuevos.
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 font-mono">
                        DGI Reglas B606h (Rechazo 1711) y B606n (Rechazo 1717)
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-medium text-gray-900 dark:text-white">Ítems de la Nota</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                        {items.items.length} de {referencedInvoice.items?.length || '?'} ítems
                    </Badge>
                </div>

                {items.items.map((item) => {
                    const origItem = referencedInvoice.items?.find(o => o.description === item.descripcion);
                    const maxQty = origItem?.quantity ?? item.cantidad;
                    return (
                        <div key={item.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-3">
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">{item.descripcion}</p>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                        <span>Precio: ${item.precioUnitario.toFixed(2)}</span>
                                        <span className="text-gray-300">|</span>
                                        <span>ITBMS: {itbmsLabel(item.tasaITBMS)}</span>
                                        <span className="text-gray-300">|</span>
                                        <span className="text-purple-600 dark:text-purple-400 font-semibold">Subtotal: ${item.total.toFixed(2)}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => items.removeItem(item.id)} title="Excluir este ítem de la nota">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                                <Label className="text-xs text-gray-500 whitespace-nowrap">Cantidad a afectar:</Label>
                                <Input
                                    type="number"
                                    min={0.01}
                                    step={0.01}
                                    max={maxQty}
                                    value={item.cantidad}
                                    onChange={(e) => {
                                        let newQty = parseFloat(e.target.value) || 0;
                                        if (newQty > maxQty) newQty = maxQty;
                                        if (newQty < 0) newQty = 0;
                                        items.updateItem(item.id, { cantidad: newQty });
                                    }}
                                    className="w-24 h-8 text-sm bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                                />
                                <span className="text-xs text-gray-400">/ {maxQty} (original)</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Monto de la Nota vs. Factura Original:</span>
                    <span className={cn('font-bold font-mono', exceeds ? 'text-red-600' : 'text-gray-900 dark:text-white')}>
                        ${ncTotal.toFixed(2)} / ${originalTotal.toFixed(2)}
                    </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div
                        className={cn('h-2.5 rounded-full transition-all duration-300', exceeds ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
                {exceeds && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Excede el monto original — la DGI rechazará este documento (Rechazo 1711)
                    </p>
                )}
            </div>
        </div>
    );
}
