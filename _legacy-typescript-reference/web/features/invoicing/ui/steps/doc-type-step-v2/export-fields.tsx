'use client';

import { Label } from '@shared/ui/label';
import { Input } from '@shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Info, Globe } from 'lucide-react';
import { INCOTERMS_DGI, type IncotermCode } from '@/lib/constants/incoterms';
import type { ExportFormData } from '@/shared/hooks/use-document-form';

interface ExportFieldsProps {
    value: ExportFormData;
    onChange: (data: Partial<ExportFormData>) => void;
}

export function ExportFields({ value, onChange }: ExportFieldsProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">Datos de Exportación (gFExp)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">INCOTERMS *</Label>
                    <Select
                        value={value.incoterm}
                        onValueChange={(v) => onChange({ incoterm: v })}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11">
                            <SelectValue placeholder="Seleccionar condición de entrega..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(INCOTERMS_DGI) as IncotermCode[]).map((code) => (
                                <SelectItem key={code} value={code}>
                                    {code} — {INCOTERMS_DGI[code]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Moneda</Label>
                    <Input
                        value={value.currency}
                        onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
                        placeholder="USD"
                        maxLength={3}
                        className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                    />
                    <p className="text-[10px] text-gray-400">Código ISO 4217 (ej: USD, EUR, COP). Dejar USD si factura en dólares.</p>
                </div>

                {value.currency === 'ZZZ' && (
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción Moneda *</Label>
                        <Input
                            value={value.currencyDesc}
                            onChange={(e) => onChange({ currencyDesc: e.target.value })}
                            placeholder="Nombre de la moneda"
                            className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                        />
                    </div>
                )}

                {value.currency && value.currency !== 'USD' && (
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasa de Cambio *</Label>
                        <Input
                            value={value.exchangeRate}
                            onChange={(e) => onChange({ exchangeRate: e.target.value })}
                            placeholder="Ej: 0.92"
                            type="number"
                            step="0.0001"
                            className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                        />
                        <p className="text-[10px] text-gray-400">Equivalencia de 1 USD en la moneda indicada.</p>
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto en Moneda Extranjera</Label>
                    <Input
                        value={value.foreignAmount}
                        onChange={(e) => onChange({ foreignAmount: e.target.value })}
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Puerto de Embarque</Label>
                    <Input
                        value={value.port}
                        onChange={(e) => onChange({ port: e.target.value })}
                        placeholder="Ej: Puerto de Balboa"
                        className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                    />
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex gap-2">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>DGI gFExp:</strong> Los campos de INCOTERMS son obligatorios para facturas de exportación.
                        La moneda y tasa de cambio son obligatorios si la factura no es en USD.
                    </div>
                </div>
            </div>
        </div>
    );
}
