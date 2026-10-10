/**
 * useRUCValidation Hook
 * 
 * Handles RUC validation via HKA with debouncing and caching.
 * Provides a clean interface for validating RUC numbers and
 * retrieving DV (dígito verificador).
 * 
 * @module hooks/use-ruc-validation
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { validateRUC as validateRUCAction } from '@/features/hka/model';

// ============================================
// TYPES
// ============================================

export interface RUCValidationState {
    isValidating: boolean;
    isValid: boolean | null;
    dv: string | null;
    razonSocial: string | null;
    error: string | null;
    lastValidatedRUC: string | null;
}

export interface ValidateRUCOptions {
    /** Type of RUC: '1' = Natural, '2' = Legal */
    tipoRuc?: '1' | '2';
    /** Debounce delay in ms */
    debounceMs?: number;
}

export interface UseRUCValidationReturn {
    state: RUCValidationState;
    validate: (ruc: string, options?: ValidateRUCOptions) => Promise<boolean>;
    reset: () => void;
    /** Detect RUC type from format */
    detectRUCType: (ruc: string) => '1' | '2';
}

// ============================================
// HELPERS
// ============================================

/**
 * Detect RUC type from its format
 * Natural (1): Format like 8-XXX-XXXX or X-XXX-XXXX
 * Legal (2): Format like 1234567-X-XXXX
 */
function detectRUCTypeFromFormat(ruc: string): '1' | '2' {
    const cleanRUC = ruc.replace(/-/g, '').trim();

    // Legal entities typically have 7+ digits before the first separator
    // or the first segment is > 3 characters
    const parts = ruc.split('-');
    if (parts.length >= 2) {
        // If first part has more than 3 digits, it's likely legal
        if (parts[0].length > 3) {
            return '2';
        }
        // If first part is 1-3 digits, it's likely natural
        return '1';
    }

    // Default to natural if we can't determine
    return '1';
}

/**
 * Format RUC with DV
 */
function formatRUCWithDV(ruc: string, dv: string): string {
    return `${ruc}-DV${dv}`;
}

// ============================================
// HOOK
// ============================================

export function useRUCValidation(clientId: string): UseRUCValidationReturn {
    const [state, setState] = useState<RUCValidationState>({
        isValidating: false,
        isValid: null,
        dv: null,
        razonSocial: null,
        error: null,
        lastValidatedRUC: null,
    });

    // Cache for validation results
    const cacheRef = useRef<Map<string, { dv: string; razonSocial?: string }>>(new Map());

    // Debounce timer
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const validate = useCallback(async (
        ruc: string,
        options?: ValidateRUCOptions
    ): Promise<boolean> => {
        const cleanRUC = ruc.replace(/-/g, '').trim();

        if (!cleanRUC || cleanRUC.length < 5) {
            setState(prev => ({
                ...prev,
                isValid: null,
                dv: null,
                razonSocial: null,
                error: null,
            }));
            return false;
        }

        // Check cache first
        const cacheKey = `${options?.tipoRuc || 'auto'}-${cleanRUC}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setState(prev => ({
                ...prev,
                isValid: true,
                dv: cached.dv,
                razonSocial: cached.razonSocial || null,
                error: null,
                lastValidatedRUC: cleanRUC,
            }));
            return true;
        }

        // Clear any pending debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        const debounceMs = options?.debounceMs ?? 500;

        return new Promise<boolean>((resolve) => {
            debounceRef.current = setTimeout(async () => {
                setState(prev => ({
                    ...prev,
                    isValidating: true,
                    error: null,
                }));

                try {
                    const tipoRuc = options?.tipoRuc || detectRUCTypeFromFormat(ruc);
                    const result = await validateRUCAction(clientId, { tipoRuc, ruc: cleanRUC });

                    if (result.valid && result.dv) {
                        // Update cache
                        cacheRef.current.set(cacheKey, {
                            dv: result.dv,
                            razonSocial: result.razonSocial,
                        });

                        setState(prev => ({
                            ...prev,
                            isValidating: false,
                            isValid: true,
                            dv: result.dv!,
                            razonSocial: result.razonSocial || null,
                            error: null,
                            lastValidatedRUC: cleanRUC,
                        }));

                        resolve(true);
                    } else {
                        setState(prev => ({
                            ...prev,
                            isValidating: false,
                            isValid: false,
                            dv: null,
                            razonSocial: null,
                            error: result.error || 'RUC no válido',
                            lastValidatedRUC: cleanRUC,
                        }));

                        resolve(false);
                    }
                } catch (error) {
                    setState(prev => ({
                        ...prev,
                        isValidating: false,
                        isValid: false,
                        dv: null,
                        razonSocial: null,
                        error: error instanceof Error ? error.message : 'Error al validar RUC',
                        lastValidatedRUC: cleanRUC,
                    }));

                    resolve(false);
                }
            }, debounceMs);
        });
    }, [clientId]);

    const reset = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        setState({
            isValidating: false,
            isValid: null,
            dv: null,
            razonSocial: null,
            error: null,
            lastValidatedRUC: null,
        });
    }, []);

    const detectRUCType = useCallback((ruc: string): '1' | '2' => {
        return detectRUCTypeFromFormat(ruc);
    }, []);

    return {
        state,
        validate,
        reset,
        detectRUCType,
    };
}
