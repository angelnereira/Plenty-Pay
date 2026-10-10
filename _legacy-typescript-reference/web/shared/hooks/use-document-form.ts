/**
 * useDocumentForm Hook
 *
 * Centralizes the form state for document creation that was previously
 * spread across 20+ useState calls in ManualInvoiceGenerator.
 *
 * Manages:
 *  - Document type / mode selection
 *  - Client data + RUC validation
 *  - Referenced invoice search (for NC/ND referenced mode)
 *  - Export data (for types 03/10)
 *  - Payment data
 *  - Invoice config + next document number preview
 *  - Full form reset
 *
 * @module hooks/use-document-form
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getInvoiceConfig, type InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import { getNextInvoiceNumberPreview } from '@/app/actions/invoice/get-next-invoice-number.action';
import { validateRUCAction } from '@/app/actions/hka/validate-ruc.action';

// ============================================
// TYPES
// ============================================

export type DocumentMode =
    | 'FACTURA'
    | 'FACTURA_IMPORTACION'
    | 'FACTURA_EXPORTACION'
    | 'NOTA_CREDITO'
    | 'NOTA_DEBITO'
    | 'FACTURA_ZONA_FRANCA'
    | 'REEMBOLSO'
    | 'FACTURA_EXTRANJERA';

export type NoteSubtype = 'REFERENCED' | 'GENERIC';

export interface ClientData {
    tipoClienteFE: string;
    tipoContribuyente: string;
    numeroRUC: string;
    digitoVerificadorRUC: string;
    razonSocial: string;
    direccion: string;
    codigoUbicacion: string;
    provincia: string;
    distrito: string;
    corregimiento: string;
    telefono1?: string;
    correoElectronico1?: string;
    motorEntityId?: string;
}

export interface RucValidationState {
    isValidating: boolean;
    isValid: boolean | null;
    error: string | null;
    afiliadoFE: boolean | null;
}

export interface ReferencedInvoice {
    id: string;
    folio: string;
    cufe: string;
    clientName: string;
    receiverName?: string;
    receiverRuc?: string;
    receiverDv?: string;
    receiverType?: string;
    total: number;
    emittedAt: string;
    invoiceNumber?: string;
    items?: Array<{
        id: string;
        code: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        taxRate: number;
    }>;
}

export interface ExportFormData {
    incoterm: string;
    currency: string;
    currencyDesc: string;
    exchangeRate: string;
    foreignAmount: string;
    port: string;
}

export interface PaymentData {
    formaPagoFact: string;
    descFormaPago: string;
    tiempoPago: string;
    informacionInteres: string;
}

export interface ImportData {
    proveedorTaxId: string;
    paisOrigen: string;
}

export interface CompraData {
    cedulaProveedor: string;
    nombreProveedor: string;
    aplicaRetencion100: boolean;
}

const DEFAULT_CLIENT: ClientData = {
    tipoClienteFE: '01',
    tipoContribuyente: '2',
    numeroRUC: '',
    digitoVerificadorRUC: '',
    razonSocial: '',
    direccion: '',
    codigoUbicacion: '8-8-1',
    provincia: 'Panamá',
    distrito: 'Panamá',
    corregimiento: 'San Felipe',
    motorEntityId: undefined,
};

const DEFAULT_PAYMENT: PaymentData = {
    formaPagoFact: '02',
    descFormaPago: '',
    tiempoPago: '1',
    informacionInteres: '',
};

const DEFAULT_EXPORT: ExportFormData = {
    incoterm: '',
    currency: 'USD',
    currencyDesc: '',
    exchangeRate: '',
    foreignAmount: '',
    port: '',
};

const DEFAULT_RUC_VALIDATION: RucValidationState = {
    isValidating: false,
    isValid: null,
    error: null,
    afiliadoFE: null,
};

const DEFAULT_IMPORT: ImportData = {
    proveedorTaxId: '',
    paisOrigen: 'US',
};

const DEFAULT_COMPRA: CompraData = {
    cedulaProveedor: '',
    nombreProveedor: '',
    aplicaRetencion100: true,
};

export const DOCUMENT_MODE_LABELS: Record<DocumentMode, string> = {
    FACTURA: 'Factura',
    FACTURA_IMPORTACION: 'Factura de Importación',
    FACTURA_EXPORTACION: 'Factura de Exportación',
    NOTA_CREDITO: 'Nota de Crédito',
    NOTA_DEBITO: 'Nota de Débito',
    FACTURA_ZONA_FRANCA: 'Factura de Zona Franca',
    REEMBOLSO: 'Reembolso',
    FACTURA_EXTRANJERA: 'Factura Extranjera',
};

export interface UseDocumentFormReturn {
    // ── Document type ──────────────────────────────────────────────
    documentMode: DocumentMode;
    setDocumentMode: (mode: DocumentMode) => void;
    noteSubtype: NoteSubtype;
    setNoteSubtype: (type: NoteSubtype) => void;
    noteReason: string;
    setNoteReason: (reason: string) => void;

    // ── Client ─────────────────────────────────────────────────────
    clientData: ClientData;
    setClientData: (data: Partial<ClientData>) => void;
    rucValidation: RucValidationState;
    validateRUC: () => Promise<void>;
    validateClient: () => boolean;

    // ── Referenced invoice (NC/ND) ─────────────────────────────────
    referencedInvoice: ReferencedInvoice | null;
    invoiceSearchQuery: string;
    setInvoiceSearchQuery: (q: string) => void;
    invoiceSearchResults: ReferencedInvoice[];
    isSearchingInvoices: boolean;
    selectReferencedInvoice: (invoice: ReferencedInvoice) => void;
    fetchReferencedItems: (invoice: ReferencedInvoice) => Promise<ReferencedInvoice['items']>;

    // ── Export data ────────────────────────────────────────────────
    exportData: ExportFormData;
    setExportData: (data: Partial<ExportFormData>) => void;

    // ── Payment ────────────────────────────────────────────────────
    paymentData: PaymentData;
    setPaymentData: (data: Partial<PaymentData>) => void;

    // ── Config ─────────────────────────────────────────────────────
    config: InvoiceConfig | null;
    isLoadingConfig: boolean;
    nextDocumentNumber: string | null;
    loadConfig: () => Promise<void>;

    // ── Derived helpers ────────────────────────────────────────────
    isNoteMode: boolean;
    isNoteReferenced: boolean;
    needsExportFields: boolean;
    docLabel: string;

    // ── Import / Compra data ───────────────────────────────────────
    importData: ImportData;
    setImportData: (data: Partial<ImportData>) => void;
    compraData: CompraData;
    setCompraData: (data: Partial<CompraData>) => void;

    // ── Smart defaults ─────────────────────────────────────────────
    /** Apply persisted preferences returned by useInvoicePreferences */
    applyPreferences: (prefs: import('./use-invoice-preferences').InvoicePreferences) => void;

    // ── Helpers ────────────────────────────────────────────────────
    /** Mark RUC as pre-validated (used when data is pre-loaded from imports) */
    markRucValid: () => void;

    // ── Reset ──────────────────────────────────────────────────────
    resetForm: (initialMode?: DocumentMode) => void;
}

