'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateBillingCardMode, BillingCardMode } from '@/actions/user-preferences';
import { Loader2, Eye, EyeOff, Lock, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillingModeSelectorProps {
    currentMode: BillingCardMode;
}

export function BillingModeSelector({ currentMode }: BillingModeSelectorProps) {
    const [mode, setMode] = useState<BillingCardMode>(currentMode);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await updateBillingCardMode(mode);
            if (result.success) {
                toast.success('Preferencia actualizada correctamente');
            } else {
                toast.error('Error al actualizar la preferencia');
            }
        } catch (error) {
            toast.error('Ocurrió un error inesperado');
        } finally {
            setIsLoading(false);
        }
    };

    const options = [
        {
            value: 'DEFAULT',
            label: 'Estándar',
            description: 'Muestra el monto total de facturación claramente.',
            icon: LayoutTemplate,
            preview: '$8,207.35'
        },
        {
            value: 'DISCRETE',
            label: 'Discreto',
            description: 'Diseño minimalista y menos llamativo.',
            icon: Eye,
            preview: '$8,207.35',
            previewClass: 'text-sm font-medium text-muted-foreground'
        },
        {
            value: 'HIDDEN',
            label: 'Oculto',
            description: 'No muestra montos, solo conteo de documentos.',
            icon: EyeOff,
            preview: '---'
        },
        {
            value: 'MASKED',
            label: 'Protegido',
            description: 'Muestra ****** y requiere contraseña para ver.',
            icon: Lock,
            preview: '******'
        }
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Visualización de Facturación</CardTitle>
                <CardDescription>
                    Elige cómo quieres que se muestre la tarjeta de facturación total en tu dashboard principal.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <RadioGroup
                    value={mode}
                    onValueChange={(value) => setMode(value as BillingCardMode)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    {options.map((option) => (
                        <div key={option.value}>
                            <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
                            <Label
                                htmlFor={option.value}
                                onClick={() => setMode(option.value as BillingCardMode)}
                                className={cn(
                                    "flex flex-col justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all h-full",
                                    mode === option.value && "border-primary bg-primary/5 ring-2 ring-primary/20"
                                )}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn("p-2 rounded-lg bg-primary/10", mode === option.value ? "text-primary" : "text-muted-foreground")}>
                                        <option.icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-base">{option.label}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                    {option.description}
                                </p>
                                <div className="mt-auto pt-3 border-t border-dashed">
                                    <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Vista Previa</span>
                                    <div className={cn("text-2xl font-bold font-mono", option.previewClass)}>
                                        {option.preview}
                                    </div>
                                </div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={isLoading || mode === currentMode}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Preferencia
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
