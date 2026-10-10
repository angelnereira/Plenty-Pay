'use client';

/**
 * MotorEntityCombobox
 *
 * Combobox de búsqueda universal de entidades del Motor.
 * Muestra resultados en tiempo real (debounced) y clientes recientes
 * cuando el campo está vacío (si preloadRecent=true).
 *
 * Uso mínimo:
 *   <MotorEntityCombobox onSelect={entity => prefillClient(entity)} />
 */

import { useRef, useState, useEffect } from 'react';
import { Search, X, Loader2, Clock, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotorSearch, type MotorEntitySummary } from '@/shared/hooks/use-motor-search';
import type { MotorEntityKind } from '@prisma/client';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MotorEntityComboboxProps {
    /** Callback cuando se selecciona una entidad */
    onSelect: (entity: MotorEntitySummary) => void;
    /** Texto placeholder del input */
    placeholder?: string;
    /** Filtrar por tipo de entidad */
    kind?: MotorEntityKind;
    /** Cargar recientes al abrir */
    preloadRecent?: boolean;
    /** Clases extra para el contenedor */
    className?: string;
    /** Desactivar el input */
    disabled?: boolean;
    /** Valor inicial mostrado (nombre de entidad ya seleccionada) */
    initialLabel?: string;
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: MotorEntityKind }) {
    if (kind === "COMPANY") return <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    return <User className="h-3.5 w-3.5 text-violet-400 shrink-0" />;
}

function KindBadge({ kind }: { kind: MotorEntityKind }) {
    const labels: Record<MotorEntityKind, string> = {
        PERSON: "Persona",
        COMPANY: "Empresa",
    };
    const colors: Record<MotorEntityKind, string> = {
        PERSON: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
        COMPANY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    };
    return (
        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', colors[kind])}>
            {labels[kind] ?? kind}
        </span>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MotorEntityCombobox({
    onSelect,
    placeholder = 'Buscar cliente, RUC o email…',
    kind,
    preloadRecent = true,
    className,
    disabled = false,
    initialLabel = '',
}: MotorEntityComboboxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState(initialLabel);

    const { query, setQuery, results, isLoading, recentEntities, clearResults } = useMotorSearch({
        kind,
        preloadRecent,
        limit: 10,
    });

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (entity: MotorEntitySummary) => {
        setSelectedLabel(entity.displayName);
        setOpen(false);
        clearResults();
        onSelect(entity);
    };

    const handleClear = () => {
        setSelectedLabel('');
        clearResults();
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const showResults = open && (results.length > 0 || (query.trim().length === 0 && recentEntities.length > 0));
    const showEmpty = open && query.trim().length >= 2 && !isLoading && results.length === 0;

    const displayList = query.trim().length >= 2 ? results : recentEntities;
    const sectionLabel = query.trim().length >= 2 ? null : 'Recientes';

    return (
        <div ref={containerRef} className={cn('relative w-full', className)}>
            {/* Input */}
            <div className={cn(
                'flex items-center gap-2 h-11 px-3 rounded-lg border transition-colors bg-white dark:bg-slate-900',
                open
                    ? 'border-violet-500 ring-1 ring-violet-500'
                    : 'border-gray-200 dark:border-slate-800',
                disabled && 'opacity-50 cursor-not-allowed'
            )}>
                {isLoading
                    ? <Loader2 className="h-4 w-4 text-violet-500 animate-spin shrink-0" />
                    : <Search className="h-4 w-4 text-gray-400 shrink-0" />
                }

                {selectedLabel && !open ? (
                    // Mostrar label de selección
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                        {selectedLabel}
                    </span>
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        disabled={disabled}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedLabel('');
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                    />
                )}

                {(selectedLabel || query) && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {(showResults || showEmpty) && (
                <div className={cn(
                    'absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700',
                    'rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150'
                )}>
                    {sectionLabel && displayList.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-slate-800">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {sectionLabel}
                            </span>
                        </div>
                    )}

                    <ul className="max-h-64 overflow-y-auto py-1">
                        {displayList.map((entity) => (
                            <li key={entity.id}>
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors group"
                                    onClick={() => handleSelect(entity)}
                                >
                                    <KindIcon kind={entity.kind} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                            {entity.displayName}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {entity.documentNumber && (
                                                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                                    {entity.documentType ? `${entity.documentType}: ` : ''}{entity.documentNumber}
                                                </span>
                                            )}
                                            {entity.primaryEmail && (
                                                <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                                                    {entity.primaryEmail}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <KindBadge kind={entity.kind} />
                                </button>
                            </li>
                        ))}
                    </ul>

                    {showEmpty && (
                        <div className="px-3 py-4 text-center">
                            <p className="text-sm text-gray-500">No se encontraron entidades</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Prueba con otro nombre, RUC o email
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
