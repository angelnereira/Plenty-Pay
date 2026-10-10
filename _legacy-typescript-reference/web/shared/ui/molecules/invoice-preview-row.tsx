'use client';

import { useState } from 'react';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Check, X, Pencil, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedInvoiceData } from '@/lib/stores/emission-store';

interface InvoicePreviewRowProps {
  invoice: ParsedInvoiceData;
  onUpdate: (data: Partial<ParsedInvoiceData>) => void;
  onDelete?: () => void;
  className?: string;
}

/**
 * Componente Molecule: InvoicePreviewRow
 *
 * Fila de la tabla de previsualización que permite editar celdas antes de enviar.
 * Soporta edición inline y validación en tiempo real.
 */
export function InvoicePreviewRow({
  invoice,
  onUpdate,
  onDelete,
  className,
}: InvoicePreviewRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ParsedInvoiceData>>(invoice);

  const handleSave = () => {
    onUpdate(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData(invoice);
    setIsEditing(false);
  };

  const handleFieldChange = (field: keyof ParsedInvoiceData, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Calcular si hay errores de validación
  const hasErrors = invoice.errors && invoice.errors.length > 0;

  return (
    <>
      <tr
        className={cn(
          'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
          hasErrors && 'bg-red-50 dark:bg-red-900/10',
          className
        )}
      >
        {/* Row Index */}
        <td className="p-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
          #{invoice.rowIndex + 1}
        </td>

        {/* RUC Cliente */}
        <td className="p-3">
          {isEditing ? (
            <Input
              value={editedData.clientRuc || ''}
              onChange={(e) => handleFieldChange('clientRuc', e.target.value)}
              className="h-8 text-sm"
              placeholder="RUC"
            />
          ) : (
            <span className={cn(
              'text-sm',
              !invoice.clientRuc && 'text-red-600 dark:text-red-400'
            )}>
              {invoice.clientRuc || 'N/A'}
            </span>
          )}
        </td>

        {/* DV */}
        <td className="p-3">
          {isEditing ? (
            <Input
              value={editedData.clientDv || ''}
              onChange={(e) => handleFieldChange('clientDv', e.target.value)}
              className="h-8 text-sm w-16"
              placeholder="DV"
              maxLength={2}
            />
          ) : (
            <span className="text-sm">{invoice.clientDv || '-'}</span>
          )}
        </td>

        {/* Cliente */}
        <td className="p-3">
          {isEditing ? (
            <Input
              value={editedData.clientName || ''}
              onChange={(e) => handleFieldChange('clientName', e.target.value)}
              className="h-8 text-sm"
              placeholder="Nombre del cliente"
            />
          ) : (
            <span className="text-sm font-medium">{invoice.clientName || 'Sin nombre'}</span>
          )}
        </td>

        {/* Items (concatenados) */}
        <td className="p-3">
          {isEditing ? (
            <Input
              value={editedData.items?.[0]?.description || ''}
              onChange={(e) =>
                setEditedData((prev) => ({
                  ...prev,
                  items: [
                    {
                      ...(prev.items?.[0] || {
                        quantity: 1,
                        unitPrice: 0,
                        taxRate: 0.07,
                        subtotal: 0,
                        taxAmount: 0,
                        total: 0,
                      }),
                      description: e.target.value,
                    },
                  ],
                }))
              }
              className="h-8 text-sm"
              placeholder="Descripción"
            />
          ) : (
            <span className="text-sm">
              {invoice.items.map((item) => item.description).join(', ')}
            </span>
          )}
        </td>

        {/* Cantidad */}
        <td className="p-3 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={editedData.items?.[0]?.quantity || 0}
              onChange={(e) =>
                setEditedData((prev) => ({
                  ...prev,
                  items: [
                    {
                      ...(prev.items?.[0] || {
                        description: '',
                        unitPrice: 0,
                        taxRate: 0.07,
                        subtotal: 0,
                        taxAmount: 0,
                        total: 0,
                      }),
                      quantity: parseFloat(e.target.value) || 0,
                    },
                  ],
                }))
              }
              className="h-8 text-sm w-20 text-right"
              min="0"
              step="1"
            />
          ) : (
            <span className="text-sm font-mono">
              {invoice.items.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </td>

        {/* Precio Unitario */}
        <td className="p-3 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={editedData.items?.[0]?.unitPrice || 0}
              onChange={(e) =>
                setEditedData((prev) => ({
                  ...prev,
                  items: [
                    {
                      ...(prev.items?.[0] || {
                        description: '',
                        quantity: 1,
                        taxRate: 0.07,
                        subtotal: 0,
                        taxAmount: 0,
                        total: 0,
                      }),
                      unitPrice: parseFloat(e.target.value) || 0,
                    },
                  ],
                }))
              }
              className="h-8 text-sm w-24 text-right"
              min="0"
              step="0.01"
            />
          ) : (
            <span className="text-sm font-mono">
              ${invoice.items[0]?.unitPrice.toFixed(2)}
            </span>
          )}
        </td>

        {/* Total */}
        <td className="p-3 text-right">
          <span className="text-sm font-semibold font-mono">
            ${invoice.total.toFixed(2)}
          </span>
        </td>

        {/* Estado */}
        <td className="p-3">
          {invoice.isValid ? (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span className="text-xs">Válido</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Error</span>
            </div>
          )}
        </td>

        {/* Acciones */}
        <td className="p-3">
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={handleSave}
                  title="Guardar cambios"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                  onClick={handleCancel}
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsEditing(true)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={onDelete}
                    title="Eliminar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Fila de errores (si existen) */}
      {hasErrors && (
        <tr className="bg-red-50 dark:bg-red-900/10">
          <td colSpan={10} className="p-3">
            <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Errores de validación:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {invoice.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
