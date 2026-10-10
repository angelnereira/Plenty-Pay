'use client';

import type { DocumentMode } from '@/shared/hooks/use-document-form';
import { cn } from '@/lib/utils';
import {
    Receipt, Ship, ArrowDownUp, Warehouse, Globe, RefreshCw,
    FileMinus, FilePlus,
    Check,
} from 'lucide-react';

interface DocTypeOption {
    mode: DocumentMode;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
}

const DOC_TYPE_OPTIONS: DocTypeOption[] = [
    {
        mode: 'FACTURA',
        label: 'Factura',
        description: 'Venta de bienes o servicios dentro de Panamá (01)',
        icon: Receipt,
        activeClass: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500/60',
    },
    {
        mode: 'FACTURA_EXPORTACION',
        label: 'Factura de Exportación',
        description: 'Venta a clientes en el extranjero (03)',
        icon: Ship,
        activeClass: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500/60',
    },
    {
        mode: 'FACTURA_IMPORTACION',
        label: 'Factura de Importación',
        description: 'Compra desde el extranjero (02)',
        icon: ArrowDownUp,
        activeClass: 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-500/60',
    },
    {
        mode: 'FACTURA_ZONA_FRANCA',
        label: 'Factura de Zona Franca',
        description: 'Operaciones en zona franca (08)',
        icon: Warehouse,
        activeClass: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/60',
    },
    {
        mode: 'FACTURA_EXTRANJERA',
        label: 'Factura Extranjera',
        description: 'Operación con entidad extranjera (10)',
        icon: Globe,
        activeClass: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 dark:border-cyan-500/60',
    },
    {
        mode: 'REEMBOLSO',
        label: 'Reembolso',
        description: 'Reembolso de gastos (09)',
        icon: RefreshCw,
        activeClass: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500/60',
    },
    {
        mode: 'NOTA_CREDITO',
        label: 'Nota de Crédito',
        description: 'Ajuste o anulación de factura (04/06)',
        icon: FileMinus,
        activeClass: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/60',
    },
    {
        mode: 'NOTA_DEBITO',
        label: 'Nota de Débito',
        description: 'Cargo adicional a factura (05/07)',
        icon: FilePlus,
        activeClass: 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-500/60',
    },
];

interface TypeGridProps {
    selected: DocumentMode;
    onSelect: (mode: DocumentMode) => void;
}

export function TypeGrid({ selected, onSelect }: TypeGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOC_TYPE_OPTIONS.map(({ mode, label, description, icon: Icon, activeClass }) => (
                <button
                    key={mode}
                    type="button"
                    onClick={() => onSelect(mode)}
                    className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        selected === mode
                            ? activeClass
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className={selected === mode ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}>
                            <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {label}
                        </span>
                        {selected === mode && (
                            <Check className="h-3.5 w-3.5 ml-auto text-purple-600 dark:text-purple-400" />
                        )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                </button>
            ))}
        </div>
    );
}
