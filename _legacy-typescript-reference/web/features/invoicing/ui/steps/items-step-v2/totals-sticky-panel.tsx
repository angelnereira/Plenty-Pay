'use client';

import type { ItemTotals } from '@/shared/hooks/use-invoice-items';
import { Badge } from '@shared/ui/badge';

interface TotalsStickyPanelProps {
    totals: ItemTotals;
    itemCount: number;
}

export function TotalsStickyPanel({ totals, itemCount }: TotalsStickyPanelProps) {
    return (
        <div className="w-full lg:w-72 lg:flex-shrink-0 sticky top-0 self-start">
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Totales</span>
                    <Badge variant="outline" className="text-xs">
                        {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                    </Badge>
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                        <span
                            key={totals.subtotal}
                            className="font-mono font-medium text-gray-900 dark:text-white transition-all"
                        >
                            ${totals.subtotal.toFixed(2)}
                        </span>
                    </div>

                    {totals.totalDescuentos > 0 && (
                        <div className="flex justify-between">
                            <span className="text-orange-500 dark:text-orange-400">Descuentos</span>
                            <span
                                key={totals.totalDescuentos}
                                className="font-mono font-medium text-orange-500 dark:text-orange-400 transition-all"
                            >
                                -${totals.totalDescuentos.toFixed(2)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">ITBMS</span>
                        <span
                            key={totals.totalITBMS}
                            className="font-mono font-medium text-gray-900 dark:text-white transition-all"
                        >
                            ${totals.totalITBMS.toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                        <span className="font-semibold text-gray-900 dark:text-white">Total General</span>
                        <span
                            key={totals.totalGeneral}
                            className="font-mono font-bold text-purple-600 dark:text-purple-400 text-base transition-all"
                        >
                            ${totals.totalGeneral.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
