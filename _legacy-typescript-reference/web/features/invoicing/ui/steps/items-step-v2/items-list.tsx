'use client';

import { ShoppingBag, Package, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Badge } from '@shared/ui/badge';
import { cn } from '@/lib/utils';
import type { InvoiceItem } from '@/shared/hooks/use-invoice-items';

interface ItemsListProps {
    items: InvoiceItem[];
    editingItemId: string | null;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
}

export function ItemsList({ items, editingItemId, onEdit, onRemove }: ItemsListProps) {
    return (
        <>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Items de la Factura</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </Badge>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-gray-200 dark:border-slate-800">
                    <ShoppingBag className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay items agregados aún.</p>
                    <p className="text-xs text-gray-400 mt-1">Utiliza el formulario de abajo para agregar productos o servicios.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                'flex items-center justify-between p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm hover:border-purple-200 dark:hover:border-purple-800 transition-colors',
                                editingItemId === item.id
                                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-100 dark:border-slate-800'
                            )}
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.descripcion}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Cant: {item.cantidad}</span>
                                    <span>x ${item.precioUnitario.toFixed(2)}</span>
                                    {item.precioUnitarioDescuento > 0 && (
                                        <span className="text-orange-500">Desc: -${(item.precioUnitario - item.precioUnitarioDescuento).toFixed(2)}</span>
                                    )}
                                    {item.cpbsCode && (
                                        <span className="text-amber-600 dark:text-amber-400 font-mono">CPBS: {item.cpbsCode}</span>
                                    )}
                                    <span className="text-purple-600 dark:text-purple-400 font-medium ml-auto sm:ml-0">
                                        Total: ${item.total.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => onEdit(item.id)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onRemove(item.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
