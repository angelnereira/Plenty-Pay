"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, X, Plus, CheckCircle2, Building2, User, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipient {
  id: string;
  name: string;
  ruc: string | null;
  dv: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: "customer" | "supplier";
}

interface RecipientComboboxProps {
  value: {
    customerName: string;
    customerRuc: string;
    customerPhone: string;
    customerEmail: string;
  };
  onChange: (data: {
    customerName: string;
    customerRuc: string;
    customerPhone: string;
    customerEmail: string;
  }) => void;
  inputCls: string;
  labelCls: string;
}

export function RecipientCombobox({ value, onChange, inputCls, labelCls }: RecipientComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
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
      const res = await fetch(`/api/logistics/customers/search?q=${encodeURIComponent(q)}`);
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
    timerRef.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(r: Recipient) {
    setSelected(r);
    setOpen(false);
    setQuery("");
    onChange({
      customerName: r.name,
      customerRuc: r.ruc || "",
      customerPhone: r.phone || "",
      customerEmail: r.email || "",
    });
  }

  function handleClear() {
    setSelected(null);
    onChange({ customerName: "", customerRuc: "", customerPhone: "", customerEmail: "" });
  }

  function handleUseManualName() {
    // User wants to type a new name that doesn't exist in the system
    setOpen(false);
    onChange({ ...value, customerName: query });
    setQuery("");
  }

  // If a recipient is selected, show a card
  if (selected) {
    return (
      <div className="sm:col-span-2">
        <label className={labelCls}>Destinatario <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{selected.name}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              {selected.type === "customer" ? (
                <><User className="h-3 w-3" /> Cliente</>
              ) : (
                <><Building2 className="h-3 w-3" /> Proveedor</>
              )}
              {selected.ruc && <span>· RUC: {selected.ruc}</span>}
              {selected.phone && <span>· {selected.phone}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
            title="Cambiar destinatario"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div className="sm:col-span-2" ref={containerRef}>
        <label className={labelCls}>Destinatario <span className="text-red-500">*</span></label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query || value.customerName}
            onChange={(e) => {
              handleQueryChange(e.target.value);
              onChange({ ...value, customerName: e.target.value });
            }}
            onFocus={() => { if (query.length > 0 || value.customerName.length > 0) search(query || value.customerName); }}
            placeholder="Buscar cliente o proveedor existente, o escribir nuevo..."
            className={cn(inputCls, "pl-10")}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="relative z-50">
            <div className="absolute mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-64 overflow-y-auto scrollbar-hide">
              {results.length > 0 && results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {r.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        {r.type === "customer" ? (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <User className="h-3 w-3" /> Cliente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-violet-600">
                            <Building2 className="h-3 w-3" /> Proveedor
                          </span>
                        )}
                        {r.ruc && <span>RUC: {r.ruc}</span>}
                      </div>
                    </div>
                    {r.phone && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{r.phone}</span>
                    )}
                  </div>
                </button>
              ))}

              {/* Manual entry option */}
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={handleUseManualName}
                  className="w-full text-left px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      Usar <strong>&quot;{query}&quot;</strong> como nombre
                    </span>
                  </div>
                </button>
              )}

              {/* Quick create option */}
              <button
                type="button"
                onClick={() => { setOpen(false); setShowQuickCreate(true); }}
                className="w-full text-left px-4 py-3 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors bg-gray-50 dark:bg-slate-700/30"
              >
                <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 font-medium">
                  <Plus className="h-4 w-4" />
                  Crear nuevo contacto
                </div>
              </button>

              {results.length === 0 && !searching && query.length > 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No se encontraron contactos. Escribe el nombre o crea uno nuevo.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Create Inline Form */}
      {showQuickCreate && (
        <QuickCreateRecipient
          initialName={query || value.customerName}
          onCreated={(data) => {
            setShowQuickCreate(false);
            onChange({
              customerName: data.name,
              customerRuc: data.ruc || "",
              customerPhone: data.phone || "",
              customerEmail: data.email || "",
            });
            setSelected({
              id: "new",
              name: data.name,
              ruc: data.ruc || null,
              dv: null,
              email: data.email || null,
              phone: data.phone || null,
              address: null,
              type: "customer",
            });
          }}
          onCancel={() => setShowQuickCreate(false)}
          inputCls={inputCls}
          labelCls={labelCls}
        />
      )}
    </>
  );
}

// ─── Quick Create Inline Form ────────────────────────────────────────────────

function QuickCreateRecipient({
  initialName,
  onCreated,
  onCancel,
  inputCls,
  labelCls,
}: {
  initialName: string;
  onCreated: (data: { name: string; ruc?: string; phone?: string; email?: string }) => void;
  onCancel: () => void;
  inputCls: string;
  labelCls: string;
}) {
  const [form, setForm] = useState({
    name: initialName,
    ruc: "",
    phone: "",
    email: "",
  });

  return (
    <div className="sm:col-span-2 bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nuevo Contacto
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre completo"
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>RUC / Cédula</label>
          <input
            type="text"
            value={form.ruc}
            onChange={(e) => setForm({ ...form, ruc: e.target.value })}
            placeholder="8-888-888"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="6000-0000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@ejemplo.com"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            if (!form.name.trim()) return;
            onCreated(form);
          }}
          disabled={!form.name.trim()}
          className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Usar este contacto
        </button>
      </div>
    </div>
  );
}
