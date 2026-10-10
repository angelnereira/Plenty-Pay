"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X, Package, Plus, Trash2, MapPin, Truck, AlertCircle,
  FileText, Search, CheckCircle2, AlertTriangle, Boxes,
  ChevronLeft, ChevronRight, Loader2, QrCode, ExternalLink,
  Shirt, Footprints, Home, Plug, Smartphone, ShoppingBasket, Wrench, Briefcase, Monitor,
  type LucideIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecipientCombobox } from "./RecipientCombobox";
import {
  ITEM_CATEGORIES,
  CATEGORY_FIELDS,
  ITBMS_OPTIONS,
  UMC_OPTIONS,
  type ItemCategory,
} from "@/features/logistics/model/item-categories";

// ─── Category icon map (Lucide only — no emojis) ─────────────────────────────

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  GENERAL:           Package,
  ROPA:              Shirt,
  CALZADO:           Footprints,
  MUEBLES:           Home,
  ELECTRODOMESTICOS: Plug,
  ELECTRONICA:       Smartphone,
  ALIMENTOS:         ShoppingBasket,
  INSUMOS:           Wrench,
  SERVICIOS:         Briefcase,
  SOFTWARE:          Monitor,
};

// Color accent per category (Tailwind classes: bg + text + border)
const CATEGORY_COLORS: Record<string, { idle: string; active: string }> = {
  ROPA:              { idle: 'border-blue-200   dark:border-blue-800   text-blue-700   dark:text-blue-300   bg-blue-50   dark:bg-blue-950/30',   active: 'bg-blue-600   border-blue-600   text-white' },
  CALZADO:           { idle: 'border-amber-200  dark:border-amber-800  text-amber-700  dark:text-amber-300  bg-amber-50  dark:bg-amber-950/30',  active: 'bg-amber-600  border-amber-600  text-white' },
  MUEBLES:           { idle: 'border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30', active: 'bg-orange-600 border-orange-600 text-white' },
  ELECTRODOMESTICOS: { idle: 'border-slate-300  dark:border-slate-600  text-slate-600  dark:text-slate-300  bg-slate-50  dark:bg-slate-800/50',  active: 'bg-slate-600  border-slate-600  text-white' },
  ELECTRONICA:       { idle: 'border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30', active: 'bg-violet-600 border-violet-600 text-white' },
  ALIMENTOS:         { idle: 'border-green-200  dark:border-green-800  text-green-700  dark:text-green-300  bg-green-50  dark:bg-green-950/30',  active: 'bg-green-600  border-green-600  text-white' },
  INSUMOS:           { idle: 'border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/30', active: 'bg-yellow-600 border-yellow-600 text-white' },
  SERVICIOS:         { idle: 'border-teal-200   dark:border-teal-800   text-teal-700   dark:text-teal-300   bg-teal-50   dark:bg-teal-950/30',   active: 'bg-teal-600   border-teal-600   text-white' },
  SOFTWARE:          { idle: 'border-sky-200    dark:border-sky-800    text-sky-700    dark:text-sky-300    bg-sky-50    dark:bg-sky-950/30',    active: 'bg-sky-600    border-sky-600    text-white' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitType: string;
  currentStock: number;
  salePrice: number;
  taxRate: number;
  weight: string | null;
  dimensions: string | null;
}

interface ItemRow {
  productId?: string;
  productName?: string;
  fromInventory: boolean;
  currentStock?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  packaging: string;
  weightKg: string;
  dimensions: string;
  // Category classification
  category: string;
  sku: string;
  barcode: string;
  taxRate: string;  // ITBMS rate e.g. "0.07"
  umc: string;      // DGI unit of measure
  cpbsCode: string;
  categoryMeta: Record<string, string>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: { id: string; code: string }) => void;
}

const EMPTY_ITEM: ItemRow = {
  fromInventory: false,
  description: "",
  quantity: "1",
  unitPrice: "",
  packaging: "Unidad",
  weightKg: "",
  dimensions: "",
  category: "GENERAL",
  sku: "",
  barcode: "",
  taxRate: "",
  umc: "UND",
  cpbsCode: "",
  categoryMeta: {},
};

