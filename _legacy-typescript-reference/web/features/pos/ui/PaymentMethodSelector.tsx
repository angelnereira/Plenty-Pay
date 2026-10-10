"use client";

import { usePosStore } from '../stores/pos.store';
import { Card } from '@shared/ui/card';
import { CreditCard, Banknote, ArrowLeftRight, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentMethod } from '../types/pos-types';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useEffect } from 'react';

interface PaymentMethodSelectorProps {
    variant?: 'desktop' | 'mobile';
}

const PAYMENT_METHODS = [
    { id: 'CASH' as PaymentMethod, label: 'Efectivo', icon: Banknote, color: 'text-green-600' },
    { id: 'CARD' as PaymentMethod, label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' },
    { id: 'TRANSFER' as PaymentMethod, label: 'Transferencia', icon: Smartphone, color: 'text-purple-600' },
    { id: 'MIXED' as PaymentMethod, label: 'Mixto', icon: ArrowLeftRight, color: 'text-orange-600' },
];

export function PaymentMethodSelector({ variant = 'desktop' }: PaymentMethodSelectorProps) {
    const { paymentMethod, setPaymentMethod, paymentDetails, setPaymentDetails, getTotal } = usePosStore();
    const total = getTotal();

    // Initialize payment details for MIXED
    useEffect(() => {
        if (paymentMethod === 'MIXED' && !paymentDetails) {
            setPaymentDetails({
                method: 'MIXED',
                cashAmount: 0,
                cardAmount: 0,
                transferAmount: 0
            });
        }
    }, [paymentMethod, paymentDetails, setPaymentDetails]);

    const handleMixedAmountChange = (field: 'cashAmount' | 'cardAmount' | 'transferAmount', value: string) => {
        const numValue = parseFloat(value) || 0;
        setPaymentDetails({
            ...paymentDetails,
            method: 'MIXED',
            [field]: numValue
        });
    };

    const mixedTotal = paymentMethod === 'MIXED' && paymentDetails
        ? (paymentDetails.cashAmount || 0) + (paymentDetails.cardAmount || 0) + (paymentDetails.transferAmount || 0)
        : 0;

    const mixedRemaining = total - mixedTotal;

    if (variant === 'mobile') {
        return (
            <div className="space-y-3">
                <Label className="text-sm font-medium">Método de Pago</Label>
                <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        const isSelected = paymentMethod === method.id;

                        return (
                            <Card
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id)}
                                className={cn(
                                    "p-4 cursor-pointer transition-all hover:scale-105 active:scale-95",
                                    isSelected
                                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-md"
                                        : "hover:border-gray-300 dark:hover:border-gray-600"
                                )}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <Icon className={cn("h-6 w-6", isSelected ? "text-violet-600" : method.color)} />
                                    <span className={cn(
                                        "text-sm font-medium text-center",
                                        isSelected ? "text-violet-600 dark:text-violet-400" : ""
                                    )}>
                                        {method.label}
                                    </span>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Mixed payment details */}
                {paymentMethod === 'MIXED' && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-white/[0.06] rounded-lg space-y-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Desglose de pago</p>

                        <div className="space-y-2">
                            <div>
                                <Label className="text-xs">Efectivo</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={paymentDetails?.cashAmount || 0}
                                    onChange={(e) => handleMixedAmountChange('cashAmount', e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Tarjeta</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={paymentDetails?.cardAmount || 0}
                                    onChange={(e) => handleMixedAmountChange('cardAmount', e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Transferencia</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={paymentDetails?.transferAmount || 0}
                                    onChange={(e) => handleMixedAmountChange('transferAmount', e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t dark:border-white/[0.08] text-sm">
                            <div className="flex justify-between">
                                <span>Pagado:</span>
                                <span className="font-medium">${mixedTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Restante:</span>
                                <span className={cn(
                                    "font-bold",
                                    mixedRemaining > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    ${mixedRemaining.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Desktop variant
    return (
        <div className="space-y-3">
            <Label className="text-sm font-medium">Método de Pago</Label>
            <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;

                    return (
                        <Card
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id)}
                            className={cn(
                                "p-3 cursor-pointer transition-all hover:scale-105",
                                isSelected
                                    ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                                    : "hover:border-gray-300 dark:hover:border-gray-600"
                            )}
                        >
                            <div className="flex flex-col items-center gap-1">
                                <Icon className={cn("h-5 w-5", isSelected ? "text-violet-600" : method.color)} />
                                <span className={cn(
                                    "text-xs font-medium",
                                    isSelected ? "text-violet-600 dark:text-violet-400" : ""
                                )}>
                                    {method.label}
                                </span>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Mixed payment details */}
            {paymentMethod === 'MIXED' && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-white/[0.06] rounded-lg space-y-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Desglose de pago</p>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <Label className="text-xs">Efectivo</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={paymentDetails?.cashAmount || 0}
                                onChange={(e) => handleMixedAmountChange('cashAmount', e.target.value)}
                                className="mt-1 h-8 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Tarjeta</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={paymentDetails?.cardAmount || 0}
                                onChange={(e) => handleMixedAmountChange('cardAmount', e.target.value)}
                                className="mt-1 h-8 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Transferencia</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={paymentDetails?.transferAmount || 0}
                                onChange={(e) => handleMixedAmountChange('transferAmount', e.target.value)}
                                className="mt-1 h-8 text-sm"
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t dark:border-white/[0.08] flex justify-between text-sm">
                        <span>Restante:</span>
                        <span className={cn(
                            "font-bold",
                            mixedRemaining > 0 ? "text-red-600" : "text-green-600"
                        )}>
                            ${mixedRemaining.toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
