"use client";

import { useState } from "react";
import { Tag, Percent, DollarSign, X, Check } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/hooks/use-toast";
import type { Discount } from "../types/pos-types";

interface LineDiscountControlProps {
    /** Subtotal de la línea (price × quantity) en B/. */
    lineSubtotal: number;
    /** Descuento actual de la línea (null si no hay). */
    lineDiscount?: Discount | null;
    /** Aplica un descuento o lo limpia (null). */
    onChange: (discount: Discount | null) => void;
    /** Modo compacto para celdas de tabla / cart row. */
    compact?: boolean;
}

/**
 * Control reutilizable de descuento por-línea de carrito.
 *
 * Muestra:
 *   - Botón "+ Descuento" cuando no hay descuento.
 *   - Mini-form (PERCENTAGE / FIXED + valor + aplicar/cancelar) al editar.
 *   - Badge verde con el descuento activo y botón X para quitarlo.
 *
 * Reglas:
 *   - PERCENTAGE: valor 0..100. Más de 100 se rechaza.
 *   - FIXED: valor en B/.; debe ser estrictamente menor que lineSubtotal
 *            (regla HKA: precioUnitarioDescuento < precioUnitario).
 */
export function LineDiscountControl({
    lineSubtotal,
    lineDiscount,
    onChange,
    compact,
}: LineDiscountControlProps) {
    const [editing, setEditing] = useState(false);
    const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>(
        lineDiscount?.type ?? 'PERCENTAGE'
    );
    const [value, setValue] = useState<string>(
        lineDiscount ? String(lineDiscount.value) : ''
    );
    const { toast } = useToast();

    const apply = () => {
        const v = parseFloat(value);
        if (!Number.isFinite(v) || v <= 0) {
            toast({
                variant: 'destructive',
                title: 'Descuento inválido',
                description: 'Ingrese un valor mayor a 0.',
            });
            return;
        }
        if (type === 'PERCENTAGE' && v > 100) {
            toast({
                variant: 'destructive',
                title: 'Porcentaje inválido',
                description: 'No puede exceder 100%.',
            });
            return;
        }
        if (type === 'FIXED' && v >= lineSubtotal) {
            // HKA exige precioUnitarioDescuento < precioUnitario; al nivel de
            // línea se traduce a descuento < lineSubtotal para no anular la
            // venta del ítem.
            toast({
                variant: 'destructive',
                title: 'Descuento excede el ítem',
                description: `Debe ser menor a $${lineSubtotal.toFixed(2)}.`,
            });
            return;
        }
        onChange({ type, value: v });
        setEditing(false);
    };

    const remove = () => {
        onChange(null);
        setValue('');
        setEditing(false);
    };

    if (lineDiscount && !editing) {
        const label =
            lineDiscount.type === 'PERCENTAGE'
                ? `${lineDiscount.value}%`
                : `$${lineDiscount.value.toFixed(2)}`;
        return (
            <div
                className={`flex items-center gap-1.5 ${compact ? '' : 'pt-1'}`}
                data-testid="line-discount-applied"
            >
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40"
                >
                    <Tag className="h-3 w-3" />
                    {label} desc
                </button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-gray-400 hover:text-red-500"
                    onClick={remove}
                    aria-label="Quitar descuento"
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        );
    }

    if (!editing) {
        return (
            <button
                type="button"
                onClick={() => setEditing(true)}
                className={`inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 dark:border-white/[0.15] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 ${compact ? '' : 'mt-1'}`}
                aria-label="Agregar descuento a esta línea"
            >
                <Tag className="h-3 w-3" />
                + Descuento
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Editor de descuento">
            <div className="flex rounded-md border dark:border-white/[0.15] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setType('PERCENTAGE')}
                    className={`flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold ${type === 'PERCENTAGE' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                    aria-pressed={type === 'PERCENTAGE'}
                >
                    <Percent className="h-2.5 w-2.5" />%
                </button>
                <button
                    type="button"
                    onClick={() => setType('FIXED')}
                    className={`flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold ${type === 'FIXED' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
                    aria-pressed={type === 'FIXED'}
                >
                    <DollarSign className="h-2.5 w-2.5" />B/.
                </button>
            </div>
            <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={type === 'PERCENTAGE' ? '10' : '5.00'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') apply();
                }}
                className="h-7 w-20 text-xs font-bold"
                aria-label="Valor del descuento"
            />
            <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-600 hover:bg-green-50"
                onClick={apply}
                aria-label="Aplicar descuento"
            >
                <Check className="h-4 w-4" />
            </Button>
            <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-gray-400"
                onClick={() => setEditing(false)}
                aria-label="Cancelar"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
