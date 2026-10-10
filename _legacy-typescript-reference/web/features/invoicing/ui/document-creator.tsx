'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@shared/ui/alert-dialog';
import { Button } from '@shared/ui/button';
import { cn } from '@/lib/utils';
import { useDocumentForm, type DocumentMode, type ReferencedInvoice } from '@/shared/hooks/use-document-form';
import { useInvoiceItems } from '@/shared/hooks/use-invoice-items';
import { useInvoiceEmission } from '@/shared/hooks/use-invoice-emission';
import { useInvoiceDraft } from '@/shared/hooks/use-invoice-draft';
import { InvoiceEmissionResult } from './invoice-emission-result-modal';
import { DocTypeStep } from './steps/doc-type-step';
import { ClientStep } from './steps/client-step';
import { ItemsStep } from './steps/items-step';
import { PaymentStep } from './steps/payment-step';
import { ReviewStep } from './steps/review-step';
import { DocumentModeBadge } from './document-mode-badge';
import type { ManualInvoiceData } from '@/lib/mappers/manual-invoice-to-hka';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';
import type { ClientData, PaymentData } from '@/shared/hooks/use-document-form';
import type { AddItemInput } from '@/shared/hooks/use-invoice-items';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['doctype', 'client', 'items', 'payment', 'review'] as const;
type Step = typeof STEPS[number];
type ItemsFetchStatus = 'idle' | 'loading' | 'done' | 'error';

const STEP_LABELS: Record<Step, string> = {
    doctype: 'Documento',
    client: 'Cliente',
    items: 'Items',
    payment: 'Pago',
    review: 'Revisión',
};

const ITBMS_CODE_TO_RATE: Record<string, number> = {
    '00': 0, '01': 7, '02': 10, '03': 15,
};

const TIPO_DOC_TO_MODE: Record<string, DocumentMode> = {
    '01': 'FACTURA', '02': 'FACTURA_IMPORTACION', '03': 'FACTURA_EXPORTACION',
    '08': 'FACTURA_ZONA_FRANCA', '09': 'REEMBOLSO', '10': 'FACTURA_EXTRANJERA',
};

interface ParsedImport {
    documentMode: DocumentMode;
    clientData: Partial<ClientData>;
    items: AddItemInput[];
    paymentData: Partial<PaymentData>;
    requiresRucValidation: boolean;
}

