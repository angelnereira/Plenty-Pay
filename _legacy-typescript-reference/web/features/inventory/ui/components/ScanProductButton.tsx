"use client";

import { useState, useCallback } from "react";
import { ScanLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Lazy load the scanner to avoid loading html5-qrcode on every page load
const MobileBarcodeScanner = dynamic(
  () => import("@/features/pos/ui/MobileBarcodeScanner").then(m => m.MobileBarcodeScanner),
  { ssr: false }
);

export function ScanProductButton() {
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  const handleScan = useCallback(async (code: string) => {
    if (searching) return;
    setSearching(true);
    setShowScanner(false);

    try {
      const res = await fetch(`/api/inventory/products/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const product = await res.json();
        toast.success(`Producto encontrado: ${product.name}`);
        router.push(`/dashboard/inventory/productos/${product.id}`);
      } else if (res.status === 404) {
        toast.error(`No se encontró producto con código "${code}"`, {
          action: {
            label: "Registrar",
            onClick: () => router.push(`/dashboard/inventory/productos/nuevo?barcode=${encodeURIComponent(code)}`),
          },
        });
      } else {
        toast.error("Error al buscar el producto");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSearching(false);
    }
  }, [searching, router]);

  return (
    <>
      <button
        onClick={() => setShowScanner(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
      >
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">Escanear</span>
      </button>

      {showScanner && (
        <MobileBarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
