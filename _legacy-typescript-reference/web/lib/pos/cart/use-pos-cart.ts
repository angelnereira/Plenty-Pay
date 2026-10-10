'use client';

import { useState, useCallback, useRef } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  taxRate: number;
  barcode?: string;
  image?: string;
  qty: number;
}

export type ProductInfo = Omit<CartItem, 'qty'>;

export interface UsePosCartOptions {
  resolveProduct: (barcode: string) => Promise<ProductInfo | null>;
}

export interface UsePosCartResult {
  items: CartItem[];
  total: number;
  itemCount: number;
  lastAdded: CartItem | null;
  isResolving: boolean;
  addByBarcode: (barcode: string) => Promise<'added' | 'incremented' | 'notfound'>;
  addProduct: (product: ProductInfo) => 'added' | 'incremented';
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
}

export function usePosCart({ resolveProduct }: UsePosCartOptions): UsePosCartResult {
  const [items, setItems] = useState<CartItem[]>([]);
  const [lastAdded, setLastAdded] = useState<CartItem | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Prevent concurrent resolves of the same barcode
  const resolvingRef = useRef(false);

  const addByBarcode = useCallback(
    async (barcode: string): Promise<'added' | 'incremented' | 'notfound'> => {
      if (resolvingRef.current) return 'notfound';
      resolvingRef.current = true;
      setIsResolving(true);

      try {
        const product = await resolveProduct(barcode);
        if (!product) return 'notfound';

        let result: 'added' | 'incremented' = 'added';

        setItems((prev) => {
          const existing = prev.find((i) => i.id === product.id);
          if (existing) {
            result = 'incremented';
            return prev.map((i) =>
              i.id === product.id ? { ...i, qty: i.qty + 1 } : i
            );
          }
          const newItem: CartItem = { ...product, qty: 1 };
          return [...prev, newItem];
        });

        // Update lastAdded after state update
        setLastAdded({ ...product, qty: 1 });

        return result;
      } finally {
        resolvingRef.current = false;
        setIsResolving(false);
      }
    },
    [resolveProduct]
  );

  const addProduct = useCallback((product: ProductInfo): 'added' | 'incremented' => {
    let result: 'added' | 'incremented' = 'added';
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        result = 'incremented';
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setLastAdded({ ...product, qty: 1 });
    return result;
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, qty } : i));
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setLastAdded(null);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return { items, total, itemCount, lastAdded, isResolving, addByBarcode, addProduct, updateQty, clearCart };
}