function mapDocumentoToFormState(doc: DocumentoElectronico): ParsedImport {
    const tipoDoc = doc.datosTransaccion.tipoDocumento;
    const documentMode: DocumentMode = TIPO_DOC_TO_MODE[tipoDoc] ?? 'FACTURA';
    const c = doc.datosTransaccion.cliente as unknown as Record<string, string | undefined>;
    const tipoClienteFE = c.tipoClienteFE || '02';
    const clientData: Partial<ClientData> = {
        tipoClienteFE,
        tipoContribuyente: c.tipoContribuyente || '2',
        numeroRUC: c.numeroRUC || '',
        digitoVerificadorRUC: c.digitoVerificadorRUC || '',
        razonSocial: c.razonSocial || '',
        direccion: c.direccion || '',
        codigoUbicacion: c.codigoUbicacion || '8-8-1',
        provincia: c.provincia || 'Panamá',
        distrito: c.distrito || 'Panamá',
        corregimiento: c.corregimiento || 'San Felipe',
        telefono1: c.telefono1,
        correoElectronico1: c.correoElectronico1,
    };
    const items: AddItemInput[] = doc.listaItems.map(item => ({
        codigo: item.codigo || '',
        descripcion: item.descripcion,
        cantidad: parseFloat(item.cantidad),
        precioUnitario: parseFloat(item.precioUnitario),
        descuento: parseFloat(item.precioUnitarioDescuento || '0'),
        tasaITBMS: (item.tasaITBMS as '00' | '01' | '02' | '03') ?? '01',
        cpbsCode: item.codigoCPBS,
        cpbsUnit: item.unidadMedidaCPBS,
    }));
    const pago = doc.totalesSubTotales.listaFormaPago?.[0];
    const paymentData: Partial<PaymentData> = {
        formaPagoFact: pago?.formaPagoFact || '02',
        descFormaPago: (pago as unknown as Record<string, string> | undefined)?.descFormaPago || '',
        tiempoPago: String(doc.totalesSubTotales.tiempoPago || '1'),
        informacionInteres: doc.datosTransaccion.informacionInteres || '',
    };
    const requiresRucValidation = (tipoClienteFE === '01' || tipoClienteFE === '03') && !!clientData.numeroRUC;
    return { documentMode, clientData, items, paymentData, requiresRucValidation };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DocumentCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onStartEmit?: (optimisticData: unknown) => void;
    initialData?: DocumentoElectronico;
    initialDocumentMode?: DocumentMode;
    /** Namespaces the localStorage draft key per tenant */
    draftKey?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentCreator({
    isOpen,
    onClose,
    onSuccess,
    onStartEmit,
    initialData,
    initialDocumentMode = 'FACTURA',
    draftKey = 'default',
}: DocumentCreatorProps) {
    const form = useDocumentForm(initialDocumentMode);
    const items = useInvoiceItems();
    const emission = useInvoiceEmission();

    const [step, setStep] = useState<Step>('doctype');
    const [itemsFetchStatus, setItemsFetchStatus] = useState<ItemsFetchStatus>('idle');
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);

    // ── Draft persistence ─────────────────────────────────────────────────────
    const { clearDraft } = useInvoiceDraft({
        draftKey,
        isOpen,
        clientData: form.clientData,
        items: items.items.map(i => ({
            codigo: i.codigo,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            descuento: i.precioUnitario - i.precioUnitarioDescuento,
            tasaITBMS: i.tasaITBMS,
            productId: i.productId,
            cpbsCode: i.cpbsCode,
            cpbsUnit: i.cpbsUnit,
        })),
        paymentData: form.paymentData,
        onRestore: (draft) => {
            const isEmpty =
                !form.clientData.razonSocial.trim() &&
                !form.clientData.numeroRUC.trim() &&
                items.items.length === 0;
            if (!isEmpty) return;
            if (draft.clientData) form.setClientData(draft.clientData);
            if (draft.paymentData) form.setPaymentData(draft.paymentData);
            if (draft.items?.length) {
                items.clearItems();
                draft.items.forEach(i => items.addItem(i));
            }
            setDraftRestored(true);
            toast.info('Borrador restaurado', {
                description: 'Tenías una factura en curso. Puedes continuar donde lo dejaste.',
                duration: 4000,
            });
        },
    });

    const hasData = useCallback((): boolean => {
        return (
            !!form.clientData.razonSocial.trim() ||
            !!form.clientData.numeroRUC.trim() ||
            items.items.length > 0
        );
    }, [form.clientData, items.items]);

    const handleDuplicate = useCallback((data: import('@/shared/hooks/use-last-invoice').LastInvoiceSummary) => {
        const mappedItems = data.items.map((item, idx) => ({
            id: `dup-${idx}`,
            code: '',
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: 0,
            taxRate: ITBMS_CODE_TO_RATE[item.taxRate] ?? 7,
        }));
        items.loadFromReferencedInvoice(mappedItems);
        setStep('items');
    }, [items]);

    // Load invoice config when dialog opens
    useEffect(() => {
        if (isOpen) form.loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Pre-populate from XML/Excel import
    useEffect(() => {
        if (!isOpen || !initialData) return;
        try {
            const parsed = mapDocumentoToFormState(initialData);
            form.setDocumentMode(parsed.documentMode);
            form.setClientData(parsed.clientData);
            form.setPaymentData(parsed.paymentData);
            items.clearItems();
            parsed.items.forEach(item => items.addItem(item));
            if (parsed.requiresRucValidation) form.markRucValid();
            setStep('client');
            toast.success(`${parsed.items.length} ítem(s) importados correctamente`);
        } catch {
            toast.error('Error al cargar los datos del archivo importado');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData]);

    // ── Item fetch for referenced NC/ND ───────────────────────────────────────

    const fetchReferencedItems = useCallback(async (invoice?: ReferencedInvoice) => {
        const target = invoice ?? form.referencedInvoice;
        if (!target) return;
        setItemsFetchStatus('loading');
        try {
            const refItems = await form.fetchReferencedItems(target);
            if (refItems?.length) {
                items.loadFromReferencedInvoice(refItems);
                setItemsFetchStatus('done');
            } else {
                setItemsFetchStatus('error');
                toast.error('No se pudieron cargar los ítems de la factura original');
            }
        } catch {
            setItemsFetchStatus('error');
        }
    }, [form, items]);

    // ── Navigation ────────────────────────────────────────────────────────────

    const handleNext = useCallback(async () => {
        if (step === 'doctype' && form.isNoteMode) {
            if (form.noteSubtype === 'REFERENCED' && !form.referencedInvoice) {
                toast.error('Seleccione la factura a referenciar'); return;
            }
            if (!form.noteReason.trim()) {
                toast.error('Ingrese el motivo de la nota'); return;
            }
        }
        if (step === 'client') {
            if (!form.validateClient()) return;
            setStep('items');
            if (form.isNoteReferenced && itemsFetchStatus === 'idle') fetchReferencedItems();
            return;
        }
        if (step === 'items' && items.items.length === 0) {
            toast.error('Agregue al menos un ítem al documento'); return;
        }
        if (step === 'payment' && form.paymentData.formaPagoFact === '99' && !form.paymentData.descFormaPago.trim()) {
            toast.error('Ingrese la descripción del método de pago "Otro"'); return;
        }
        const next = STEPS[STEPS.indexOf(step) + 1];
        if (next) setStep(next);
    }, [step, form, items, itemsFetchStatus, fetchReferencedItems]);

    const handleBack = useCallback(() => {
        const prev = STEPS[STEPS.indexOf(step) - 1];
        if (prev) setStep(prev);
    }, [step]);

    // ── Reset ─────────────────────────────────────────────────────────────────

    const resetAll = useCallback((mode?: DocumentMode) => {
        form.resetForm(mode);
        items.clearItems();
        emission.reset();
        setStep('doctype');
        setItemsFetchStatus('idle');
        setDraftRestored(false);
    }, [form, items, emission]);

    const handleCloseRequest = useCallback(() => {
        if (emission.state.isEmitting) return;
        // Never show the discard dialog while the emission result is visible —
        // the result modal opening can trigger onInteractOutside on the parent Dialog.
        if (emission.state.showResultModal) return;
        if (hasData()) {
            setShowDiscardDialog(true);
        } else {
            clearDraft();
            resetAll();
            onClose();
        }
    }, [emission.state.isEmitting, emission.state.showResultModal, hasData, clearDraft, resetAll, onClose]);

    const handleConfirmDiscard = useCallback(() => {
        setShowDiscardDialog(false);
        clearDraft();
        resetAll();
        onClose();
    }, [clearDraft, resetAll, onClose]);

    // ── Emission ──────────────────────────────────────────────────────────────

    const handleEmit = useCallback(async () => {
        if (!form.config) { toast.error('Configuración no cargada.'); return; }
        if (items.items.length === 0) { toast.error('No hay ítems para emitir'); return; }

        onStartEmit?.({
            id: `temp-${Date.now()}`,
            total: items.totals.totalGeneral,
            clientName: form.clientData.razonSocial,
            receiverName: form.clientData.razonSocial,
            status: 'PROCESSING',
            createdAt: new Date(),
        });

        const { documentMode, clientData, paymentData, exportData, noteSubtype, noteReason, referencedInvoice } = form;

        if (documentMode === 'NOTA_CREDITO' || documentMode === 'NOTA_DEBITO') {
            await emission.emitNote({
                noteType: documentMode,
                noteSubtype,
                items: items.items.map(item => ({
                    description: item.descripcion,
                    quantity: item.cantidad,
                    unitPrice: item.precioUnitario,
                    taxRate: ITBMS_CODE_TO_RATE[item.tasaITBMS] ?? 7,
                    discount: item.precioUnitario - item.precioUnitarioDescuento,
                })),
                reason: noteReason,
                paymentMethod: paymentData.formaPagoFact,
                originalInvoiceId: noteSubtype === 'REFERENCED' ? referencedInvoice?.id : undefined,
                receiver: noteSubtype === 'GENERIC' ? {
                    name: clientData.razonSocial,
                    ruc: clientData.numeroRUC || undefined,
                    dv: clientData.digitoVerificadorRUC || undefined,
                    type: clientData.tipoClienteFE,
                } : undefined,
            });
        } else {
            const manualData: ManualInvoiceData = {
                documentType: documentMode as ManualInvoiceData['documentType'],
                exportData: form.needsExportFields ? {
                    incoterm: exportData.incoterm,
                    currency: exportData.currency || undefined,
                    currencyDesc: exportData.currencyDesc || undefined,
                    exchangeRate: exportData.exchangeRate || undefined,
                    foreignAmount: exportData.foreignAmount || undefined,
                    port: exportData.port || undefined,
                } : undefined,
                client: clientData,
                items: items.items.map(item => ({
                    id: item.id,
                    descripcion: item.descripcion,
                    code: item.codigo || undefined,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    precioUnitarioDescuento: item.precioUnitarioDescuento,
                    tasaITBMS: item.tasaITBMS,
                    valorITBMS: item.itbms,
                    precioItem: item.subtotal,
                    valorTotal: item.total,
                    productId: item.productId,
                    cpbsCode: item.cpbsCode,
                    cpbsUnit: item.cpbsUnit,
                })),
                payment: paymentData,
            };
            await emission.emitFromDraft(manualData, form.config);
        }
    }, [form, items, emission, onStartEmit]);

    // ── Result handler ────────────────────────────────────────────────────────

    const handleResultClose = useCallback(() => {
        clearDraft();
        resetAll();
        onSuccess();
    }, [clearDraft, resetAll, onSuccess]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const currentStepIndex = STEPS.indexOf(step);
    const isLastStep = step === 'review';

    const resultData = emission.state.result ? {
        cufe: emission.state.result.cufe || '',
        qr: emission.state.result.qr || '',
        fechaRecepcionDGI: emission.state.result.fechaEmision || '',
        nroProtocoloAutorizacion: emission.state.result.protocolo || '',
        codigo: emission.state.result.success ? '200' : '500',
        mensaje: emission.state.result.success
            ? 'Documento emitido exitosamente'
            : (emission.state.result.error || 'Error al emitir el documento'),
        numeroDocumentoFiscal: emission.state.result.numeroDocumentoFiscal,
        invoiceId: emission.state.result.invoiceId,
    } : null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(open) => { if (!open) handleCloseRequest(); }}
            >
                {/*
                 * Fixed header + fixed footer. Only the central div scrolls.
                 * max-w-3xl gives DGI forms enough horizontal room.
                 * maxHeight clamped to 92 vh or 860 px, whichever is smaller.
                 */}
                <DialogContent
                    className="max-w-3xl w-full p-0 gap-0 overflow-hidden flex flex-col"
                    style={{ maxHeight: 'min(92vh, 860px)' }}
                    onEscapeKeyDown={(e) => { e.preventDefault(); handleCloseRequest(); }}
                    onInteractOutside={(e) => { e.preventDefault(); handleCloseRequest(); }}
                >
                    {/* Fixed Header */}
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
                        <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-baseline gap-2 flex-wrap">
                            {form.docLabel}
                            <DocumentModeBadge mode={form.documentMode} />
                            {form.nextDocumentNumber && (
                                <span className="text-xs font-normal text-gray-400 font-mono">
                                    #{form.nextDocumentNumber}
                                </span>
                            )}
                            {draftRestored && (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                    Borrador restaurado
                                </span>
                            )}
                        </DialogTitle>

                        {/* Step indicator */}
                        <div className="flex items-center mt-3">
                            {STEPS.map((s, i) => (
                                <div key={s} className="flex items-center flex-1 min-w-0">
                                    <div className={cn(
                                        'flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0',
                                        i === currentStepIndex
                                            ? 'text-purple-600 dark:text-purple-400'
                                            : i < currentStepIndex
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-gray-400 dark:text-gray-600'
                                    )}>
                                        <div className={cn(
                                            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                                            i === currentStepIndex
                                                ? 'bg-purple-600 text-white'
                                                : i < currentStepIndex
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                                        )}>
                                            {i < currentStepIndex ? '✓' : i + 1}
                                        </div>
                                        <span className="hidden sm:inline truncate">{STEP_LABELS[s]}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={cn(
                                            'flex-1 h-px mx-2 transition-colors',
                                            i < currentStepIndex
                                                ? 'bg-green-300 dark:bg-green-800'
                                                : 'bg-gray-200 dark:bg-slate-700'
                                        )} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </DialogHeader>

                    {/*
                     * Scrollable body — native overflow-y-auto, NOT Radix ScrollArea.
                     * min-h-0 is required so flex-1 shrinks correctly within the flex column.
                     * overscroll-contain prevents scroll chain to the page background.
                     */}
                    <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 py-5">
                        {step === 'doctype' && (
                            <DocTypeStep
                                form={form}
                                onFetchReferencedItems={(invoice) => fetchReferencedItems(invoice)}
                            />
                        )}
                        {step === 'client' && <ClientStep form={form} onDuplicate={handleDuplicate} />}
                        {step === 'items' && (
                            <ItemsStep
                                form={form}
                                items={items}
                                itemsFetchStatus={itemsFetchStatus}
                                onRetryFetch={() => fetchReferencedItems()}
                            />
                        )}
                        {step === 'payment' && <PaymentStep form={form} />}
                        {step === 'review' && <ReviewStep form={form} items={items} />}
                    </div>

                    {/* Fixed Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={step === 'doctype' ? handleCloseRequest : handleBack}
                            disabled={emission.state.isEmitting}
                        >
                            {step === 'doctype' ? 'Cancelar' : 'Atrás'}
                        </Button>

                        {isLastStep ? (
                            <Button
                                type="button"
                                onClick={handleEmit}
                                disabled={emission.state.isEmitting || !form.config}
                                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
                            >
                                {emission.state.isEmitting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Emitiendo...</>
                                ) : (
                                    `Emitir ${form.docLabel}`
                                )}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[100px]"
                            >
                                Siguiente
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Discard confirmation */}
            <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Tienes una factura en curso
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tienes datos ingresados en este documento. ¿Deseas descartarla?
                            El borrador se guardará y podrás recuperarlo la próxima vez que abras el asistente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>
                            Seguir editando
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDiscard}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Descartar y cerrar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Emission result modal */}
            <InvoiceEmissionResult
                isOpen={emission.state.showResultModal}
                onClose={handleResultClose}
                data={resultData}
            />
        </>
    );
}
