'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Estado de un archivo Excel en la cola de emisión
 */
export interface ExcelFileState {
  id: string;
  file: File;
  status: 'uploading' | 'parsing' | 'parsed' | 'validating' | 'ready' | 'emitting' | 'success' | 'error';
  progress: number; // 0-100
  error?: string;
  parsedData?: ParsedInvoiceData[];
  validationErrors?: ValidationError[];
}

/**
 * Datos de una factura parseada desde Excel
 */
export interface ParsedInvoiceData {
  rowIndex: number;
  clientRuc?: string;
  clientDv?: string;
  clientName?: string;
  items: ParsedInvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  isValid: boolean;
  errors: string[];
}

/**
 * Item de factura parseado
 */
export interface ParsedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * Error de validación
 */
export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Estado de emisión en batch
 */
export interface EmissionProgress {
  totalInvoices: number;
  processedInvoices: number;
  successfulInvoices: number;
  failedInvoices: number;
  currentInvoiceIndex: number;
  isEmitting: boolean;
  results: EmissionResult[];
}

/**
 * Resultado de emisión individual
 */
export interface EmissionResult {
  rowIndex: number;
  success: boolean;
  cufe?: string;
  cafe?: string;
  invoiceId?: string;
  error?: string;
  pdfUrl?: string;
  xmlUrl?: string;
}

/**
 * Store de Zustand para la emisión
 */
interface EmissionStore {
  // Estado
  files: ExcelFileState[];
  currentStep: 'upload' | 'preview' | 'emit';
  emissionProgress: EmissionProgress | null;

  // Acciones - Gestión de archivos
  addFile: (file: File) => string;
  removeFile: (fileId: string) => void;
  updateFileStatus: (fileId: string, status: ExcelFileState['status'], progress?: number) => void;
  setFileParsedData: (fileId: string, data: ParsedInvoiceData[]) => void;
  setFileError: (fileId: string, error: string) => void;
  clearFiles: () => void;

  // Acciones - Navegación
  setStep: (step: 'upload' | 'preview' | 'emit') => void;
  nextStep: () => void;
  previousStep: () => void;

  // Acciones - Edición de datos
  updateInvoiceData: (fileId: string, rowIndex: number, data: Partial<ParsedInvoiceData>) => void;

  // Acciones - Emisión
  startEmission: (totalInvoices: number) => void;
  updateEmissionProgress: (update: Partial<EmissionProgress>) => void;
  addEmissionResult: (result: EmissionResult) => void;
  resetEmission: () => void;
}

export const useEmissionStore = create<EmissionStore>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      files: [],
      currentStep: 'upload',
      emissionProgress: null,

      // Gestión de archivos
      addFile: (file: File) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          files: [
            ...state.files,
            {
              id,
              file,
              status: 'uploading',
              progress: 0,
            },
          ],
        }));
        return id;
      },

      removeFile: (fileId: string) => {
        set((state) => ({
          files: state.files.filter((f) => f.id !== fileId),
        }));
      },

      updateFileStatus: (fileId: string, status: ExcelFileState['status'], progress?: number) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId
              ? { ...f, status, progress: progress ?? f.progress }
              : f
          ),
        }));
      },

      setFileParsedData: (fileId: string, data: ParsedInvoiceData[]) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId
              ? { ...f, parsedData: data, status: 'parsed', progress: 100 }
              : f
          ),
        }));
      },

      setFileError: (fileId: string, error: string) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId
              ? { ...f, error, status: 'error' }
              : f
          ),
        }));
      },

      clearFiles: () => {
        set({ files: [] });
      },

      // Navegación
      setStep: (step: 'upload' | 'preview' | 'emit') => {
        set({ currentStep: step });
      },

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep === 'upload') {
          set({ currentStep: 'preview' });
        } else if (currentStep === 'preview') {
          set({ currentStep: 'emit' });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep === 'emit') {
          set({ currentStep: 'preview' });
        } else if (currentStep === 'preview') {
          set({ currentStep: 'upload' });
        }
      },

      // Edición de datos
      updateInvoiceData: (fileId: string, rowIndex: number, data: Partial<ParsedInvoiceData>) => {
        set((state) => ({
          files: state.files.map((f) => {
            if (f.id !== fileId || !f.parsedData) return f;

            return {
              ...f,
              parsedData: f.parsedData.map((invoice) =>
                invoice.rowIndex === rowIndex
                  ? { ...invoice, ...data }
                  : invoice
              ),
            };
          }),
        }));
      },

      // Emisión
      startEmission: (totalInvoices: number) => {
        set({
          emissionProgress: {
            totalInvoices,
            processedInvoices: 0,
            successfulInvoices: 0,
            failedInvoices: 0,
            currentInvoiceIndex: 0,
            isEmitting: true,
            results: [],
          },
        });
      },

      updateEmissionProgress: (update: Partial<EmissionProgress>) => {
        set((state) => ({
          emissionProgress: state.emissionProgress
            ? { ...state.emissionProgress, ...update }
            : null,
        }));
      },

      addEmissionResult: (result: EmissionResult) => {
        set((state) => {
          if (!state.emissionProgress) return state;

          const successfulInvoices = state.emissionProgress.successfulInvoices + (result.success ? 1 : 0);
          const failedInvoices = state.emissionProgress.failedInvoices + (result.success ? 0 : 1);
          const processedInvoices = state.emissionProgress.processedInvoices + 1;

          return {
            emissionProgress: {
              ...state.emissionProgress,
              results: [...state.emissionProgress.results, result],
              processedInvoices,
              successfulInvoices,
              failedInvoices,
              currentInvoiceIndex: processedInvoices,
              isEmitting: processedInvoices < state.emissionProgress.totalInvoices,
            },
          };
        });
      },

      resetEmission: () => {
        set({
          emissionProgress: null,
          files: [],
          currentStep: 'upload',
        });
      },
    }),
    {
      name: 'emission-store',
    }
  )
);
