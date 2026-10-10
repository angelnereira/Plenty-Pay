'use client';

import { Label } from '@shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { ArrowDownUp } from 'lucide-react';
import type { ImportData } from '@/shared/hooks/use-document-form';

// Países más comunes de importación para Panamá
const PAISES_IMPORTACION = [
    { code: 'US', name: 'Estados Unidos' },
    { code: 'CN', name: 'China' },
    { code: 'MX', name: 'México' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'CO', name: 'Colombia' },
    { code: 'DE', name: 'Alemania' },
    { code: 'ES', name: 'España' },
    { code: 'IT', name: 'Italia' },
    { code: 'JP', name: 'Japón' },
];

interface ImportFieldsProps {
    value: ImportData;
    onChange: (data: Partial<ImportData>) => void;
}

export function ImportFields({ value, onChange }: ImportFieldsProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                <ArrowDownUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">Datos de Importación</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">País de Origen</Label>
                    <Select value={value.paisOrigen} onValueChange={(v) => onChange({ paisOrigen: v })}>
                        <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAISES_IMPORTACION.map((p) => (
                                <SelectItem key={p.code} value={p.code}>
                                    {p.code} — {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