// ============================================
// HOOK
// ============================================

export function useDocumentForm(initialMode: DocumentMode = 'FACTURA'): UseDocumentFormReturn {
    const [documentMode, setDocumentModeState] = useState<DocumentMode>(initialMode);
    const [noteSubtype, setNoteSubtype] = useState<NoteSubtype>('REFERENCED');
    const [noteReason, setNoteReason] = useState('');

    const [clientData, setClientDataState] = useState<ClientData>(DEFAULT_CLIENT);
    const [rucValidation, setRucValidation] = useState<RucValidationState>(DEFAULT_RUC_VALIDATION);

    const [referencedInvoice, setReferencedInvoice] = useState<ReferencedInvoice | null>(null);
    const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
    const [invoiceSearchResults, setInvoiceSearchResults] = useState<ReferencedInvoice[]>([]);
    const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);

    const [exportData, setExportDataState] = useState<ExportFormData>(DEFAULT_EXPORT);
    const [paymentData, setPaymentDataState] = useState<PaymentData>(DEFAULT_PAYMENT);

    const [config, setConfig] = useState<InvoiceConfig | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);
    const [nextDocumentNumber, setNextDocumentNumber] = useState<string | null>(null);

    const [importData, setImportDataState] = useState<ImportData>(DEFAULT_IMPORT);
    const [compraData, setCompraDataState] = useState<CompraData>(DEFAULT_COMPRA);

    // ── Debounced invoice search ──────────────────────────────────────────────
    useEffect(() => {
        if (invoiceSearchQuery.length <= 2) {
            setInvoiceSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingInvoices(true);
            try {
                const res = await fetch(
                    `/api/invoices/search?q=${encodeURIComponent(invoiceSearchQuery)}&status=EMITTED,CERTIFIED&documentType=FACTURA&limit=10`
                );
                if (res.ok) {
                    const data = await res.json();
                    setInvoiceSearchResults(data.invoices || []);
                } else {
                    setInvoiceSearchResults([]);
                }
            } catch {
                setInvoiceSearchResults([]);
            } finally {
                setIsSearchingInvoices(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [invoiceSearchQuery]);

    // ── Setters ───────────────────────────────────────────────────────────────
    const setDocumentMode = useCallback((mode: DocumentMode) => {
        setDocumentModeState(mode);
        if (mode !== 'NOTA_CREDITO' && mode !== 'NOTA_DEBITO') {
            setReferencedInvoice(null);
            setNoteReason('');
        }
    }, []);

    const setClientData = useCallback((data: Partial<ClientData>) => {
        setClientDataState(prev => ({ ...prev, ...data }));
    }, []);

    const setExportData = useCallback((data: Partial<ExportFormData>) => {
        setExportDataState(prev => ({ ...prev, ...data }));
    }, []);

    const setPaymentData = useCallback((data: Partial<PaymentData>) => {
        setPaymentDataState(prev => ({ ...prev, ...data }));
    }, []);

    const setImportData = useCallback((data: Partial<ImportData>) => {
        setImportDataState(prev => ({ ...prev, ...data }));
    }, []);

    const setCompraData = useCallback((data: Partial<CompraData>) => {
        setCompraDataState(prev => ({ ...prev, ...data }));
    }, []);

    // ── Smart defaults ────────────────────────────────────────────────────────
    const applyPreferences = useCallback(
        (prefs: import('./use-invoice-preferences').InvoicePreferences) => {
            if (prefs.documentMode) {
                setDocumentModeState(prefs.documentMode);
            }
            if (prefs.formaPagoFact) {
                setPaymentDataState(p => ({ ...p, formaPagoFact: prefs.formaPagoFact! }));
            }
            if (prefs.incoterm) {
                setExportDataState(p => ({ ...p, incoterm: prefs.incoterm! }));
            }
            if (prefs.moneda) {
                setExportDataState(p => ({ ...p, currency: prefs.moneda! }));
            }
        },
        [],
    );

    // ── Config loader ─────────────────────────────────────────────────────────
    const loadConfig = useCallback(async () => {
        if (config || isLoadingConfig) return;
        setIsLoadingConfig(true);
        try {
            const [configResult, numberResult] = await Promise.all([
                getInvoiceConfig(),
                getNextInvoiceNumberPreview(),
            ]);
            if (configResult.success && configResult.data) {
                setConfig(configResult.data);
            } else {
                toast.error(configResult.error || 'Error al cargar configuración');
            }
            if (numberResult.success && numberResult.nextNumber) {
                setNextDocumentNumber(numberResult.nextNumber);
            }
        } catch {
            toast.error('Error al cargar configuración');
        } finally {
            setIsLoadingConfig(false);
        }
    }, [config, isLoadingConfig]);

    // ── RUC validation ────────────────────────────────────────────────────────
    const validateRUC = useCallback(async () => {
        if (!clientData.numeroRUC.trim()) {
            toast.error('Ingrese un RUC para validar');
            return;
        }
        setRucValidation({ isValidating: true, isValid: null, error: null, afiliadoFE: null });
        try {
            const result = await validateRUCAction({
                ruc: clientData.numeroRUC.trim(),
                tipoRuc: clientData.tipoContribuyente as '1' | '2',
            });
            if (result.success && result.data) {
                setClientDataState(prev => ({
                    ...prev,
                    digitoVerificadorRUC: result.data!.dv,
                    razonSocial: result.data!.razonSocial.trim() || prev.razonSocial,
                }));
                setRucValidation({ isValidating: false, isValid: true, error: null, afiliadoFE: result.data.afiliadoFE });
                toast.success(`RUC válido: ${result.data.razonSocial.trim()}`, {
                    description: `DV: ${result.data.dv} | ${result.data.afiliadoFE ? 'Afiliado a FE' : 'No afiliado a FE'}`,
                });
            } else {
                setRucValidation({ isValidating: false, isValid: false, error: result.error || 'RUC no encontrado', afiliadoFE: null });
                toast.error('RUC no válido', { description: result.error || 'No se encontró el RUC en la DGI' });
            }
        } catch {
            setRucValidation({ isValidating: false, isValid: false, error: 'Error de conexión con HKA', afiliadoFE: null });
            toast.error('Error al validar RUC');
        }
    }, [clientData.numeroRUC, clientData.tipoContribuyente]);

    // ── Client validation ─────────────────────────────────────────────────────
    const validateClient = useCallback((): boolean => {
        const tipo = clientData.tipoClienteFE;
        if (tipo === '02') return true; // Consumidor Final - no required fields

        if (!clientData.razonSocial.trim()) {
            toast.error('La razón social es obligatoria para este tipo de cliente');
            return false;
        }
        if (tipo === '01' || tipo === '03') {
            if (!clientData.numeroRUC || !clientData.digitoVerificadorRUC) {
                toast.error('RUC y DV son obligatorios para Contribuyentes y Gobierno');
                return false;
            }
            if (rucValidation.isValid !== true) {
                toast.error('Debe validar el RUC antes de continuar. Use el botón "Validar RUC".');
                return false;
            }
        }
        return true;
    }, [clientData, rucValidation.isValid]);

    // ── Referenced invoice helpers ────────────────────────────────────────────
    const selectReferencedInvoice = useCallback((invoice: ReferencedInvoice) => {
        setReferencedInvoice(invoice);
        // Pre-fill client data from original invoice
        const typeMap: Record<string, string> = {
            CONTRIBUTOR: '01', CONSUMER_FINAL: '02', GOVERNMENT: '03', FOREIGN: '04',
        };
        setClientDataState(prev => ({
            ...prev,
            tipoClienteFE: typeMap[invoice.receiverType || ''] || '02',
            razonSocial: invoice.receiverName || invoice.clientName || '',
            numeroRUC: invoice.receiverRuc || '',
            digitoVerificadorRUC: invoice.receiverDv || '',
        }));
        if (invoice.receiverRuc) {
            setRucValidation({ isValidating: false, isValid: true, error: null, afiliadoFE: null });
        }
    }, []);

    const fetchReferencedItems = useCallback(async (invoice: ReferencedInvoice): Promise<ReferencedInvoice['items']> => {
        try {
            const res = await fetch(`/api/invoices/${invoice.id}`);
            if (!res.ok) {
                toast.error('No se pudieron cargar los ítems de la factura original.');
                return undefined;
            }
            const data = await res.json();
            if (data.data?.items?.length) {
                const items = data.data.items as ReferencedInvoice['items'];
                setReferencedInvoice(prev => prev ? { ...prev, items } : prev);
                return items;
            }
            toast.error('La factura original no tiene ítems registrados.');
            return undefined;
        } catch {
            toast.error('Error de conexión al cargar ítems de la factura.');
            return undefined;
        }
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────
    const isNoteMode = documentMode === 'NOTA_CREDITO' || documentMode === 'NOTA_DEBITO';
    const isNoteReferenced = isNoteMode && noteSubtype === 'REFERENCED';
    const needsExportFields = documentMode === 'FACTURA_EXPORTACION' || documentMode === 'FACTURA_EXTRANJERA';
    const docLabel = DOCUMENT_MODE_LABELS[documentMode];

    // ── Helpers ───────────────────────────────────────────────────────────────
    const markRucValid = useCallback(() => {
        setRucValidation({ isValidating: false, isValid: true, error: null, afiliadoFE: null });
    }, []);

    // ── Reset ─────────────────────────────────────────────────────────────────
    const resetForm = useCallback((newInitialMode: DocumentMode = 'FACTURA') => {
        setDocumentModeState(newInitialMode);
        setNoteSubtype('REFERENCED');
        setNoteReason('');
        setClientDataState(DEFAULT_CLIENT);
        setRucValidation(DEFAULT_RUC_VALIDATION);
        setReferencedInvoice(null);
        setInvoiceSearchQuery('');
        setInvoiceSearchResults([]);
        setExportDataState(DEFAULT_EXPORT);
        setPaymentDataState(DEFAULT_PAYMENT);
        setNextDocumentNumber(null);
        setImportDataState(DEFAULT_IMPORT);
        setCompraDataState(DEFAULT_COMPRA);
    }, []);

    return {
        documentMode,
        setDocumentMode,
        noteSubtype,
        setNoteSubtype,
        noteReason,
        setNoteReason,
        clientData,
        setClientData,
        rucValidation,
        validateRUC,
        validateClient,
        referencedInvoice,
        invoiceSearchQuery,
        setInvoiceSearchQuery,
        invoiceSearchResults,
        isSearchingInvoices,
        selectReferencedInvoice,
        fetchReferencedItems,
        exportData,
        setExportData,
        paymentData,
        setPaymentData,
        config,
        isLoadingConfig,
        nextDocumentNumber,
        loadConfig,
        isNoteMode,
        isNoteReferenced,
        needsExportFields,
        docLabel,
        markRucValid,
        resetForm,
        importData,
        setImportData,
        compraData,
        setCompraData,
        applyPreferences,
    };
}
