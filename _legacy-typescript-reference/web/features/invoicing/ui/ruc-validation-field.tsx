'use client';

import { useState } from 'react';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';

interface RucValidationFieldProps {
  value: string;
  onRucChange: (ruc: string) => void;
  onDataFound?: (dv: string, razonSocial: string) => void;
  required?: boolean;
  disabled?: boolean;
}

/**
 * RUC Validation Field
 * Componente para validar RUC contra HKA con DGI verification
 * Integra el método "Consultar RUC/DV" de forma contextual en el formulario
 */
export function RucValidationField({
  value,
  onRucChange,
  onDataFound,
  required = true,
  disabled = false,
}: RucValidationFieldProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    dv?: string;
    razonSocial?: string;
  }>({
    status: null,
    message: '',
  });

  const handleValidateRUC = async () => {
    if (!value.trim()) {
      setValidationResult({
        status: 'error',
        message: 'Por favor ingresa el RUC',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult({ status: null, message: '' });

    try {
      const response = await fetch('/api/hka/consultar-ruc-dv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruc: value }),
      });

      const data = await response.json();

      if (data.success) {
        const result = data.data;
        setValidationResult({
          status: 'success',
          message: `✓ RUC Válido - ${result.razonSocial}`,
          dv: result.dv,
          razonSocial: result.razonSocial,
        });

        // Callback para actualizar el formulario padre
        if (onDataFound) {
          onDataFound(result.dv, result.razonSocial);
        }
      } else {
        setValidationResult({
          status: 'error',
          message: data.error || 'Error al validar RUC',
        });
      }
    } catch (err: any) {
      setValidationResult({
        status: 'error',
        message: err.message || 'Error de conexión al validar RUC',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const hasValidation = validationResult.status !== null;
  const isSuccess = validationResult.status === 'success';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        RUC / Cédula {required && '*'}
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onRucChange(e.target.value);
            // Reset validation when user changes the RUC
            if (validationResult.status !== null) {
              setValidationResult({ status: null, message: '' });
            }
          }}
          placeholder="Ej: 12345678-1-2023"
          disabled={disabled || isValidating}
          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
            hasValidation
              ? isSuccess
                ? 'border-green-500 focus:ring-green-500 bg-green-50 dark:bg-green-900/10'
                : 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10'
              : 'border-gray-300 focus:ring-indigo-500 focus:ring-indigo-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          required={required}
        />

        <button
          type="button"
          onClick={handleValidateRUC}
          disabled={isValidating || !value.trim() || disabled}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            isValidating
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              : hasValidation && isSuccess
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isValidating ? (
            <>
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : hasValidation && isSuccess ? (
            <>
              <Check className="inline mr-2 h-4 w-4" />
              Válido
            </>
          ) : (
            'Verificar DGI'
          )}
        </button>
      </div>

      {/* Validation feedback */}
      {hasValidation && (
        <div
          className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
            isSuccess
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {isSuccess ? (
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <p
            className={
              isSuccess
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }
          >
            {validationResult.message}
          </p>
        </div>
      )}

      {/* Extra info when validation succeeds */}
      {isSuccess && validationResult.dv && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Dígito Verificador: {validationResult.dv}</p>
          {validationResult.razonSocial && (
            <p className="text-xs mt-1">Razón Social: {validationResult.razonSocial}</p>
          )}
        </div>
      )}
    </div>
  );
}
