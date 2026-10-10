/**
 * useInvoiceEmission Hook
 *
 * Handles the invoice emission flow with proper state management
 * and error handling.
 *
 * Provides three emission strategies:
 *  - emit(documento)       – legacy path: calls emitFullInvoice directly
 *  - emitFromDraft(data)   – Factura path: saveDraft → emitInvoice (orchestrator)
 *  - emitNote(payload)     – NC/ND path: POST /api/invoices/credit-note|debit-note → emitInvoice
 *
 * @module hooks/use-invoice-emission
 */

'use client';

import { useState, useCallback } from 'react';
import { emitFullInvoice } from '@/app/actions/invoice/emit-full-invoice.action';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';
import type { ManualInvoiceData } from '@/lib/mappers/manual-invoice-to-hka';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';

// ============================================
// TYPES
// ============================================

export interface EmissionState {
    isEmitting: boolean;
    error: string | null;
    result: EmissionResult | null;
    showResultModal: boolean;
}

export interface EmissionResult {
    success: boolean;
    invoiceId?: string;
    cufe?: string;
    qr?: string;
    protocolo?: string;
    numeroDocumentoFiscal?: string;
    fechaEmision?: string;
    error?: string;
    diagnosis?: { message: string; action: string; severity: string };
}

export interface NoteEmissionPayload {
    noteType: 'NOTA_CREDITO' | 'NOTA_DEBITO';
    noteSubtype: 'REFERENCED' | 'GENERIC';
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        discount: number;
    }>;
    reason: string;
    paymentMethod: string;
    originalInvoiceId?: string;
    receiver?: {
        name: string;
        ruc?: string;
        dv?: string;
        type: string;
    };
}

export interface UseInvoiceEmissionReturn {
    state: EmissionState;
    /** Legacy path: emit a pre-built DocumentoElectronico directly via emitFullInvoice */
    emit: (documento: DocumentoElectronico) => Promise<EmissionResult>;
    /** Factura path: build HKA document from form data, save draft, then emit */
    emitFromDraft: (data: ManualInvoiceData, config: InvoiceConfig) => Promise<EmissionResult>;
    /** NC/ND path: create note via API, then emit via orchestrator */
    emitNote: (payload: NoteEmissionPayload) => Promise<EmissionResult>;
    reset: () => void;
    closeResultModal: () => void;
}

// ============================================
// HELPERS
// ============================================

const PAYMENT_METHOD_MAP: Record<string, string> = {
    '01': 'CREDIT',
    '02': 'CASH',
    '03': 'CREDIT_CARD',
    '04': 'DEBIT_CARD',
    '08': 'TRANSFER',
    '09': 'CHECK',
    '99': 'OTHER',
};

/** Deep-removes undefined/$undefined values from an object before sending to server actions */
function sanitizeForTransport(obj: unknown): unknown {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') {
        if (obj === '$undefined') return undefined;
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForTransport).filter(v => v !== undefined);
    }
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const sanitized = sanitizeForTransport(value);
        if (sanitized !== undefined && sanitized !== '' && sanitized !== '$undefined') {
            cleaned[key] = sanitized;
        }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Calls the orchestrator (emitInvoice) for a given invoiceId and normalizes the result */
async function runOrchestrator(invoiceId: string): Promise<EmissionResult> {
    const { emitInvoice } = await import('@/app/actions/invoice/emit-invoice.action');
    const result = await emitInvoice({ invoiceId });

    if (!result.success) {
        const errorMessage = typeof result.error === 'string'
            ? result.error
            : (result.error && typeof result.error === 'object' && 'message' in result.error
                ? String((result.error as { message: unknown }).message)
                : JSON.stringify(result.error));
        return {
            success: false,
            invoiceId,
            error: errorMessage,
            diagnosis: result.diagnosis,
        };
    }

    return {
        success: true,
        invoiceId,
        cufe: result.data?.cufe,
        qr: result.data?.qrUrl,
        protocolo: result.data?.nroProtocoloAutorizacion,
        numeroDocumentoFiscal: result.data?.numeroDocumentoFiscal,
        fechaEmision: result.data?.fechaRecepcionDGI,
    };
}

// ============================================
// HOOK
// ============================================

