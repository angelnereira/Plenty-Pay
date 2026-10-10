'use client';

/**
 * Invoice Numbering Configuration Component
 * 
 * Permite a los usuarios configurar desde qué número empezar a facturar.
 * Muestra el número actual, el próximo y permite establecer uno nuevo.
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, Hash, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { CollapsibleCard } from '@shared/ui/collapsible-card';
import { MobileConfigCard } from '@/components/settings/mobile/mobile-config-card';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Label } from '@shared/ui/label';

import {
    getInvoiceNumberingInfo,
    updateInvoiceNumbering,
} from '@/app/actions/invoice/update-invoice-numbering.action';

interface InvoiceNumberingConfigProps {
    variant?: 'desktop' | 'mobile';
}

export function InvoiceNumberingConfig({ variant = 'desktop' }: InvoiceNumberingConfigProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastNumber, setLastNumber] = useState<string | null>(null);
    const [nextNumber, setNextNumber] = useState<string>('');
    const [newNumber, setNewNumber] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Preview del formato
    const formattedPreview = newNumber
        ? String(parseInt(newNumber, 10) || 0).padStart(10, '0')
        : null;

    // Validación: cualquier número positivo de hasta 10 dígitos
    const parsedNewNumber = parseInt(newNumber, 10) || 0;
    const isValidNumber = parsedNewNumber >= 1 && parsedNewNumber <= 9999999999;

    useEffect(() => {
        loadNumberingInfo();
    }, []);

    async function loadNumberingInfo() {
        setIsLoading(true);
        try {
            const result = await getInvoiceNumberingInfo();
            if (result.success) {
                setLastNumber(result.lastNumber || null);
                setNextNumber(result.nextNumber || '');
            } else {
                setError(result.error || 'Error al cargar información');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSave() {
        if (!newNumber || !isValidNumber) {
            toast.error('Ingresa un número válido');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const result = await updateInvoiceNumbering(parsedNewNumber);
            if (result.success) {
                toast.success(`Numeración actualizada. Próxima factura: ${result.nextNumber}`);
                setNewNumber('');
                await loadNumberingInfo(); // Recargar datos
            } else {
                setError(result.error || 'Error al actualizar');
                toast.error(result.error || 'Error al actualizar');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error inesperado');
        } finally {
            setIsSaving(false);
        }
    }

    // Contenido compartido
    const renderContent = () => (
        <>
            {isLoading ? (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Current Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Última emitida</p>
                            <p className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                                {lastNumber || 'Ninguna'}
                            </p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Próxima</p>
                            <p className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
                                {nextNumber}
                            </p>
                        </div>
                    </div>

                    {/* Input for new number */}
                    <div className="space-y-2">
                        <Label className="text-sm text-gray-700 dark:text-slate-300">
                            Nuevo número inicial
                        </Label>
                        <Input
                            type="number"
                            placeholder="Ej: 3754"
                            value={newNumber}
                            onChange={(e) => setNewNumber(e.target.value)}
                            className="font-mono"
                            min={1}
                            max={9999999999}
                        />
                        {formattedPreview && (
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                Formato: <span className="font-mono font-medium">{formattedPreview}</span>
                            </p>
                        )}
                        {newNumber && !isValidNumber && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Ingresa un número entre 1 y 9999999999
                            </p>
                        )}
                        {newNumber && isValidNumber && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Válido
                            </p>
                        )}
                    </div>

                    {/* Save Button */}
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !newNumber || !isValidNumber}
                        className="w-full"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Actualizar Numeración
                            </>
                        )}
                    </Button>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-xs">
                            {error}
                        </div>
                    )}

                    {/* Info Note */}
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                        Si el número ya existe, se salta automáticamente al siguiente disponible
                    </p>
                </div>
            )}
        </>
    );

    // Vista Mobile
    if (variant === 'mobile') {
        return (
            <MobileConfigCard
                title="Numeración de Facturas"
                description="Configura desde qué número empezar"
                icon={Hash}
                iconColor="text-purple-500"
                defaultExpanded={false}
            >
                {renderContent()}
            </MobileConfigCard>
        );
    }

    // Vista Desktop
    return (
        <CollapsibleCard
            title="Numeración de Facturas"
            description="Configura desde qué número empezar a facturar."
            icon={Hash}
            iconColor="text-purple-500"
            defaultExpanded={false}
        >
            {renderContent()}
        </CollapsibleCard>
    );
}
