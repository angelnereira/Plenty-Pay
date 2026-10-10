'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DocumentMode } from '@/shared/hooks/use-document-form';
import type { IncotermCode } from '@/lib/constants/incoterms';

// ============================================
// TYPES
// ============================================

export interface InvoicePreferences {
    documentMode?: DocumentMode;
    formaPagoFact?: string;
    incoterm?: IncotermCode;
    moneda?: string;
}

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_PREFIX = 'plentypay_inv_prefs_';

function readFromStorage(clientId: string): InvoicePreferences {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${clientId}`);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeToStorage(clientId: string, prefs: InvoicePreferences): void {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${clientId}`, JSON.stringify(prefs));
    } catch {
        // localStorage no disponible (SSR, private mode, etc.)
    }
}

// ============================================
// HOOK
// ============================================

export function useInvoicePreferences(clientId: string | null) {
    const [prefs, setPrefs] = useState<InvoicePreferences>({});

    // Cargar prefs cuando cambia clientId
    useEffect(() => {
        if (!clientId) {
            setPrefs({});
            return;
        }
        setPrefs(readFromStorage(clientId));
    }, [clientId]);

    const setPref = useCallback(
        <K extends keyof InvoicePreferences>(key: K, value: InvoicePreferences[K]) => {
            if (!clientId) return;
            setPrefs((prev) => {
                const next = { ...prev, [key]: value };
                writeToStorage(clientId, next);
                return next;
            });
        },
        [clientId],
    );

    const clear = useCallback(() => {
        if (!clientId) return;
        try {
            localStorage.removeItem(`${STORAGE_PREFIX}${clientId}`);
        } catch {
            // ignore
        }
        setPrefs({});
    }, [clientId]);

    return { prefs, setPref, clear };
}
