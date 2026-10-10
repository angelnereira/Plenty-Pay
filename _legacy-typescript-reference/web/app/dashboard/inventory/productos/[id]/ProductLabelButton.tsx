"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { ProductLabelModal } from "@/features/inventory/ui/components/ProductLabelModal";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  unitType: string;
  brand?: string | null;
}

export function ProductLabelButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        title="Imprimir etiqueta QR / código de barras"
      >
        <QrCode className="h-5 w-5" />
        <span className="text-xs font-black uppercase tracking-widest">Etiqueta</span>
      </button>

      <ProductLabelModal
        isOpen={open}
        onClose={() => setOpen(false)}
        product={product}
      />
    </>
  );
}
