"use client";

import { useState, useEffect, useCallback } from "react";
import { PosProduct, usePosStore } from "../stores/pos.store";
import { PosLayout } from "./PosLayout";
import { isMobile } from "../utils/device-detection";
import { Button } from "@shared/ui/button";
import { Monitor, Smartphone, Loader2 } from "lucide-react";
import { CheckoutPreference } from "../types/pos-types";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { MobileScannerPOS } from "@/app/dashboard/pos/scanner/_components/MobileScannerPOS";
import type { ProductInfo } from "@/lib/pos/cart/use-pos-cart";

interface PosPageClientProps {
    products: PosProduct[];
    userName: string;
    clientId: string;
    checkoutPreference: CheckoutPreference;
    checkoutThreshold: number;
}

export function PosPageClient({ products, userName, clientId, checkoutPreference, checkoutThreshold }: PosPageClientProps) {
    const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);
    const [overrideMode, setOverrideMode] = useState<'mobile' | 'desktop' | null>(null);

    useEffect(() => {
        const checkDevice = () => setIsMobileDevice(isMobile());
        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    const setCheckoutConfig = usePosStore(state => state.setCheckoutConfig);
    useEffect(() => {
        setCheckoutConfig(checkoutPreference, checkoutThreshold);
    }, [checkoutPreference, checkoutThreshold, setCheckoutConfig]);

    // Offline-first sync for desktop POS (Zustand store)
    useOfflineSync(clientId);

    // Stable resolver for mobile scanner — maps barcode/sku to ProductInfo
    const resolveProduct = useCallback(
        async (barcode: string): Promise<ProductInfo | null> => {
            const found = products.find(
                (p) => p.barcode === barcode || p.sku === barcode
            );
            if (!found) return null;
            return {
                id: found.id,
                name: found.name,
                price: found.price,
                taxRate: found.taxRate,
                image: found.image,
            };
        },
        [products]
    );

    if (isMobileDevice === null) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
        );
    }

    const mode = overrideMode || (isMobileDevice ? 'mobile' : 'desktop');

    const DevToggle = () => process.env.NODE_ENV === 'development' ? (
        <div className="fixed bottom-4 left-4 z-50 flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <Button
                size="icon"
                variant={mode === 'desktop' ? 'default' : 'secondary'}
                onClick={() => setOverrideMode('desktop')}
                title="Force Desktop"
                className="rounded-full h-8 w-8"
            >
                <Monitor className="h-4 w-4" />
            </Button>
            <Button
                size="icon"
                variant={mode === 'mobile' ? 'default' : 'secondary'}
                onClick={() => setOverrideMode('mobile')}
                title="Force Mobile"
                className="rounded-full h-8 w-8"
            >
                <Smartphone className="h-4 w-4" />
            </Button>
        </div>
    ) : null;

    if (mode === 'mobile') {
        return (
            <MobileScannerPOS
                resolveProduct={resolveProduct}
                businessName={userName}
                products={products}
            />
        );
    }

    return (
        <>
            <PosLayout
                products={products}
                clientId={clientId}
                checkoutPreference={checkoutPreference}
                checkoutThreshold={checkoutThreshold}
            />
            <DevToggle />
        </>
    );
}
