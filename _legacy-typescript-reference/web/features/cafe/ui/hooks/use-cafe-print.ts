'use client';

import { useState } from 'react';
import { buildCafeEscposBuffer } from '@/features/cafe/model/services/cafe-escpos.service';
import {
  invoiceToCAFEEscposInput,
  type InvoiceForCAFE,
} from '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper';
import { sendToPrintDaemon } from '@/features/cafe/infrastructure/print-daemon.client';
import type { PrintResult } from '@/features/cafe/model/types';

interface UseCafePrintOptions {
  paperWidth?: 58 | 80;
  printerDpi?: number;
  daemonPort?: number;
}

export function useCafePrint(options: UseCafePrintOptions = {}) {
  const { paperWidth = 80, printerDpi = 203, daemonPort } = options;

  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function printCafe(invoice: InvoiceForCAFE): Promise<PrintResult> {
    setIsPrinting(true);
    setError(null);

    try {
      const input = invoiceToCAFEEscposInput(invoice, { paperWidth, printerDpi });
      const buffer = await buildCafeEscposBuffer(input);
      const result = await sendToPrintDaemon(buffer, { port: daemonPort });

      if (!result.success) {
        setError(result.error ?? 'Error desconocido');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar la cinta';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsPrinting(false);
    }
  }

  return { printCafe, isPrinting, error };
}
