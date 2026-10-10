'use client';

import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

interface TerceroFieldsProps {
    rucTercero: string;
    numeroDocumentoTercero: string;
    onRucChange: (v: string) => void;
    onNumeroChange: (v: string) => void;
}

export function TerceroFields({ rucTercero, numeroDocumentoTercero, onRucChange, onNumeroChange }: TerceroFieldsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase">RUC del Tercero</Label>
                <Input
                    value={rucTercero}
                    onChange={(e) => onRucChange(e.target.value)}
                    placeholder="Ej: 8-888-8888"
                    className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase">N° Factura del Tercero</Label>
                <Input
                    value={numeroDocumentoTercero}
                    onChange={(e) => onNumeroChange(e.target.value)}
                    placeholder="Ej: FE-001-00001"
                    className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                />
            </div>
        </div>
    );
}
