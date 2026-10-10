'use client';

import { useMemo } from 'react';
import { MobileScannerPOS } from './MobileScannerPOS';
import type { ProductInfo } from '@/lib/pos/cart/use-pos-cart';
import type { PosProduct } from '@/features/pos/stores/pos.store';

interface ScannerResolverProps {
  products: PosProduct[];
  businessName: string;
}

export function ScannerResolver({ products, businessName }: ScannerResolverProps) {
  // Closure estable de resolveProduct sobre el array provisto por el server.
  // Match por barcode o sku; mapea PosProduct → ProductInfo (la forma que
  // espera el carrito).
  const resolveProduct = useMemo(
    () =>
      async (barcode: string): Promise<ProductInfo | null> => {
        const found = products.find((p) => p.barcode === barcode || p.sku === barcode);
        if (!found) return null;
        return {
          id: found.id,
          name: found.name,
          price: found.price,
          taxRate: found.taxRate,
          barcode: found.barcode,
          image: found.image,
        };
      },
    [products]
  );

  return (
    <MobileScannerPOS
      resolveProduct={resolveProduct}
      businessName={businessName}
      products={products}
    />
  );
}
