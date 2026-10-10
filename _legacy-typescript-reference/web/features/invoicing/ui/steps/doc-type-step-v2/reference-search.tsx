'use client';

import { Input } from '@shared/ui/input';
import { Textarea } from '@shared/ui/textarea';
import {
    Search, Loader2, X, CheckCircle2, Receipt,
    FileMinus, FilePlus, FileCheck, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteSubtype, ReferencedInvoice } from '@/shared/hooks/use-document-form';

interface ReferenceSearchProps {
    documentMode: 'NOTA_CREDITO' | 'NOTA_DEBITO';
    docLabel: string;
    noteSubtype: NoteSubtype;
    onNoteSubtypeChange: (subtype: NoteSubtype) => void;
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    searchResults: ReferencedInvoice[];
    isSearching: boolean;
    selectedInvoice: ReferencedInvoice | null;
    onSelectInvoice: (invoice: ReferencedInvoice) => void;
    onFetchReferencedItems: (invoice: ReferencedInvoice) => void;
    noteMotivo: string;
    onNoteMotivoChange: (motivo: string) => void;
}

export function ReferenceSearch({
    documentMode,
    docLabel,
    noteSubtype,
    onNoteSubtypeChange,
    searchQuery,
    onSearchQueryChange,
    searchResults,
    isSearching,
    selectedInvoice,
    onSelectInvoice,
    onFetchReferencedItems,
    noteMotivo,
    onNoteMotivoChange,
}: ReferenceSearchProps) {
    const isNC = documentMode === 'NOTA_CREDITO';
    const NoteIcon = isNC ? FileMinus : FilePlus;

    return (
        <div className="space-y-4">
            {/* Subtype Selection */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">Subtipo de {docLabel}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => onNoteSubtypeChange('REFERENCED')}
                    className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        noteSubtype === 'REFERENCED'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/60'
                            : 'border-gray-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600'
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <NoteIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {isNC ? 'NC Referenciada (04)' : 'ND Referenciada (05)'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isNC
                            ? 'Ajusta o anula una factura emitida específica. Requiere CUFE original.'
                            : 'Cargo adicional vinculado a una factura emitida específica.'
                        }
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => onNoteSubtypeChange('GENERIC')}
                    className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        noteSubtype === 'GENERIC'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/60'
                            : 'border-gray-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600'
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <NoteIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {isNC ? 'NC Genérica (06)' : 'ND Genérica (07)'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isNC
                            ? 'Nota de crédito sin referencia a documento específico (descuentos, devoluciones generales).'
                            : 'Nota de débito sin referencia a documento específico (cargos generales).'
                        }
                    </p>
                </button>
            </div>

            {/* Invoice search — only for REFERENCED subtype */}
            {noteSubtype === 'REFERENCED' && (
                <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                        <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-medium text-gray-900 dark:text-white">Factura Original</h3>
                    </div>

                    {selectedInvoice ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                                            {selectedInvoice.folio || selectedInvoice.invoiceNumber}
                                        </span>
                                    </div>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                        {selectedInvoice.clientName} — ${selectedInvoice.total.toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                                        CUFE: {selectedInvoice.cufe?.substring(0, 20)}...
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSearchQueryChange('')}
                                    className="text-emerald-600 dark:text-emerald-400 hover:text-red-500 p-1"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => onSearchQueryChange(e.target.value)}
                                    placeholder="Buscar por folio, RUC, nombre del cliente, CUFE..."
                                    className="pl-10 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-500" />
                                )}
                            </div>

                            {searchResults.length > 0 && (
                                <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto scrollbar-hide">
                                    {searchResults.map((inv) => (
                                        <button
                                            key={inv.id}
                                            type="button"
                                            onClick={() => {
                                                onSelectInvoice(inv);
                                                onSearchQueryChange('');
                                                onFetchReferencedItems(inv);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-b-0 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                                                        {inv.folio || inv.invoiceNumber}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                                        {inv.clientName}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                                                    ${inv.total.toFixed(2)}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                                {inv.emittedAt ? new Date(inv.emittedAt).toLocaleDateString() : ''} — CUFE: {inv.cufe?.substring(0, 25)}...
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {searchQuery.length > 2 && !isSearching && searchResults.length === 0 && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                                    No se encontraron facturas emitidas con ese criterio.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Motivo */}
            <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Motivo</h3>
                </div>
                <Textarea
                    value={noteMotivo}
                    onChange={(e) => onNoteMotivoChange(e.target.value)}
                    placeholder={isNC
                        ? 'Motivo de la nota de crédito (ej: devolución de mercancía, descuento post-venta...)'
                        : 'Motivo de la nota de débito (ej: cargo adicional, intereses moratorios...)'
                    }
                    className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 min-h-[80px]"
                />
                <p className="text-[10px] text-gray-400">Mínimo 5 caracteres. Este motivo aparecerá en el documento fiscal.</p>
            </div>
        </div>
    );
}