export function useInvoiceEmission(): UseInvoiceEmissionReturn {
    const [state, setState] = useState<EmissionState>({
        isEmitting: false,
        error: null,
        result: null,
        showResultModal: false,
    });

    const setEmitting = (on: boolean) =>
        setState(prev => ({ ...prev, isEmitting: on }));

    const setResult = (result: EmissionResult) =>
        setState(prev => ({
            ...prev,
            isEmitting: false,
            result,
            showResultModal: true,
            error: result.success ? null : result.error || 'Error al emitir',
        }));

    // ─── LEGACY: emit a pre-built DocumentoElectronico ────────────────────────
    const emit = useCallback(async (documento: DocumentoElectronico): Promise<EmissionResult> => {
        setEmitting(true);
        try {
            const response = await emitFullInvoice(documento);
            const envio = response.success
                ? (response as {
                    success: true;
                    data: {
                        envio: {
                            cufe?: string; qr?: string;
                            nroProtocoloAutorizacion?: string;
                            numeroDocumentoFiscal?: string;
                            fechaRecepcionDGI?: string;
                        };
                    };
                }).data?.envio
                : undefined;

            const result: EmissionResult = {
                success: response.success,
                cufe: envio?.cufe,
                qr: envio?.qr,
                protocolo: envio?.nroProtocoloAutorizacion,
                numeroDocumentoFiscal: envio?.numeroDocumentoFiscal,
                fechaEmision: envio?.fechaRecepcionDGI,
                error: response.error,
            };
            setResult(result);
            return result;
        } catch (error) {
            const result: EmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Error inesperado',
            };
            setResult(result);
            return result;
        }
    }, []);

    // ─── FACTURA PATH: build from form data, save draft, emit ─────────────────
    const emitFromDraft = useCallback(async (
        data: ManualInvoiceData,
        config: InvoiceConfig,
    ): Promise<EmissionResult> => {
        setEmitting(true);
        try {
            const { mapManualInvoiceToHKARequest } = await import('@/lib/mappers/manual-invoice-to-hka');
            let hkaRequest;
            try {
                hkaRequest = mapManualInvoiceToHKARequest(data, config);
            } catch (mappingError) {
                const result: EmissionResult = {
                    success: false,
                    error: `Error al preparar factura: ${mappingError instanceof Error ? mappingError.message : 'Error desconocido'}`,
                };
                setResult(result);
                return result;
            }

            const cleanedRequest = sanitizeForTransport(hkaRequest);
            const { saveDraft } = await import('@/app/actions/invoice/draft.action');
            const draftResult = await saveDraft({
                name: `Emisión Manual ${new Date().toLocaleString()}`,
                data: cleanedRequest as DocumentoElectronico,
            });

            if (!draftResult.success || !draftResult.data?.id) {
                const result: EmissionResult = {
                    success: false,
                    error: draftResult.error || 'Error al preparar la factura para emisión',
                };
                setResult(result);
                return result;
            }

            const result = await runOrchestrator(draftResult.data.id);
            setResult(result);
            return result;
        } catch (error) {
            const result: EmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Error inesperado',
            };
            setResult(result);
            return result;
        }
    }, []);

    // ─── NC/ND PATH: create note via API, then emit ────────────────────────────
    const emitNote = useCallback(async (payload: NoteEmissionPayload): Promise<EmissionResult> => {
        setEmitting(true);
        try {
            const endpoint = payload.noteType === 'NOTA_CREDITO'
                ? '/api/invoices/credit-note'
                : '/api/invoices/debit-note';

            const body: Record<string, unknown> = {
                noteSubtype: payload.noteSubtype,
                items: payload.items,
                reason: payload.reason,
                paymentMethod: PAYMENT_METHOD_MAP[payload.paymentMethod] || 'CASH',
            };

            if (payload.noteSubtype === 'REFERENCED' && payload.originalInvoiceId) {
                body.originalInvoiceId = payload.originalInvoiceId;
            }
            if (payload.noteSubtype === 'GENERIC' && payload.receiver) {
                body.receiver = payload.receiver;
            }

            const createRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const createData = await createRes.json();

            if (!createRes.ok || !createData.success) {
                const result: EmissionResult = {
                    success: false,
                    error: createData.error || `Error al crear ${payload.noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}`,
                };
                setResult(result);
                return result;
            }

            const result = await runOrchestrator(createData.data.id);
            setResult(result);
            return result;
        } catch (error) {
            const result: EmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Error inesperado',
            };
            setResult(result);
            return result;
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            isEmitting: false,
            error: null,
            result: null,
            showResultModal: false,
        });
    }, []);

    const closeResultModal = useCallback(() => {
        setState(prev => ({ ...prev, showResultModal: false }));
    }, []);

    return { state, emit, emitFromDraft, emitNote, reset, closeResultModal };
}
