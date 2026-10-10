"use client";

import { ProductGrid } from "./ProductGrid";
import { PosCart } from "./PosCart";
import { PosProduct, usePosStore } from "../stores/pos.store";
import { useEffect } from "react";
import { CheckoutPreference } from "../types/pos-types";

interface PosLayoutProps {
    products: PosProduct[];
    clientId: string;
    checkoutPreference: CheckoutPreference;
    checkoutThreshold: number;
}

export function PosLayout({ products, clientId, checkoutPreference, checkoutThreshold }: PosLayoutProps) {
    const setClientId = usePosStore(state => state.setClientId);
    const setCheckoutConfig = usePosStore(state => state.setCheckoutConfig);

    // CRITICAL: Set clientId on mount to ensure cart isolation
    useEffect(() => {
        setClientId(clientId);
        setCheckoutConfig(checkoutPreference, checkoutThreshold);
    }, [clientId, checkoutPreference, checkoutThreshold, setClientId, setCheckoutConfig]);

    return (
        <main className="flex h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-transparent">
            {/* ZONA IZQUIERDA: Catálogo y Selección */}
            <section className="flex-1 flex flex-col p-6 overflow-hidden">
                <ProductGrid initialProducts={products} />
            </section>

            {/* ZONA DERECHA: Carrito y Checkout */}
            <aside className="w-[400px] shrink-0 flex flex-col border-l border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl shadow-xl z-20 h-full overflow-hidden">
                <PosCart />
            </aside>
        </main>
    );
}

