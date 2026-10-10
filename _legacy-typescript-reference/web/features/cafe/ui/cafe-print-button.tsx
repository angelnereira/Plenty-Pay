'use client';

import { Printer, Loader2 } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { useCafePrint } from './hooks/use-cafe-print';
import type { InvoiceForCAFE } from '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper';

interface CafePrintButtonProps {
  invoice: InvoiceForCAFE;
  paperWidth?: 58 | 80;
}

export function CafePrintButton({ invoice, paperWidth = 80 }: CafePrintButtonProps) {
  const { printCafe, isPrinting } = useCafePrint({ paperWidth });
  const { toast } = useToast();

  async function handleClick() {
    const result = await printCafe(invoice);
    if (result.success) {
      toast({ title: 'Cinta enviada a impresora', variant: 'default' });
    } else {
      toast({
        title: 'Sin impresora',
        description: result.error ?? 'Reintentar cuando el daemon esté activo.',
        variant: 'destructive',
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPrinting}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 active:scale-95 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      <div className="text-blue-500 group-hover:text-blue-400 transition-colors">
        {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Cinta POS</span>
    </button>
  );
}
