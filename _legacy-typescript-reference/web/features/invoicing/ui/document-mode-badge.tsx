'use client';

import type { DocumentMode } from '@/shared/hooks/use-document-form';

const MODE_CONFIG: Record<DocumentMode, { label: string; className: string }> = {
  FACTURA:              { label: 'Tipo 01', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  FACTURA_IMPORTACION:  { label: 'Tipo 02', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  FACTURA_EXPORTACION:  { label: 'Tipo 03', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  NOTA_CREDITO:         { label: 'NC', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' },
  NOTA_DEBITO:          { label: 'ND', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  FACTURA_ZONA_FRANCA:  { label: 'Tipo 08', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  REEMBOLSO:            { label: 'Tipo 09', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  FACTURA_EXTRANJERA:   { label: 'Tipo 10', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
};

interface DocumentModeBadgeProps {
  mode: DocumentMode;
}

export function DocumentModeBadge({ mode }: DocumentModeBadgeProps) {
  const { label, className } = MODE_CONFIG[mode];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
      {label}
    </span>
  );
}
