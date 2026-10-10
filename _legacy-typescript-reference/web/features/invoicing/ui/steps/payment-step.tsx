'use client';

import { useEffect, useCallback } from 'react';
import { CreditCard, FileCheck, AlertCircle } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import type { UseDocumentFormReturn } from '@/shared/hooks/use-document-form';
import { useInvoicePreferences } from '@/shared/hooks/use-invoice-preferences';

// ── Constants ────────────────────────────────────────────────────────────────

const FORMAS_PAGO = [
    { value: '01', label: 'Crédito' },
    { value: '02', label: 'Efectivo' },
    { value: '03', label: 'Tarjeta de Crédito' },
    { value: '04', label: 'Tarjeta de Débito' },
    { value: '08', label: 'Transferencia/Depósito' },
    { value: '09', label: 'Cheque' },
    { value: '99', label: 'Otro' },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface PaymentStepProps {
    form: UseDocumentFormReturn;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PaymentStep({ form }: PaymentStepProps) {
    const { paymentData, setPaymentData } = form;
    const { prefs, setPref } = useInvoicePreferences(form.clientData.motorEntityId ?? null);

    useEffect(() => {
        if (prefs.formaPagoFact && paymentData.formaPagoFact === '02') {
            setPaymentData({ formaPagoFact: prefs.formaPagoFact });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefs.formaPagoFact]);

    const handleFormaPagoChange = useCallback((value: string) => {
        setPaymentData({ formaPagoFact: value });
        setPref('formaPagoFact', value);
    }, [setPaymentData, setPref]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Forma de Pago */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Forma de Pago</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Método de Pago *</Label>
                        <Select
                            value={paymentData.formaPagoFact}
                            onValueChange={handleFormaPagoChange}
                        >
                            <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FORMAS_PAGO.map(forma => (
                                    <SelectItem key={forma.value} value={forma.value}>
                                        {forma.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {paymentData.formaPagoFact === '99' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción del Pago *</Label>
                            <Input
                                value={paymentData.descFormaPago}
                                onChange={(e) => setPaymentData({ descFormaPago: e.target.value })}
                                placeholder="Especifique el detalle (Ej: Transferencia ACH)"
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                            />
                            <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Requerido para &apos;Otros&apos;
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Información Adicional */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Información Adicional</h3>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notas / Observaciones</Label>
                    <Textarea
                        value={paymentData.informacionInteres}
                        onChange={(e) => setPaymentData({ informacionInteres: e.target.value })}
                        placeholder="Información adicional visible en la factura..."
                        className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 min-h-[100px]"
                    />
                </div>
            </div>
        </div>
    );
}
