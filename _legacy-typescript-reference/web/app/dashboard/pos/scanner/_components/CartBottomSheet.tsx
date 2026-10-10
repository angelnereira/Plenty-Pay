'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { CartItemRow } from './CartItemRow';
import type { CartItem } from '@/lib/pos/cart/use-pos-cart';

const SNAP_POINTS = [0.15, 0.55, 1] as const;

interface CartBottomSheetProps {
  items: CartItem[];
  total: number;
  itemCount: number;
  lastAddedId: string | null;
  onUpdateQty: (id: string, qty: number) => void;
  onCheckout: () => void;
}

export function CartBottomSheet({
  items,
  total,
  itemCount,
  lastAddedId,
  onUpdateQty,
  onCheckout,
}: CartBottomSheetProps) {
  const [snap, setSnap] = useState<string | number | null>(SNAP_POINTS[0]);

  return (
    <Drawer.Root
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
      open
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-30 flex flex-col"
          style={{ height: '100dvh' }}
        >
          {/* Handle */}
          <div className="flex-shrink-0 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1.5 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-violet-600" />
              <span className="font-semibold text-sm">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              {itemCount > 0 && (
                <span className="text-muted-foreground text-sm">· ${total.toFixed(2)}</span>
              )}
            </div>

            {snap !== SNAP_POINTS[0] && (
              <button
                onClick={() => setSnap(SNAP_POINTS[0])}
                className="text-muted-foreground p-1"
              >
                <ChevronUp className="h-4 w-4 rotate-180" />
              </button>
            )}
          </div>

          {/* Scrollable item list */}
          <div className="flex-1 overflow-y-auto px-5 min-h-0">
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Escanea un producto para agregarlo
              </div>
            ) : (
              <div>
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isNew={item.id === lastAddedId}
                    onUpdateQty={onUpdateQty}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="flex-shrink-0 p-4 pb-8 border-t border-gray-100">
            <button
              onClick={onCheckout}
              disabled={itemCount === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-colors active:scale-[0.98]"
            >
              Revisar Orden · ${total.toFixed(2)}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
