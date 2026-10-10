"use client";

import { useRef, useState, useEffect } from "react";
import { X, Printer, QrCode, Copy, Minus, Plus, Settings2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Label Size Presets ──────────────────────────────────────────────────────
// Compatible with most popular thermal/label printers via browser print

export const LABEL_PRESETS = {
  "50x30": {
    name: '50×30 mm',
    description: 'Zebra GK420d, Brother QL-800, TSC TDP-225',
    widthMm: 50,
    heightMm: 30,
    codeSize: 22,
  },
  "40x30": {
    name: '40×30 mm',
    description: 'Godex G500, HPRT HT300',
    widthMm: 40,
    heightMm: 30,
    codeSize: 20,
  },
  "60x40": {
    name: '60×40 mm',
    description: 'Zebra ZD420, Honeywell PC42t',
    widthMm: 60,
    heightMm: 40,
    codeSize: 28,
  },
  "70x40": {
    name: '70×40 mm',
    description: 'Zebra ZT230, TSC TTP-244 Pro',
    widthMm: 70,
    heightMm: 40,
    codeSize: 30,
  },
  "100x50": {
    name: '100×50 mm',
    description: 'Zebra ZT410, SATO CL4NX',
    widthMm: 100,
    heightMm: 50,
    codeSize: 36,
  },
  "80x50": {
    name: '80×50 mm',
    description: 'Dymo LabelWriter 4XL, Brother QL-1110',
    widthMm: 80,
    heightMm: 50,
    codeSize: 34,
  },
} as const;

type PresetKey = keyof typeof LABEL_PRESETS;

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number | string;
  unitType: string;
  brand?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

type CodeType = "qr" | "barcode" | "both";

// ─── Barcode SVG component ───────────────────────────────────────────────────

function BarcodeSVG({ value, width = 1.5, height = 40 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue: true,
        fontSize: 10,
        margin: 2,
        textMargin: 2,
      });
    } catch {
      // Silent fallback
    }
  }, [value, width, height]);

  return <svg ref={svgRef} />;
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function ProductLabelModal({ isOpen, onClose, product }: Props) {
  const [labelSize, setLabelSize] = useState<PresetKey>("50x30");
  const [codeType, setCodeType] = useState<CodeType>("qr");
  const [showPrice, setShowPrice] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const preset = LABEL_PRESETS[labelSize];
  const productCode = product.sku || product.barcode || product.id.slice(-8).toUpperCase();
  const qrValue = JSON.stringify({ id: product.id, sku: product.sku, barcode: product.barcode });
  const barcodeValue = product.barcode || product.sku || product.id.slice(-12);
  const price = typeof product.salePrice === "string" ? parseFloat(product.salePrice) : product.salePrice;

  function handlePrint() {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión. Permite ventanas emergentes.");
      return;
    }

    const labelsHtml = Array.from({ length: quantity })
      .map(() => printRef.current!.querySelector("[data-label]")!.outerHTML)
      .join("");

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Etiqueta - ${product.name}</title>
  <style>
    @page {
      size: ${preset.widthMm}mm ${preset.heightMm}mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      width: ${preset.widthMm}mm;
      height: ${preset.heightMm}mm;
      padding: 1.5mm;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 2mm;
      page-break-after: always;
      overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }
    .code-area {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .code-area svg { max-width: 100%; max-height: 100%; }
    .info-area {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.5mm;
    }
    .product-name {
      font-size: ${preset.heightMm < 35 ? '7' : '8'}pt;
      font-weight: 700;
      line-height: 1.15;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .product-code {
      font-size: 6pt;
      font-family: 'Courier New', monospace;
      color: #666;
    }
    .product-price {
      font-size: ${preset.heightMm < 35 ? '10' : '12'}pt;
      font-weight: 900;
    }
    .product-unit {
      font-size: 5pt;
      color: #888;
      text-transform: uppercase;
    }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>${labelsHtml}</body>
</html>`);

    printWindow.document.close();
    // Small delay for SVGs to render
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(productCode);
    toast.success("Código copiado");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-violet-50 to-white dark:from-violet-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <QrCode className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Etiqueta de Producto</h2>
              <p className="text-[11px] text-gray-500">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-5 space-y-4">
          {/* Label Preview */}
          <div ref={printRef} className="flex justify-center">
            <div
              data-label
              className="label bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center gap-3 overflow-hidden"
              style={{
                width: `${preset.widthMm * 2.5}px`,
                height: `${preset.heightMm * 2.5}px`,
                padding: `${preset.heightMm < 35 ? 6 : 8}px`,
              }}
            >
              {/* Code Area */}
              <div className="code-area flex-shrink-0 flex items-center justify-center">
                {(codeType === "qr" || codeType === "both") && (
                  <QRCodeSVG value={qrValue} size={preset.codeSize * 2} level="M" />
                )}
                {codeType === "barcode" && (
                  <BarcodeSVG value={barcodeValue} width={1} height={preset.codeSize * 1.2} />
                )}
              </div>

              {/* Info Area */}
              <div className="info-area flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <div className="product-name text-xs font-bold text-gray-900 leading-tight line-clamp-2">
                  {product.name}
                </div>
                <div className="product-code text-[10px] font-mono text-gray-500">
                  {productCode}
                </div>
                {showPrice && (
                  <div className="product-price text-sm font-black text-gray-900">
                    ${price.toFixed(2)}
                    <span className="product-unit text-[9px] font-normal text-gray-400 ml-1">/{product.unitType}</span>
                  </div>
                )}
              </div>

              {/* Both QR + Barcode */}
              {codeType === "both" && (
                <div className="flex-shrink-0">
                  <BarcodeSVG value={barcodeValue} width={0.8} height={preset.codeSize * 0.8} />
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Vista previa — formato {preset.name} ({preset.description})
          </p>

          {/* Quick Controls */}
          <div className="grid grid-cols-3 gap-2">
            {/* Code Type */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tipo</label>
              <select
                value={codeType}
                onChange={(e) => setCodeType(e.target.value as CodeType)}
                className="w-full text-xs px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="qr">QR Code</option>
                <option value="barcode">Código de Barras</option>
                <option value="both">QR + Barras</option>
              </select>
            </div>

            {/* Label Size */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tamaño</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as PresetKey)}
                className="w-full text-xs px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white"
              >
                {Object.entries(LABEL_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.name}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Cantidad</label>
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-full text-center text-xs py-2 bg-white dark:bg-slate-800 dark:text-white border-0 focus:ring-0"
                />
                <button
                  onClick={() => setQuantity(Math.min(500, quantity + 1))}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showSettings ? "Ocultar opciones" : "Más opciones"}
          </button>

          {showSettings && (
            <div className="bg-gray-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Mostrar precio</span>
              </label>
              <div className="text-[10px] text-gray-400 pt-1">
                <strong>Impresoras compatibles:</strong> Zebra (GK/GX/ZD/ZT series), Brother (QL series),
                Dymo (LabelWriter), TSC (TDP/TTP series), Honeywell (PC42/PD43), HPRT (HT300),
                Godex (G500), SATO (CL series), Epson (TM-L90), y cualquier impresora con driver instalado.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-slate-800/30">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyCode}>
            <Copy className="h-3 w-3" /> Copiar Código
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir {quantity > 1 ? `(${quantity})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