const STEPS = [
  { id: "general", label: "General", icon: MapPin },
  { id: "items", label: "Paquetes", icon: Boxes },
  { id: "transport", label: "Transporte", icon: Truck },
  { id: "conditions", label: "Condiciones", icon: AlertCircle },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── ProductSearchInput ───────────────────────────────────────────────────────

function ProductSearchInput({
  item,
  idx,
  onSelect,
  onClear,
}: {
  item: ItemRow;
  idx: number;
  onSelect: (idx: number, product: InventoryProduct) => void;
  onClear: (idx: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/logistics/products/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setOpen(true);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => search(v), 280);
  }

  function handleFocus() {
    if (query.length === 0) search("");
  }

  if (item.fromInventory) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.productName}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400">
            Inventario · Stock: {item.currentStock}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClear(idx)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
          title="Quitar del inventario (modo manual)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={handleFocus}
          placeholder="Buscar en inventario o escribir descripción..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800 dark:text-white transition-colors"
        />
        {searching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-56 overflow-y-auto scrollbar-hide">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(idx, p);
                setQuery("");
                setOpen(false);
                setResults([]);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</div>
                  {p.sku && <div className="text-xs text-gray-500">SKU: {p.sku}</div>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      p.currentStock > 10
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : p.currentStock > 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {p.currentStock} {p.unitType}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">${p.salePrice.toFixed(2)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !searching && query.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500 text-center">
          No se encontraron productos. Escribe la descripción manualmente.
        </div>
      )}
    </div>
  );
}

// ─── CategoryFields ───────────────────────────────────────────────────────────

