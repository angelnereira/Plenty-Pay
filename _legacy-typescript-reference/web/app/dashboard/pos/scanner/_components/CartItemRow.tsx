'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartItem } from '@/lib/pos/cart/use-pos-cart';

interface CartItemRowProps {
  item: CartItem;
  isNew: boolean;
  onUpdateQty: (id: string, qty: number) => void;
}

export function CartItemRow({ item, isNew, onUpdateQty }: CartItemRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 border-b border-gray-100 last:border-0',
        isNew && 'animate-in slide-in-from-bottom-2 fade-in duration-300'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} c/u</p>
      </div>

      <div className="text-sm font-bold text-violet-600 min-w-[56px] text-right">
        ${(item.price * item.qty).toFixed(2)}
      </div>

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onUpdateQty(item.id, item.qty - 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white transition-colors active:scale-95"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
        <button
          onClick={() => onUpdateQty(item.id, item.qty + 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white transition-colors active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
