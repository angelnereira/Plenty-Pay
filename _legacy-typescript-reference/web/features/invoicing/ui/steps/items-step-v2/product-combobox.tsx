'use client';

import { useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Badge } from '@shared/ui/badge';
import { Popover, PopoverContent, PopoverAnchor } from '@shared/ui/popover';

export interface FoundProduct {
    id: string;
    name: string;
    sku?: string;
    salePrice: number | string;
    taxCode?: string;
    cpbsCode?: string;
    cpbsUnit?: string;
    currentStock?: number;
}

interface ProductComboboxProps {
    value: string;
    onChange: (query: string) => void;
    onSelect: (product: FoundProduct) => void;
    isSearching: boolean;
    products: FoundProduct[];
}

export function ProductCombobox({ value, onChange, onSelect, isSearching, products }: ProductComboboxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const popoverOpen = products.length > 0 && value.length > 2;

    return (
        <div>
            <Label className="text-[10px] font-bold text-violet-600 uppercase mb-1 block">O busca en tu inventario</Label>
            <Popover open={popoverOpen}>
                <PopoverAnchor asChild>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                        <Input
                            ref={inputRef}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="pl-9 bg-violet-50/50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-800/50 h-10 text-sm"
                            placeholder="Nombre, SKU o código de barras..."
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-violet-600" />
                        )}
                    </div>
                </PopoverAnchor>
                <PopoverContent
                    className="p-0 w-[var(--radix-popover-trigger-width)] max-h-56 overflow-y-auto rounded-xl shadow-xl border border-gray-200 dark:border-slate-800"
                    sideOffset={4}
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {products.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelect(p)}
                            className="w-full text-left px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center justify-between border-b last:border-0 border-gray-50 dark:border-slate-800"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.name}</p>
                                <p className="text-[10px] text-gray-500">SKU: {p.sku || 'N/A'} | ${Number(p.salePrice)}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                                Stock: {Number(p.currentStock)}
                            </Badge>
                        </button>
                    ))}
                </PopoverContent>
            </Popover>
        </div>
    );
}