function CategoryFields({
  category,
  meta,
  onChange,
}: {
  category: string;
  meta: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const fields = CATEGORY_FIELDS[category as ItemCategory] ?? [];
  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((f) => (
        <div key={f.key} className={f.fullWidth ? "col-span-2" : ""}>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
          {f.type === "select" ? (
            <select
              value={meta[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="">— Seleccionar —</option>
              {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
              value={meta[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  idx,
  onRemove,
  onUpdate,
  onMetaChange,
}: {
  item: ItemRow;
  idx: number;
  onRemove: () => void;
  onUpdate: (field: keyof ItemRow, value: string) => void;
  onMetaChange: (key: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = item.fromInventory ? (item.productName ?? item.description) : item.description;
  const hasPrice = item.unitPrice && parseFloat(item.unitPrice) > 0;
  const lineTotal = hasPrice
    ? (parseFloat(item.unitPrice!) * parseFloat(item.quantity || "1")).toFixed(2)
    : null;
  const qtyOverStock =
    item.fromInventory &&
    item.currentStock !== undefined &&
    parseFloat(item.quantity) > item.currentStock;

  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-800/40 border rounded-xl overflow-hidden transition-colors",
        qtyOverStock
          ? "border-amber-300 dark:border-amber-700"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold",
            item.fromInventory
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {displayName || <span className="italic text-gray-400">Sin descripción</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.sku && (
              <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">{item.sku}</span>
            )}
            <span className="text-xs text-gray-500">{item.quantity} {item.packaging}</span>
            {lineTotal && <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">${lineTotal}</span>}
            {item.fromInventory && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Inventario
              </span>
            )}
            {item.category && item.category !== "GENERAL" && (() => {
              const cat = ITEM_CATEGORIES.find(c => c.value === item.category);
              const CatIcon = CATEGORY_ICONS[item.category];
              const colors = CATEGORY_COLORS[item.category];
              return cat ? (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                  colors?.idle ?? "bg-gray-50 border-gray-200 text-gray-600"
                )}>
                  {CatIcon && <CatIcon className="h-2.5 w-2.5" />} {cat.label}
                </span>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            title={expanded ? "Colapsar" : "Editar"}
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")} />
          </button>
          <button
            type="button"
            title="Eliminar"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {qtyOverStock && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Cantidad supera el stock disponible ({item.currentStock})
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-slate-800/20 space-y-2">
          {!item.fromInventory && (
            <input
              type="text"
              value={item.description}
              onChange={(e) => onUpdate("description", e.target.value)}
              placeholder="Descripción del artículo"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800 dark:text-white"
            />
          )}
          {/* SKU + Barcode editable in card */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Artículo / SKU</label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => onUpdate("sku", e.target.value)}
                placeholder="FIJI-M-10"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Código de barras</label>
              <input
                type="text"
                value={item.barcode}
                onChange={(e) => onUpdate("barcode", e.target.value)}
                placeholder="EAN-13 / UPC-A"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Cantidad</label>
              <input
                type="number" min="0.01" step="any"
                value={item.quantity}
                onChange={(e) => onUpdate("quantity", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white text-center"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Empaque</label>
              <select
                value={item.packaging}
                onChange={(e) => onUpdate("packaging", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
              >
                {["Unidad","Caja","Bolsa","Pallet","Servicio"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Precio unit.</label>
              <input
                type="number" min="0" step="0.01"
                value={item.unitPrice}
                onChange={(e) => onUpdate("unitPrice", e.target.value)}
                placeholder="0.00"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min="0" step="0.01"
              value={item.weightKg}
              onChange={(e) => onUpdate("weightKg", e.target.value)}
              placeholder="Peso (kg)"
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
            />
            <input
              type="text"
              value={item.dimensions}
              onChange={(e) => onUpdate("dimensions", e.target.value)}
              placeholder="Dimensiones LxAxH"
              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
          {/* Category meta fields */}
          {item.category && item.category !== "GENERAL" && (
            <CategoryFields
              category={item.category}
              meta={item.categoryMeta ?? {}}
              onChange={onMetaChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── AddItemForm ──────────────────────────────────────────────────────────────

function AddItemForm({
  mode,
  onModeChange,
  draft,
  onDraftChange,
  onProductSelect,
  onClearInventory,
  onAdd,
  onCancel,
}: {
  mode: "inventory" | "manual";
  onModeChange: (m: "inventory" | "manual") => void;
  draft: ItemRow;
  onDraftChange: (field: keyof ItemRow, value: string) => void;
  onProductSelect: (product: InventoryProduct) => void;
  onClearInventory: () => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const [showPhysical, setShowPhysical] = useState(false);
  const canAdd = draft.fromInventory || draft.description.trim().length > 0;

  return (
    <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-950/10 p-4 space-y-3">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["inventory", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium border transition-all",
              mode === m
                ? "bg-white dark:bg-slate-800 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm"
                : "bg-white/60 dark:bg-slate-800/30 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            {m === "inventory" ? <Search className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            {m === "inventory" ? "Del inventario" : "Descripción libre"}
          </button>
        ))}
      </div>

      {/* Primary input */}
      {mode === "inventory" ? (
        <div>
          <p className="text-[11px] text-gray-400 mb-1.5">Busca un producto de tu catálogo</p>
          <ProductSearchInput
            item={draft}
            idx={-1}
            onSelect={(_, product) => onProductSelect(product)}
            onClear={onClearInventory}
          />
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-gray-400 mb-1.5">Describe el artículo a entregar</p>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => onDraftChange("description", e.target.value)}
            placeholder="Ej: 3 cajas de camisetas talla M color azul..."
            autoFocus
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800/80 dark:text-white"
          />
        </div>
      )}

      {/* Qty + Packaging + Price */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Cantidad</label>
          <input
            type="number" min="0.01" step="any"
            value={draft.quantity}
            onChange={(e) => onDraftChange("quantity", e.target.value)}
            className="w-full px-2 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white text-center"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Empaque</label>
          <select
            value={draft.packaging}
            onChange={(e) => onDraftChange("packaging", e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
          >
            {["Unidad","Caja","Bolsa","Pallet","Servicio"].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Precio unit.</label>
          <input
            type="number" min="0" step="0.01"
            value={draft.unitPrice}
            onChange={(e) => onDraftChange("unitPrice", e.target.value)}
            placeholder="0.00"
            className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Physical details (collapsible) */}
      <button
        type="button"
        onClick={() => setShowPhysical(!showPhysical)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150", showPhysical && "rotate-90")} />
        Peso y dimensiones (opcional)
      </button>
      {showPhysical && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number" min="0" step="0.01"
            value={draft.weightKg}
            onChange={(e) => onDraftChange("weightKg", e.target.value)}
            placeholder="Peso (kg)"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
          />
          <input
            type="text"
            value={draft.dimensions}
            onChange={(e) => onDraftChange("dimensions", e.target.value)}
            placeholder="Dimensiones LxAxH"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
          />
        </div>
      )}

      {/* Over-stock warning */}
      {draft.fromInventory && draft.currentStock !== undefined && parseFloat(draft.quantity) > draft.currentStock && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Cantidad supera el stock disponible ({draft.currentStock})
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir a la orden
        </button>
      </div>
    </div>
  );
}

// ─── EmptyItemsState ──────────────────────────────────────────────────────────

function EmptyItemsState({
  onInventory,
  onManual,
}: {
  onInventory: () => void;
  onManual: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <Package className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sin ítems aún</p>
        <p className="text-xs text-gray-400 mt-1">¿Cómo deseas agregar el primer artículo?</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onInventory}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all group text-left"
        >
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60 rounded-xl flex items-center justify-center transition-colors">
            <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-white">Del inventario</div>
            <div className="text-xs text-gray-400 mt-0.5">Busca un producto y descuenta stock</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onManual}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all group text-left"
        >
          <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/40 group-hover:bg-rose-200 dark:group-hover:bg-rose-900/60 rounded-xl flex items-center justify-center transition-colors">
            <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-white">Descripción libre</div>
            <div className="text-xs text-gray-400 mt-0.5">Escribe cualquier artículo sin inventario</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Success View (post-creation with QR) ────────────────────────────────────

function SuccessView({ order, onClose }: {
  order: { id: string; code: string; qrToken?: string };
  onClose: () => void;
}) {
  const trackingUrl = order.qrToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.qrToken}`
    : null;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Orden Creada</h3>
        <p className="text-sm text-gray-500 mt-1">
          Código: <span className="font-mono font-bold text-gray-900 dark:text-white">{order.code}</span>
        </p>
      </div>

      {trackingUrl && (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <QrCode className="h-3.5 w-3.5" />
            QR de Rastreo
          </div>
          <div className="bg-white p-3 rounded-xl inline-block mx-auto">
            <QRCodeSVG value={trackingUrl} size={160} level="M" />
          </div>
          <p className="text-xs text-gray-400 max-w-[240px] mx-auto">
            Escanea este código para rastrear el estado de la entrega en tiempo real
          </p>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium"
          >
            <ExternalLink className="h-3 w-3" /> Ver página de rastreo
          </a>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <a href={`/dashboard/logistics/${order.id}`}>
          <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-2">
            <FileText className="h-4 w-4" /> Ver Detalle
          </Button>
        </a>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function CreateDeliveryOrderModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("general");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; code: string; qrToken?: string } | null>(null);
  const [form, setForm] = useState({
    priority: "Normal",
    purchaseOrderRef: "",
    customerName: "",
    customerRuc: "",
    customerPhone: "",
    customerEmail: "",
    deliveryLocation: "",
    deliveryAddressText: "",
    carrierName: "",
    driverName: "",
    driverIdDoc: "",
    driverLicense: "",
    vehiclePlate: "",
    insurancePolicy: "",
    shippingMode: "Terrestre",
    incoterm: "",
    controlledTemp: false,
    hazardousMat: false,
    notes: "",
    shippingCost: "",
    insuranceCost: "",
    emitInvoice: false,
  });

  const [items, setItems] = useState<ItemRow[]>([]);
  const [addMode, setAddMode] = useState<"inventory" | "manual">("manual");
  const [draft, setDraft] = useState<ItemRow>({ ...EMPTY_ITEM });
  const [showPhysical, setShowPhysical] = useState(false);
  const [showClassify, setShowClassify] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Load saved defaults
  useEffect(() => {
    if (!isOpen || defaultsLoaded) return;
    async function loadDefaults() {
      try {
        const res = await fetch('/api/logistics/config');
        if (!res.ok) return;
        const defaults = await res.json();
        setForm(f => ({
          ...f,
          ...(defaults.defaultPriority && { priority: defaults.defaultPriority }),
          ...(defaults.defaultShippingMode && { shippingMode: defaults.defaultShippingMode }),
          ...(defaults.defaultIncoterm && { incoterm: defaults.defaultIncoterm }),
          ...(defaults.defaultControlledTemp !== undefined && { controlledTemp: defaults.defaultControlledTemp }),
          ...(defaults.defaultHazardousMat !== undefined && { hazardousMat: defaults.defaultHazardousMat }),
          ...(defaults.defaultVehiclePlate && { vehiclePlate: defaults.defaultVehiclePlate }),
          ...(defaults.defaultInsurancePolicy && { insurancePolicy: defaults.defaultInsurancePolicy }),
          ...(defaults.defaultNotes && { notes: defaults.defaultNotes }),
        }));
        if (defaults.defaultCarrierId || defaults.defaultDriverId) {
          const [carriersRes, driversRes] = await Promise.all([
            defaults.defaultCarrierId ? fetch('/api/logistics/carriers') : Promise.resolve(null),
            defaults.defaultDriverId ? fetch('/api/logistics/drivers') : Promise.resolve(null),
          ]);
          if (carriersRes?.ok) {
            const carriers = await carriersRes.json();
            const carrier = carriers.find((c: { id: string }) => c.id === defaults.defaultCarrierId);
            if (carrier) setForm(f => ({ ...f, carrierName: carrier.name }));
          }
          if (driversRes?.ok) {
            const drivers = await driversRes.json();
            const driver = drivers.find((d: { id: string }) => d.id === defaults.defaultDriverId);
            if (driver) setForm(f => ({ ...f, driverName: `${driver.firstName} ${driver.lastName}`, driverLicense: driver.licenseNo || f.driverLicense }));
          }
        }
        if (defaults.defaultPackaging) {
          setItems(prev => prev.map((item, i) => i === 0 ? { ...item, packaging: defaults.defaultPackaging } : item));
        }
      } catch {
        // Silent
      } finally {
        setDefaultsLoaded(true);
      }
    }
    loadDefaults();
  }, [isOpen, defaultsLoaded]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDefaultsLoaded(false);
      setCreatedOrder(null);
      setCurrentStep("general");
      setItems([]);
      setDraft({ ...EMPTY_ITEM });
      setShowPhysical(false);
      setShowClassify(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStepIdx = STEPS.findIndex((s) => s.id === currentStep);
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === STEPS.length - 1;

  function goNext() {
    if (currentStep === "general" && !form.customerName.trim()) {
      toast.error("El nombre del destinatario es obligatorio.");
      return;
    }
    if (currentStep === "items" && (items.length === 0 || items.every((i) => !i.description.trim() && !i.fromInventory))) {
      toast.error("Agrega al menos un producto o ítem de mercancía.");
      return;
    }
    if (!isLastStep) setCurrentStep(STEPS[currentStepIdx + 1].id);
  }

  function goBack() {
    if (!isFirstStep) setCurrentStep(STEPS[currentStepIdx - 1].id);
  }

  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ItemRow, value: string) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function handleProductSelect(idx: number, product: InventoryProduct) {
    setItems(items.map((item, i) =>
      i === idx
        ? {
            ...item,
            productId: product.id,
            productName: product.name,
            fromInventory: true,
            currentStock: product.currentStock,
            description: product.name + (product.sku ? ` (${product.sku})` : ""),
            unitPrice: product.salePrice.toFixed(2),
            packaging: product.unitType || "Unidad",
            weightKg: product.weight ?? "",
            dimensions: product.dimensions ?? "",
          }
        : item
    ));
  }

  function handleClearInventory(idx: number) {
    setItems(items.map((item, i) =>
      i === idx
        ? { ...EMPTY_ITEM, description: item.description }
        : item
    ));
  }

  // ── Draft (add-item form) helpers ──
  function commitDraft() {
    if (!draft.fromInventory && !draft.description.trim()) {
      toast.error("Agrega una descripción al ítem.");
      return;
    }
    setItems((prev) => [...prev, draft]);
    setDraft({ ...EMPTY_ITEM });
  }

  function updateDraftField(field: keyof ItemRow, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function handleDraftProductSelect(product: InventoryProduct) {
    setDraft((d) => ({
      ...d,
      productId: product.id,
      productName: product.name,
      fromInventory: true,
      currentStock: product.currentStock,
      description: product.name + (product.sku ? ` (${product.sku})` : ""),
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      unitPrice: product.salePrice.toFixed(2),
      taxRate: product.taxRate ? String(product.taxRate) : "",
      packaging: product.unitType || "Unidad",
      weightKg: product.weight ?? "",
      dimensions: product.dimensions ?? "",
      quantity: "1",
    }));
  }

  function handleDraftClearInventory() {
    setDraft({ ...EMPTY_ITEM });
  }

  function updateDraftMeta(key: string, value: string) {
    setDraft((d) => ({ ...d, categoryMeta: { ...d.categoryMeta, [key]: value } }));
  }

  function updateItemMeta(idx: number, key: string, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, categoryMeta: { ...item.categoryMeta, [key]: value } }
          : item
      )
    );
  }

  const inventoryItemCount = items.filter((i) => i.fromInventory).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error("El nombre del destinatario es obligatorio.");
      setCurrentStep("general");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description.trim() && !i.fromInventory)) {
      toast.error("Agrega al menos un producto o ítem de mercancía.");
      setCurrentStep("items");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/logistics/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          customerRuc: form.customerRuc || undefined,
          customerPhone: form.customerPhone || undefined,
          customerEmail: form.customerEmail || undefined,
          deliveryLocation: form.deliveryLocation || undefined,
          deliveryAddress: form.deliveryAddressText ? { text: form.deliveryAddressText } : undefined,
          notes: form.notes || undefined,
          priority: form.priority,
          purchaseOrderRef: form.purchaseOrderRef || undefined,
          carrierName: form.carrierName || undefined,
          driverName: form.driverName || undefined,
          driverIdDoc: form.driverIdDoc || undefined,
          driverLicense: form.driverLicense || undefined,
          vehiclePlate: form.vehiclePlate || undefined,
          insurancePolicy: form.insurancePolicy || undefined,
          shippingMode: form.shippingMode,
          incoterm: form.incoterm || undefined,
          controlledTemp: form.controlledTemp,
          hazardousMat: form.hazardousMat,
          shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : undefined,
          insuranceCost: form.insuranceCost ? parseFloat(form.insuranceCost) : undefined,
          emitInvoice: form.emitInvoice,
          items: items.map((i) => ({
            productId: i.productId || undefined,
            description: i.description,
            quantity: parseFloat(i.quantity) || 1,
            unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : undefined,
            taxRate: i.taxRate ? parseFloat(i.taxRate) : undefined,
            packaging: i.packaging,
            weightKg: i.weightKg ? parseFloat(i.weightKg) : undefined,
            dimensions: i.dimensions || undefined,
            category: i.category && i.category !== "GENERAL" ? i.category : undefined,
            sku: i.sku || undefined,
            barcode: i.barcode || undefined,
            umc: i.umc && i.umc !== "UND" ? i.umc : undefined,
            cpbsCode: i.cpbsCode || undefined,
            categoryMeta: Object.keys(i.categoryMeta ?? {}).length > 0 ? i.categoryMeta : undefined,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al crear la orden");
      }

      const data = await res.json();
      setCreatedOrder({ id: data.id, code: data.code, qrToken: data.qrToken });
      onSuccess(data);

      if (inventoryItemCount > 0) {
        toast.success(`${inventoryItemCount} ítem(s) descontados del inventario.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800/80 dark:text-white transition-all placeholder:text-gray-400";
  const labelCls = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5";

  // ─── Success state ───
  if (createdOrder) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800">
          <SuccessView order={createdOrder} onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
              <Package className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Nueva Orden de Entrega</h2>
              <p className="text-xs text-gray-500">Paso {currentStepIdx + 1} de {STEPS.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-slate-800/20">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = idx < currentStepIdx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    isActive
                      ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      : isCompleted
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <form id="create-delivery-order-form" onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-4">

          {/* ─── GENERAL ─── */}
          {currentStep === "general" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Prioridad</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    <option value="Baja">Baja</option>
                    <option value="Normal">Normal</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ref. Pedido (O/C)</label>
                  <input type="text" value={form.purchaseOrderRef} onChange={(e) => setForm({ ...form, purchaseOrderRef: e.target.value })} placeholder="Ej. PO-2026-001" className={inputCls} />
                </div>

                <div className="sm:col-span-2 pt-3">
                  <h3 className="text-xs uppercase font-bold text-rose-500 dark:text-rose-400 mb-3 flex items-center gap-2 tracking-wider">
                    <MapPin className="h-3.5 w-3.5" /> Datos del Destinatario
                  </h3>
                </div>

                {/* Combobox: buscar cliente/proveedor existente o crear nuevo */}
                <RecipientCombobox
                  value={{
                    customerName: form.customerName,
                    customerRuc: form.customerRuc,
                    customerPhone: form.customerPhone,
                    customerEmail: form.customerEmail,
                  }}
                  onChange={(data) =>
                    setForm((f) => ({
                      ...f,
                      customerName: data.customerName,
                      customerRuc: data.customerRuc,
                      customerPhone: data.customerPhone,
                      customerEmail: data.customerEmail,
                    }))
                  }
                  inputCls={inputCls}
                  labelCls={labelCls}
                />

                {/* Campos editables adicionales (siempre visibles para ajustar) */}
                <div>
                  <label className={labelCls}>RUC / Cédula</label>
                  <input type="text" value={form.customerRuc} onChange={(e) => setForm({ ...form, customerRuc: e.target.value })} placeholder="Ej. 8-888-888" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="6000-0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="cliente@email.com" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Región / Ubicación</label>
                  <input type="text" value={form.deliveryLocation} onChange={(e) => setForm({ ...form, deliveryLocation: e.target.value })} placeholder="Ej. Bella Vista, Ciudad de Panamá" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Dirección Exacta</label>
                  <input type="text" value={form.deliveryAddressText} onChange={(e) => setForm({ ...form, deliveryAddressText: e.target.value })} placeholder="Calle, edificio, piso, referencias..." className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ─── ITEMS ─── */}
          {currentStep === "items" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">

              {/* ── Mode toggle ── */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Agregar artículo</span>
                <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
                  {(["inventory", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setAddMode(m); setDraft({ ...EMPTY_ITEM }); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        addMode === m
                          ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      {m === "inventory" ? <Search className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      {m === "inventory" ? "Inventario" : "Libre"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Primary input ── */}
              {addMode === "inventory" ? (
                <ProductSearchInput
                  item={draft}
                  idx={-1}
                  onSelect={(_, product) => handleDraftProductSelect(product)}
                  onClear={handleDraftClearInventory}
                />
              ) : (
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => updateDraftField("description", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.description.trim()) {
                      e.preventDefault();
                      commitDraft();
                    }
                  }}
                  placeholder="Ej: Camisetas talla M, caja de zapatos, servicio..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800/80 dark:text-white"
                />
              )}

              {/* ── SKU / Barcode (always visible — ref. "Artículo" in remisión) ── */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Artículo / SKU
                  </label>
                  <input
                    type="text"
                    value={draft.sku}
                    onChange={(e) => updateDraftField("sku", e.target.value)}
                    placeholder="Ej: FIJI-M-10 (auto si vacío)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Código de barras
                  </label>
                  <input
                    type="text"
                    value={draft.barcode}
                    onChange={(e) => updateDraftField("barcode", e.target.value)}
                    placeholder="EAN-13 / UPC-A"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* ── Category selector ── */}
              <div className="space-y-2">
                {/* Collapsed: show only the selected category chip + "Cambiar" */}
                {draft.category && draft.category !== "GENERAL" ? (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cat = ITEM_CATEGORIES.find(c => c.value === draft.category)!;
                      const CatIcon = CATEGORY_ICONS[cat.value];
                      const colors = CATEGORY_COLORS[cat.value];
                      return (
                        <span className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border shadow-sm",
                          colors?.active ?? "bg-indigo-600 border-indigo-600 text-white"
                        )}>
                          {CatIcon && <CatIcon className="h-3.5 w-3.5" />} {cat.label}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, category: "GENERAL", categoryMeta: {} }))}
                      className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors underline underline-offset-2"
                    >
                      Cambiar categoría
                    </button>
                  </div>
                ) : (
                  /* Expanded: 2-col grid of colored category pills */
                  <div className="grid grid-cols-2 gap-2">
                    {ITEM_CATEGORIES.filter(c => c.value !== "GENERAL").map((cat) => {
                      const CatIcon = CATEGORY_ICONS[cat.value];
                      const colors = CATEGORY_COLORS[cat.value];
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, category: cat.value, categoryMeta: {} }))}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02]",
                            colors?.idle ?? "bg-gray-50 border-gray-200 text-gray-600"
                          )}
                        >
                          {CatIcon && <CatIcon className="h-4 w-4 flex-shrink-0" />}
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Dynamic fields — only when a specific category is selected */}
                {draft.category && draft.category !== "GENERAL" && (
                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/10 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <CategoryFields
                      category={draft.category}
                      meta={draft.categoryMeta}
                      onChange={updateDraftMeta}
                    />
                  </div>
                )}
              </div>

              {/* ── Qty + Packaging + Price + Add ── */}
              <div className="flex gap-2 items-end">
                <div className="w-20 flex-none">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Cantidad</label>
                  <input
                    type="number" min="0.01" step="any"
                    value={draft.quantity}
                    onChange={(e) => updateDraftField("quantity", e.target.value)}
                    className="w-full px-2 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Empaque</label>
                  <select
                    value={draft.packaging}
                    onChange={(e) => updateDraftField("packaging", e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  >
                    {["Unidad","Caja","Bolsa","Pallet","Servicio"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="w-24 flex-none">
                  <label className="block text-[11px] font-medium text-gray-400 mb-1">Precio unit.</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={draft.unitPrice}
                    onChange={(e) => updateDraftField("unitPrice", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={commitDraft}
                  disabled={!draft.fromInventory && !draft.description.trim()}
                  className="flex-none h-[38px] px-4 flex items-center gap-1.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Añadir
                </button>
              </div>

              {/* ── Physical details (collapsible) ── */}
              <button
                type="button"
                onClick={() => setShowPhysical(!showPhysical)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150", showPhysical && "rotate-90")} />
                Peso y dimensiones (opcional)
              </button>
              {showPhysical && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number" min="0" step="0.01"
                    value={draft.weightKg}
                    onChange={(e) => updateDraftField("weightKg", e.target.value)}
                    placeholder="Peso (kg)"
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={draft.dimensions}
                    onChange={(e) => updateDraftField("dimensions", e.target.value)}
                    placeholder="Dimensiones LxAxH"
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              {/* ── Over-stock warning ── */}
              {draft.fromInventory && draft.currentStock !== undefined && parseFloat(draft.quantity) > draft.currentStock && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Cantidad supera el stock disponible ({draft.currentStock})
                </div>
              )}

              {/* ── Items list ── */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs font-medium text-gray-400">
                      {items.length} ítem{items.length !== 1 ? "s" : ""} en la orden
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  </div>
                  {inventoryItemCount > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{inventoryItemCount} del inventario · Stock se descontará al crear.</span>
                    </div>
                  )}
                  {items.map((item, idx) => (
                    <ItemCard
                      key={idx}
                      item={item}
                      idx={idx}
                      onRemove={() => removeItem(idx)}
                      onUpdate={(field, value) => updateItem(idx, field, value)}
                      onMetaChange={(key, value) => updateItemMeta(idx, key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TRANSPORT ─── */}
          {currentStep === "transport" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <h3 className="text-xs uppercase font-bold text-rose-500 dark:text-rose-400 flex items-center gap-2 tracking-wider">
                <Truck className="h-3.5 w-3.5" /> Datos del Transporte
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { f: "carrierName", label: "Empresa / Transportista", ph: "Nombre empresa u operador" },
                  { f: "driverName", label: "Nombre Conductor", ph: "Nombre del despachador" },
                  { f: "vehiclePlate", label: "Placa / Vehículo", ph: "ID Vehículo o Placa" },
                  { f: "driverIdDoc", label: "Cédula del Conductor", ph: "Cédula/Pasaporte" },
                  { f: "driverLicense", label: "Licencia de Manejo", ph: "Tipo o Número" },
                  { f: "insurancePolicy", label: "Póliza Seguro", ph: "Número de seguro o fianza" },
                ].map(({ f, label, ph }) => (
                  <div key={f}>
                    <label className={labelCls}>{label}</label>
                    <input
                      type="text"
                      value={form[f as keyof typeof form] as string}
                      onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                      placeholder={ph}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── CONDITIONS ─── */}
          {currentStep === "conditions" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
              <h3 className="text-xs uppercase font-bold text-rose-500 dark:text-rose-400 flex items-center gap-2 tracking-wider">
                <AlertCircle className="h-3.5 w-3.5" /> Condiciones de Movilización
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Modo de Transporte</label>
                  <select value={form.shippingMode} onChange={(e) => setForm({ ...form, shippingMode: e.target.value })} className={inputCls}>
                    <option value="Terrestre">Terrestre</option>
                    <option value="Aéreo">Aéreo</option>
                    <option value="Marítimo">Marítimo</option>
                    <option value="Multimodal">Multimodal</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Incoterms® (Opcional)</label>
                  <input type="text" value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })} placeholder="Ej. DAP, CIF, FOB..." className={inputCls} />
                </div>

                <div className="sm:col-span-2 flex items-center gap-6 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.controlledTemp} onChange={(e) => setForm({ ...form, controlledTemp: e.target.checked })} className="rounded border-gray-300 text-rose-600 focus:ring-rose-500" />
                    <span className="text-gray-700 dark:text-gray-300">Temp. Controlada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.hazardousMat} onChange={(e) => setForm({ ...form, hazardousMat: e.target.checked })} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    <span className="text-red-600 font-medium">Mat. Peligrosos</span>
                  </label>
                </div>

                <div className="sm:col-span-2 pt-3">
                  <h3 className="text-xs uppercase font-bold text-rose-500 dark:text-rose-400 mb-3 flex items-center gap-2 tracking-wider">
                    <FileText className="h-3.5 w-3.5" /> Costos y Observaciones
                  </h3>
                </div>
                <div>
                  <label className={labelCls}>Costo Flete ($)</label>
                  <input type="number" step="0.01" min="0" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Costo Seguro ($)</label>
                  <input type="number" step="0.01" min="0" value={form.insuranceCost} onChange={(e) => setForm({ ...form, insuranceCost: e.target.value })} placeholder="0.00" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Observaciones / Instrucciones de entrega</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Instrucciones especiales para la manipulación y despacho..."
                    rows={3}
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-slate-800/30">
          <div className="flex-1">
            {inventoryItemCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {inventoryItemCount} ítem(s) del inventario
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button type="button" variant="outline" onClick={goBack} className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" /> Atrás
              </Button>
            )}
            {isFirstStep && (
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            )}
            {!isLastStep ? (
              <Button type="button" onClick={goNext} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="create-delivery-order-form"
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 text-white gap-2 min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" /> Crear Orden
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
