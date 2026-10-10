'use client';

/**
 * useMotorSearch
 *
 * Hook compartido que envuelve searchEntities / findEntityByDocument del Motor.
 * Disponible para cualquier usuario con sesión válida (no requiere acceso de panel).
 *
 * Uso en facturación: autocompletado de receptor con pre-fill.
 * Uso en POS:        selector de cliente rápido / clientes recientes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './use-debounce';
import {
    searchEntities,
    findEntityByDocument,
    getRecentEntities,
    type MotorEntitySummary,
} from '@/actions/motor/search';
import type { MotorEntityKind } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type { MotorEntitySummary };

export interface UseMotorSearchOptions {
    /** Filtrar por tipo de entidad (PERSON, COMPANY) */
    kind?: MotorEntityKind;
    /** Debounce en ms para la búsqueda libre. Default: 350 */
    debounceMs?: number;
    /** Número máximo de resultados. Default: 10 */
    limit?: number;
    /** Carga entidades recientes al montar el componente */
    preloadRecent?: boolean;
}

export interface UseMotorSearchReturn {
    query: string;
    setQuery: (q: string) => void;
    results: MotorEntitySummary[];
    isLoading: boolean;
    recentEntities: MotorEntitySummary[];
    /** Busca una entidad exacta por número de documento */
    lookupByDocument: (documentNumber: string) => Promise<MotorEntitySummary | null>;
    clearResults: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMotorSearch(options: UseMotorSearchOptions = {}): UseMotorSearchReturn {
    const {
        kind,
        debounceMs = 350,
        limit = 10,
        preloadRecent = false,
    } = options;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MotorEntitySummary[]>([]);
    const [recentEntities, setRecentEntities] = useState<MotorEntitySummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const debouncedQuery = useDebounce(query, debounceMs);

    // ── Búsqueda por texto libre ──────────────────────────────────────────────
    useEffect(() => {
        if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
            setResults([]);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        searchEntities({ q: debouncedQuery, kind, limit })
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.data) {
                    setResults(res.data);
                } else {
                    setResults([]);
                }
            })
            .catch(() => {
                if (!cancelled) setResults([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [debouncedQuery, kind, limit]);

    // ── Precarga de recientes ─────────────────────────────────────────────────
    useEffect(() => {
        if (!preloadRecent) return;
        getRecentEntities({ kind, limit: 8 })
            .then((res) => {
                if (res.success && res.data) setRecentEntities(res.data);
            })
            .catch(() => { /* silencioso */ });
    }, [kind, preloadRecent]);

    // ── Lookup exacto por documento ───────────────────────────────────────────
    const lookupByDocument = useCallback(async (documentNumber: string): Promise<MotorEntitySummary | null> => {
        if (!documentNumber.trim()) return null;
        try {
            const res = await findEntityByDocument({ documentNumber: documentNumber.trim() });
            return res.success ? res.data ?? null : null;
        } catch {
            return null;
        }
    }, []);

    const clearResults = useCallback(() => {
        setQuery('');
        setResults([]);
    }, []);

    return {
        query,
        setQuery,
        results,
        isLoading,
        recentEntities,
        lookupByDocument,
        clearResults,
    };
}
