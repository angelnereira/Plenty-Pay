"use client";

import { usePosDualScreen } from "../hooks/use-pos-dual-screen";
import { Store, ShoppingBag, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export function CustomerView() {
    const { clientState, connected } = usePosDualScreen('CLIENT');

    if (!clientState || !connected) {
        return (
            <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-white animate-pulse">
                <Store className="h-24 w-24 mb-6 text-violet-500" />
                <h1 className="text-4xl font-black tracking-tight mb-2">PLENTYPAY</h1>
                <p className="text-xl text-slate-400">Conectando con caja...</p>
            </div>
        );
    }

    const { cart, subtotal, tax, discount, total, paymentMethod } = clientState;
    const hasItems = cart.length > 0;

    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-transparent flex overflow-hidden">
            {/* Left Panel: Branding / Ads */}
            <div className="hidden lg:flex flex-1 bg-slate-900 text-white flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
                <div className="relative z-10 p-12 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-violet-600 p-2 rounded-lg">
                                <Store className="h-8 w-8" />
                            </div>
                            <h1 className="text-3xl font-black tracking-widest">PLENTYPAY</h1>
                        </div>
                        <h2 className="text-5xl font-bold leading-tight max-w-md">
                            Gracias por su preferencia
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                            <h3 className="font-bold text-xl mb-2 text-violet-300">¿Sabías que?</h3>
                            <p className="text-slate-300 leading-relaxed">
                                Nuestros productos cuentan con garantía de calidad. Conserve su factura para cualquier reclamo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Transaction Details */}
            <div className="flex-1 flex flex-col bg-white dark:bg-white/[0.06] h-full border-l dark:border-white/[0.1] shadow-2xl">
                {/* Header */}
                <div className="p-8 border-b dark:border-white/[0.1] bg-white dark:bg-white/[0.06] z-10">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <ShoppingBag className="h-6 w-6 text-violet-600" />
                        SU COMPRA
                    </h2>
                </div>

                {/* Cart List */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-8 custom-scrollbar">
                    {!hasItems ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ShoppingBag className="h-24 w-24 mb-4 opacity-20" />
                            <p className="text-xl font-medium">Esperando productos...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cart.map((item) => (
                                <div key={item.id} className="flex items-start justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.1] animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{item.name}</h3>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <span className="font-mono bg-white dark:bg-white/[0.06] px-2 py-0.5 rounded border dark:border-white/[0.08] text-sm">
                                                {item.quantity} x ${item.price.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        ${(item.quantity * item.price).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Totals Footer */}
                {hasItems && (
                    <div className="bg-slate-50 dark:bg-transparent p-8 border-t dark:border-white/[0.1] space-y-4">
                        <div className="space-y-2 text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between text-sm font-bold uppercase tracking-wider">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-sm font-bold uppercase tracking-wider text-green-600">
                                    <span>Descuento</span>
                                    <span>-${discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-bold uppercase tracking-wider">
                                <span>Impuesto (ITBMS)</span>
                                <span>${tax.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-white/[0.1]">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total a Pagar</span>
                                <span className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
                                    ${total.toFixed(2)}
                                </span>
                            </div>

                            {paymentMethod !== 'CASH' && (
                                <div className="flex items-center justify-center gap-2 bg-violet-100 dark:bg-violet-900/20 py-2 rounded-lg text-violet-700 dark:text-violet-300 font-bold uppercase text-xs tracking-widest">
                                    <CreditCard className="h-4 w-4" />
                                    Método de Pago: {paymentMethod === 'MIXED' ? 'Múltiple' : paymentMethod}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
