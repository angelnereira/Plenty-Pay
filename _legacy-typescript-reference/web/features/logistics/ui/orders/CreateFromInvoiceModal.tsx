"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X, FileText, Search, ChevronRight, CheckCircle2,
  User, Phone, Mail, MapPin, Package, AlertCircle,
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceResult {
  id: string;
  invoiceNumber: string | null;
  numeroDocumentoFiscal: string | null;
  clientReferenceId: string;
  receiverName: string;
  receiverRuc: string | null;
  receiverPhone: string | null;
  receiverEmail: string | null;
  receiverAddress: string | null;
  total: string | null;
  createdAt: string;
  status: string;
  itemCount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: { id: string; code: string }) => void;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  EMITTED: { label: "Emitida", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  INTERNAL: { label: "Interna", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  CERTIFIED: { label: "Certificada", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateFromInvoiceModal({ isOpen, onClose, onSuccess }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<InvoiceResult | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setDeliveryAddress("");
      setNotes("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/logistics/invoices/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    setSelected(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  }

  function handleFocus() {
    if (results.length === 0) search("");
  }

  function handleSelect(inv: InvoiceResult) {
    setSelected(inv);
    setQuery(
      inv.invoiceNumber
        ? `${inv.invoiceNumber} — ${inv.receiverName}`
        : inv.clientReferenceId
    );
    setDeliveryAddress(inv.receiverAddress ?? "");
    setResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Selecciona una factura primero.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/logistics/orders/from-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selected.id,
          deliveryAddress: deliveryAddress ? { text: deliveryAddress } : undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al crear la orden");
      }

      const data = await res.json();
      toast.success("Orden de entrega creada desde factura.");
      onSuccess(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white";
  const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-gray-200 dark:border-gray-800">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">OE desde Factura</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">El inventario no se descuenta (ya fue descontado al emitir)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form id="from-invoice-form" onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-4">

          {/* ── Invoice Search ── */}
          <div>
            <label className={labelCls}>
              Buscar Factura <span className="text-red-500">*</span>
            </label>
            <p className="text-[11px] text-gray-400 mb-2">Por número de factura, número fiscal, nombre o RUC del receptor</p>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={handleFocus}
                placeholder="Ej. 001-0000-01-1234 o nombre del cliente..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Dropdown results */}
            {results.length > 0 && !selected && (
              <div className="mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-64 overflow-y-auto scrollbar-hide">
                {results.map((inv) => {
                  const badge = STATUS_LABELS[inv.status];
                  const displayNum = inv.invoiceNumber ?? inv.numeroDocumentoFiscal ?? inv.clientReferenceId;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleSelect(inv)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayNum}</span>
                          {badge && (
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", badge.cls)}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{inv.receiverName}</div>
                        {inv.receiverRuc && <div className="text-[11px] text-gray-400">RUC: {inv.receiverRuc}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          ${Number(inv.total ?? 0).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-gray-400">{inv.itemCount} ítem(s)</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!searching && results.length === 0 && query.length > 2 && !selected && (
              <div className="mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-400" />
                No se encontraron facturas emitidas con ese criterio.
              </div>
            )}
          </div>

          {/* ── Selected Invoice Preview ── */}
          {selected && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {selected.invoiceNumber ?? selected.numeroDocumentoFiscal ?? selected.clientReferenceId}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 ml-6 mt-0.5">
                    Factura seleccionada · {selected.itemCount} ítem(s) · Total ${Number(selected.total ?? 0).toFixed(2)}
                  </p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setQuery(""); }} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors" title="Cambiar factura">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Receptor info */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200 dark:border-indigo-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 col-span-2">
                  <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span className="font-semibold">{selected.receiverName}</span>
                  {selected.receiverRuc && <span className="text-gray-400">· {selected.receiverRuc}</span>}
                </div>
                {selected.receiverPhone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone className="h-3 w-3 flex-shrink-0" /> {selected.receiverPhone}
                  </div>
                )}
                {selected.receiverEmail && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="h-3 w-3 flex-shrink-0" /> {selected.receiverEmail}
                  </div>
                )}
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <Package className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Los productos de esta factura se copiarán automáticamente a la orden. El inventario <strong>no se modificará</strong> (ya fue descontado al emitir la factura).</span>
              </div>
            </div>
          )}

          {/* ── Optional delivery address ── */}
          {selected && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Dirección de Entrega <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Si es diferente a la de la factura..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Instrucciones / Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales de entrega..."
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/50">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            type="submit"
            form="from-invoice-form"
            disabled={loading || !selected}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            {loading ? "Creando..." : (
              <>
                Crear Orden <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
