/**
 * useInvoiceWizard Hook
 * 
 * Orchestrates the multi-step invoice creation wizard.
 * Manages step navigation, form state, and coordinates
 * between client, items, payment, and review steps.
 * 
 * @module hooks/use-invoice-wizard
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useInvoiceItems, type InvoiceItem } from './use-invoice-items';
import { useInvoiceEmission } from './use-invoice-emission';

// ============================================
// TYPES
// ============================================

export type WizardStep = 'client' | 'items' | 'payment' | 'review';

export interface ClientData {
    tipoClienteFE: '01' | '02' | '03' | '04';
    tipoContribuyente?: '1' | '2';
    numeroRUC?: string;
    digitoVerificadorRUC?: string;
    razonSocial: string;
    direccion?: string;
    telefono1?: string;
    correoElectronico1?: string;
    codigoUbicacion?: string;
    provincia?: string;
    distrito?: string;
    corregimiento?: string;
}

export interface PaymentData {
    formaPagoFact: string;
    tiempoPago: '1' | '2' | '3';
    descFormaPago?: string;
}

export interface WizardState {
    currentStep: WizardStep;
    stepIndex: number;
    client: ClientData | null;
    payment: PaymentData;
    isComplete: boolean;
    isValid: boolean;
}

export interface UseInvoiceWizardReturn {
    // State
    state: WizardState;
    items: ReturnType<typeof useInvoiceItems>;
    emission: ReturnType<typeof useInvoiceEmission>;

    // Navigation
    goToStep: (step: WizardStep) => void;
    nextStep: () => void;
    prevStep: () => void;
    canGoNext: boolean;
    canGoPrev: boolean;

    // Data management
    setClient: (data: ClientData) => void;
    setPayment: (data: PaymentData) => void;

    // Validation
    validateCurrentStep: () => boolean;
    getStepErrors: () => string[];

    // Actions
    reset: () => void;
    submit: () => Promise<boolean>;
}

// ============================================
// CONSTANTS
// ============================================

const STEPS: WizardStep[] = ['client', 'items', 'payment', 'review'];

const STEP_INDEX: Record<WizardStep, number> = {
    client: 0,
    items: 1,
    payment: 2,
    review: 3,
};

const DEFAULT_PAYMENT: PaymentData = {
    formaPagoFact: '02', // Efectivo
    tiempoPago: '1', // Contado
};

const DEFAULT_CLIENT: ClientData = {
    tipoClienteFE: '02',
    razonSocial: 'CONSUMIDOR FINAL',
    direccion: 'PANAMA',
};

// ============================================
// HOOK
// ============================================

export function useInvoiceWizard(options?: {
    initialClient?: ClientData;
    onSuccess?: () => void;
}): UseInvoiceWizardReturn {
    const [currentStep, setCurrentStep] = useState<WizardStep>('client');
    const [client, setClientState] = useState<ClientData | null>(
        options?.initialClient ?? null
    );
    const [payment, setPaymentState] = useState<PaymentData>(DEFAULT_PAYMENT);

    // Sub-hooks
    const items = useInvoiceItems();
    const emission = useInvoiceEmission();

    // Computed state
    const stepIndex = STEP_INDEX[currentStep];

    const isComplete = useMemo(() => {
        return (
            client !== null &&
            items.items.length > 0 &&
            payment.formaPagoFact !== ''
        );
    }, [client, items.items, payment]);

    const validateCurrentStep = useCallback((): boolean => {
        switch (currentStep) {
            case 'client':
                return client !== null && client.razonSocial.trim() !== '';
            case 'items':
                return items.items.length > 0;
            case 'payment':
                return payment.formaPagoFact !== '';
            case 'review':
                return isComplete;
            default:
                return false;
        }
    }, [currentStep, client, items.items, payment, isComplete]);

    const canGoNext = useMemo(() => {
        return stepIndex < STEPS.length - 1 && validateCurrentStep();
    }, [stepIndex, validateCurrentStep]);

    const canGoPrev = useMemo(() => {
        return stepIndex > 0;
    }, [stepIndex]);

    const getStepErrors = useCallback((): string[] => {
        const errors: string[] = [];

        switch (currentStep) {
            case 'client':
                if (!client) {
                    errors.push('Debe ingresar datos del cliente');
                } else if (!client.razonSocial.trim()) {
                    errors.push('Nombre/Razón social es requerido');
                }
                if (client?.tipoClienteFE === '01' && !client.numeroRUC) {
                    errors.push('RUC es requerido para contribuyentes');
                }
                break;

            case 'items':
                if (items.items.length === 0) {
                    errors.push('Debe agregar al menos un item');
                }
                break;

            case 'payment':
                if (!payment.formaPagoFact) {
                    errors.push('Debe seleccionar una forma de pago');
                }
                break;

            case 'review':
                if (!isComplete) {
                    errors.push('Complete todos los pasos antes de enviar');
                }
                break;
        }

        return errors;
    }, [currentStep, client, items.items, payment, isComplete]);

    // Navigation
    const goToStep = useCallback((step: WizardStep) => {
        setCurrentStep(step);
    }, []);

    const nextStep = useCallback(() => {
        if (canGoNext) {
            const nextIndex = stepIndex + 1;
            setCurrentStep(STEPS[nextIndex]);
        }
    }, [canGoNext, stepIndex]);

    const prevStep = useCallback(() => {
        if (canGoPrev) {
            const prevIndex = stepIndex - 1;
            setCurrentStep(STEPS[prevIndex]);
        }
    }, [canGoPrev, stepIndex]);

    // Data management
    const setClient = useCallback((data: ClientData) => {
        setClientState(data);
    }, []);

    const setPayment = useCallback((data: PaymentData) => {
        setPaymentState(data);
    }, []);

    // Actions
    const reset = useCallback(() => {
        setCurrentStep('client');
        setClientState(null);
        setPaymentState(DEFAULT_PAYMENT);
        items.clearItems();
        emission.reset();
    }, [items, emission]);

    const submit = useCallback(async (): Promise<boolean> => {
        if (!isComplete || !client) {
            return false;
        }

        // Build document for HKA
        const documento = buildDocumentoElectronico(client, items, payment);

        // @ts-expect-error - Type mismatch in legacy code
        const result = await emission.emit(documento);

        if (result.success) {
            options?.onSuccess?.();
        }

        return result.success;
    }, [isComplete, client, items, payment, emission, options]);

    return {
        state: {
            currentStep,
            stepIndex,
            client,
            payment,
            isComplete,
            isValid: validateCurrentStep(),
        },
        items,
        emission,
        goToStep,
        nextStep,
        prevStep,
        canGoNext,
        canGoPrev,
        setClient,
        setPayment,
        validateCurrentStep,
        getStepErrors,
        reset,
        submit,
    };
}

// ============================================
// HELPER: Build DocumentoElectronico
// ============================================

function buildDocumentoElectronico(
    client: ClientData,
    items: ReturnType<typeof useInvoiceItems>,
    payment: PaymentData
) {
    const fechaEmision = new Date().toISOString();

    return {
        cliente: {
            tipoClienteFE: client.tipoClienteFE,
            tipoContribuyente: client.tipoContribuyente,
            numeroRUC: client.numeroRUC,
            digitoVerificadorRUC: client.digitoVerificadorRUC,
            razonSocial: client.razonSocial,
            direccion: client.direccion || 'PANAMA',
            pais: 'PA',
            telefono1: client.telefono1,
            correoElectronico1: client.correoElectronico1,
            codigoUbicacion: client.codigoUbicacion,
            provincia: client.provincia,
            distrito: client.distrito,
            corregimiento: client.corregimiento,
        },
        listaItems: items.getItemsForHKA(),
        totalesSubTotales: {
            totalPrecioNeto: items.totals.subtotal.toFixed(2),
            totalITBMS: items.totals.totalITBMS.toFixed(2),
            totalISC: '0.00',
            totalMontoGravado: items.totals.totalITBMS.toFixed(2),
            // totalDescuento se OMITE: los descuentos por-ítem ya están
            // aplicados en precioItem. Informar este campo sin
            // listaDescBonificacion provoca rechazo de HKA.
            totalFactura: items.totals.totalGeneral.toFixed(2),
            totalValorRecibido: items.totals.totalGeneral.toFixed(2),
            tiempoPago: payment.tiempoPago,
            nroItems: items.items.length.toString(),
            totalTodosItems: items.totals.totalGeneral.toFixed(2),
            listaFormaPago: [
                {
                    formaPagoFact: payment.formaPagoFact,
                    descFormaPago: payment.descFormaPago,
                    valorCuotaPagada: items.totals.totalGeneral.toFixed(2),
                },
            ],
        },
        fechaEmision,
    };
}
