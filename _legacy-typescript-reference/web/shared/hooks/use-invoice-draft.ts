/**
 * useInvoiceDraft Hook
 *
 * Persiste el borrador de una factura en curso en localStorage.
 * Se activa cuando el modal de creación de documentos está abierto.
 *
 * Ciclo de vida:
 *  - Al abrir el modal → restaurar borrador (si existe)
 *  - Cada vez que cambien clientData o items → guardar borrador
 *  - Al emitir con éxito o al descartar confirmando → borrar borrador
 *
 * La clave en localStorage incluye el prefijo 'plentypay_inv_draft_'
 * para evitar colisiones con otros módulos.
 *
 * @module hooks/use-invoice-draft
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ClientData, PaymentData, ImportData, CompraData } from './use-document-form';
import type { AddItemInput } from './use-invoice-items';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceDraftPayload {
    clientData: Partial<ClientData>;
    items: AddItemInput[];
    paymentData: Partial<PaymentData>;
    importData?: Partial<ImportData>;
    compraData?: Partial<CompraData>;
    savedAt: string; // ISO timestamp
}

interface UseInvoiceDraftOptions {
    /** Unique key suffix (e.g. companyId or userId). Keeps tenants isolated. */
    draftKey: string;
    /** Whether the modal/wizard is currently open */
    isOpen: boolean;
    /** Current client data to persist */
    clientData: Partial<ClientData>;
    /** Current items to persist */
    items: AddItemInput[];
    /** Current payment data to persist */
    paymentData: Partial<PaymentData>;
    /** Called with the restored draft so the parent can hydrate state */
    onRestore: (draft: InvoiceDraftPayload) => void;
}

const DRAFT_KEY_PREFIX = 'plentypay_inv_draft_';
const DEBOUNCE_MS = 800;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildKey(suffix: string): string {
    return `${DRAFT_KEY_PREFIX}${suffix}`;
}

function hasMeaningfulData(clientData: Partial<ClientData>, items: AddItemInput[]): boolean {
    const hasClient = !!(clientData.razonSocial?.trim() || clientData.numeroRUC?.trim());
    const hasItems = items.length > 0;
    return hasClient || hasItems;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInvoiceDraft({
    draftKey,
    isOpen,
    clientData,
    items,
    paymentData,
    onRestore,
}: UseInvoiceDraftOptions) {
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRestoredRef = useRef(false);
    const storageKey = buildKey(draftKey);

    // ── Restore on open ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) {
            hasRestoredRef.current = false;
            return;
        }
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            const draft: InvoiceDraftPayload = JSON.parse(raw);
            if (
                draft &&
                typeof draft === 'object' &&
                hasMeaningfulData(draft.clientData, draft.items)
            ) {
                onRestore(draft);
            }
        } catch {
            // Corrupted draft — ignore silently
            localStorage.removeItem(storageKey);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, storageKey]);

    // ── Auto-save with debounce ───────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;

        if (saveTimer.current) clearTimeout(saveTimer.current);

        saveTimer.current = setTimeout(() => {
            if (!hasMeaningfulData(clientData, items)) return;
            try {
                const payload: InvoiceDraftPayload = {
                    clientData,
                    items,
                    paymentData,
                    savedAt: new Date().toISOString(),
                };
                localStorage.setItem(storageKey, JSON.stringify(payload));
            } catch {
                // Storage quota exceeded or private mode — fail silently
            }
        }, DEBOUNCE_MS);

        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [isOpen, clientData, items, paymentData, storageKey]);

    // ── Public API ────────────────────────────────────────────────────────────

    /** Call this when the user emits successfully or confirms discard */
    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // ignore
        }
    }, [storageKey]);

    /** Returns true if a saved draft exists */
    const hasDraft = useCallback((): boolean => {
        try {
            return !!localStorage.getItem(storageKey);
        } catch {
            return false;
        }
    }, [storageKey]);

    return { clearDraft, hasDraft };
}
