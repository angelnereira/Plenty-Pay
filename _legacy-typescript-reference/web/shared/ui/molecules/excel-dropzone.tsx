'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@shared/ui/button';

interface ExcelDropzoneProps {
  onFileAccepted: (file: File) => void;
  onFileRejected?: (error: string) => void;
  maxSize?: number; // en bytes
  acceptedFormats?: string[];
  className?: string;
}

/**
 * Componente Molecule: ExcelDropzone
 *
 * Zona de carga de archivos Excel con validación de extensión.
 * Soporta drag & drop y selección manual.
 */
export function ExcelDropzone({
  onFileAccepted,
  onFileRejected,
  maxSize = 10 * 1024 * 1024, // 10MB por defecto
  acceptedFormats = ['.xlsx', '.xls', '.csv'],
  className,
}: ExcelDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      // Manejar archivos rechazados
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        let errorMessage = 'Archivo no válido';

        if (rejection.errors?.[0]?.code === 'file-too-large') {
          errorMessage = `El archivo es demasiado grande. Máximo ${Math.round(maxSize / 1024 / 1024)}MB`;
        } else if (rejection.errors?.[0]?.code === 'file-invalid-type') {
          errorMessage = `Formato no válido. Solo se aceptan ${acceptedFormats.join(', ')}`;
        }

        setError(errorMessage);
        onFileRejected?.(errorMessage);
        return;
      }

      // Manejar archivo aceptado
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Validación adicional de extensión
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedFormats.includes(extension)) {
          const errorMessage = `Formato no válido. Solo se aceptan ${acceptedFormats.join(', ')}`;
          setError(errorMessage);
          onFileRejected?.(errorMessage);
          return;
        }

        setSelectedFile(file);
        onFileAccepted(file);
      }
    },
    [maxSize, acceptedFormats, onFileAccepted, onFileRejected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxSize,
    multiple: false,
  });

  const removeFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer',
          'hover:border-primary hover:bg-primary/5',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isDragActive && !isDragReject && 'border-primary bg-primary/10',
          isDragReject && 'border-red-500 bg-red-50',
          error && 'border-red-500 bg-red-50 dark:bg-red-900/10',
          selectedFile && 'border-green-500 bg-green-50 dark:bg-green-900/10'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center text-center">
          {selectedFile ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                Archivo seleccionado
              </p>
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                <File className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                {error}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Intenta de nuevo con otro archivo
              </p>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-12 w-12 text-primary mb-4 animate-bounce" />
              <p className="text-sm font-medium text-primary mb-2">
                Suelta el archivo aquí
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Arrastra y suelta tu archivo Excel aquí
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                o haz clic para seleccionar
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Formatos aceptados: {acceptedFormats.join(', ')}</span>
                <span>•</span>
                <span>Máx. {Math.round(maxSize / 1024 / 1024)}MB</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Formato esperado del Excel:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Primera fila: encabezados de columnas</li>
              <li>Columnas requeridas: RUC Cliente, Descripción, Cantidad, Precio Unitario</li>
              <li>Cada fila representa una factura</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Variante compacta del ExcelDropzone
 */
export function ExcelDropzoneCompact({
  onFileAccepted,
  className,
}: Pick<ExcelDropzoneProps, 'onFileAccepted' | 'className'>) {
  return (
    <ExcelDropzone
      onFileAccepted={onFileAccepted}
      maxSize={10 * 1024 * 1024}
      className={cn('max-w-md', className)}
    />
  );
}
