'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { ScannerCamera, type ScanFeedback } from './ScannerCamera';
import { CheckoutView } from './CheckoutView';
import { useContinuousScanner } from '@/lib/pos/scanner/use-continuous-scanner';
import { usePosCart, type ProductInfo } from '@/lib/pos/cart/use-pos-cart';
import { playSuccessBeep, playErrorBeep } from '@/lib/pos/scanner/audio-feedback';
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ScanLine,
  LayoutGrid,
  Search,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PosProduct } from '@/features/pos/stores/pos.store';

interface MobileScannerPOSProps {
  resolveProduct: (barcode: string) => Promise<ProductInfo | null>;
  businessName: string;
  products: PosProduct[];
}

type View = 'pos' | 'checkout';
type Mode = 'scanner' | 'panel';

export function MobileScannerPOS({
  resolveProduct,
  businessName,
  products,
}: MobileScannerPOSProps) {
  const [view, setView] = useState<View>('pos');
  const [mode, setMode] = useState<Mode>('scanner');
  const [feedback, setFeedback] = useState<ScanFeedback>('idle');
  const [searchTerm, setSearchTerm] = useState('');

  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    items,
    total,
    itemCount,
    addByBarcode,
    addProduct,
    updateQty,
    clearCart,
  } = usePosCart({ resolveProduct });

  const showFeedback = useCallback((type: ScanFeedback) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback(type);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback('idle'), 400);
  }, []);

  const handleScan = useCallback(
    async (barcode: string) => {
      const result = await addByBarcode(barcode);
      if (result === 'notfound') {
        playErrorBeep();
        showFeedback('error');
      } else {
        playSuccessBeep();
        showFeedback('success');
      }
    },
    [addByBarcode, showFeedback]
  );

  const { startScanning, stopScanning, isActive, hasPermission } = useContinuousScanner({
    onScan: handleScan,
  });

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      if (view === 'pos' && mode === 'scanner') startScanning(video);
    },
    [startScanning, view, mode]
  );

  const handleModeChange = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      if (next === 'panel') stopScanning();
      setMode(next);
    },
    [mode, stopScanning]
  );

  const handleTapProduct = useCallback(
    (product: PosProduct) => {
      addProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        taxRate: product.taxRate,
        barcode: product.barcode,
        image: product.image,
      });
      playSuccessBeep();
    },
    [addProduct]
  );

  const handleGoToCheckout = useCallback(() => {
    stopScanning();
    setView('checkout');
  }, [stopScanning]);

  const handleCompleteOrBack = useCallback(
    (complete: boolean) => {
      if (complete) clearCart();
      setView('pos');
    },
    [clearCart]
  );

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  if (view === 'checkout') {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[60]">
        <CheckoutView
          items={items}
          total={total}
          businessName={businessName}
          onBack={() => handleCompleteOrBack(false)}
          onComplete={() => handleCompleteOrBack(true)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-transparent flex flex-col pb-28">
      <div className="px-4 pt-3 space-y-3">
        {/* Mode toggle — segmented control */}
        <div
          role="tablist"
          aria-label="Modo de POS"
          className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'scanner'}
            onClick={() => handleModeChange('scanner')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              mode === 'scanner'
                ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
            )}
          >
            <ScanLine className="h-4 w-4" />
            Scanner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'panel'}
            onClick={() => handleModeChange('panel')}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              mode === 'panel'
                ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Panel táctil
          </button>
        </div>

        {/* Main content area (scanner camera OR product panel) */}
        {mode === 'scanner' ? (
          <div className="relative overflow-hidden rounded-2xl bg-black h-[32vh] min-h-[220px] max-h-[300px] border border-gray-200 dark:border-white/[0.1] shadow-sm">
            <ScannerCamera
              onVideoReady={handleVideoReady}
              feedback={feedback}
              isActive={isActive}
              hasPermission={hasPermission}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                inputMode="search"
                placeholder="Buscar por nombre, SKU o código…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full h-11 pl-10 pr-3 rounded-2xl text-sm',
                  'bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1]',
                  'text-gray-900 dark:text-white placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50',
                  'shadow-sm'
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Panel product grid — outside the padded header so the grid can scroll naturally */}
      {mode === 'panel' && (
        <div className="px-4 pt-3 flex-1 min-h-0 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'Sin resultados' : 'No hay productos disponibles'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleTapProduct(p)}
                  className={cn(
                    'group flex flex-col text-left rounded-2xl overflow-hidden',
                    'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl',
                    'border border-gray-200 dark:border-white/[0.1]',
                    'shadow-sm hover:border-violet-400 dark:hover:border-violet-500/50',
                    'active:scale-[0.97] transition-all'
                  )}
                >
                  <div className="aspect-square bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-gray-300 dark:text-white/20" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[2.5rem]">
                      {p.name}
                    </p>
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                        Stock: {p.stock}
                      </span>
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cart list — always visible, shared between modes */}
      {mode === 'scanner' && (
        <div className="flex-1 min-h-0 flex flex-col px-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {itemCount === 0
                  ? 'Escanea un producto'
                  : `${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
              </span>
            </div>
            {itemCount > 0 && (
              <button
                type="button"
                onClick={clearCart}
                aria-label="Vaciar carrito"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-90 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto rounded-2xl',
              'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl',
              'border border-gray-200 dark:border-white/[0.1]'
            )}
          >
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-6">
                <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                  <ScanLine className="h-4 w-4 text-violet-500" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Apunta la cámara a un código de barras para agregar productos
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                        ${(item.price * item.qty).toFixed(2)}
                        <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                          (${item.price.toFixed(2)} c/u)
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        aria-label="Restar"
                        className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Minus className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-gray-900 dark:text-white">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        aria-label="Sumar"
                        className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Plus className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky cart summary + Revisar Orden CTA (above global bottom nav) */}
      <div className="fixed left-0 right-0 bottom-[72px] z-30 px-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-3 p-2 rounded-2xl',
            'bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl',
            'border border-gray-200 dark:border-white/[0.1]',
            'shadow-lg shadow-black/5 dark:shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)]'
          )}
        >
          <div className="flex items-center gap-2 pl-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold text-sm">
              {itemCount}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGoToCheckout}
            disabled={itemCount === 0}
            className={cn(
              'ml-auto flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all active:scale-[0.98]',
              'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/30',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
            )}
          >
            Revisar Orden
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
