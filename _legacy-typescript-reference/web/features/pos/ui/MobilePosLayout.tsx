"use client";

import { useState, useEffect } from "react";
import { PosProduct, usePosStore } from "../stores/pos.store";
import { playSuccessBeep, playErrorBeep } from "@/lib/pos/scanner/audio-feedback";
import { MobileProductGrid } from "./MobileProductGrid";
import { MobileCart } from "./MobileCart";
import { ZxingBarcodeScanner } from "./ZxingBarcodeScanner";
import { Badge } from "@shared/ui/badge";
import { ShoppingCart } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useToast } from "@shared/hooks/use-toast";
import "./pos-mobile.css";
import { cn } from "@/lib/utils";
import { CheckoutPreference } from "../types/pos-types";
import { MobileHeader } from "@/components/dashboard/mobile-header";

interface MobilePosLayoutProps {
    products: PosProduct[];
    userName: string;
    clientId?: string;
    checkoutPreference: CheckoutPreference;
    checkoutThreshold: number;
}

export function MobilePosLayout({ products, userName, clientId, checkoutPreference, checkoutThreshold }: MobilePosLayoutProps) {
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Subscribe to cart changes for badge
    const cart = usePosStore(state => state.cart);
    const addToCart = usePosStore(state => state.addToCart);
    const setClientId = usePosStore(state => state.setClientId);
    const setCheckoutConfig = usePosStore(state => state.setCheckoutConfig);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const { toast } = useToast();

    // Prevent hydration issues
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (clientId) {
            setClientId(clientId);
        }
        setCheckoutConfig(checkoutPreference, checkoutThreshold);
    }, [clientId, checkoutPreference, checkoutThreshold, setClientId, setCheckoutConfig]);

    const handleScan = (code: string) => {
        const product = products.find(p => p.barcode === code || p.sku === code);

        if (product) {
            addToCart(product);
            playSuccessBeep();
            toast({
                title: `✓ ${product.name}`,
                description: `$${product.price.toFixed(2)} · ${product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'}`,
                duration: 1200,
            });
            // Keep scanner open for continuous scanning — cooldown (1500ms) prevents duplicates
        } else {
            playErrorBeep();
            toast({
                variant: "destructive",
                title: "Producto no encontrado",
                description: `Código: ${code}`,
                duration: 1200,
            });
        }
    };

    if (!mounted) {
        return <div className="h-screen bg-gray-50 flex items-center justify-center">Loading POS...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-transparent font-sans pb-24">
            {/* Standard Mobile Header */}
            <MobileHeader userName={userName} />

            {/* Main Content Area */}
            <main className="px-4 py-4">
                <MobileProductGrid
                    initialProducts={products}
                    onScanRequest={() => setIsScannerOpen(true)}
                />
            </main>



            {/* Cart Summary Bar - Fixed above global nav */}
            {cartCount > 0 && !isCartOpen && (
                <div className="fixed bottom-[80px] left-4 right-4 z-30 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="w-full bg-slate-900 dark:bg-white/[0.06] dark:backdrop-blur-2xl text-white p-4 rounded-2xl shadow-xl flex items-center justify-between border border-slate-800 dark:border-white/[0.1] active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-violet-600 h-10 w-10 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-violet-900/20">
                                {cartCount}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total a Cobrar</span>
                                <span className="font-bold text-lg leading-none">${cartTotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
                            <span>Ver Carrito</span>
                            <ShoppingCart className="h-4 w-4" />
                        </div>
                    </button>
                </div>
            )}



            {/* Overlays */}
            <MobileCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

            {isScannerOpen && (
                <ZxingBarcodeScanner
                    onScan={handleScan}
                    onClose={() => setIsScannerOpen(false)}
                />
            )}
        </div>
    );
}
