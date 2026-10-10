"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Flashlight } from "lucide-react";
import { Button } from "@shared/ui/button";
import "./pos-mobile.css";

interface MobileBarcodeScannerProps {
    onScan: (code: string) => void;
    onClose: () => void;
}

export function MobileBarcodeScanner({ onScan, onClose }: MobileBarcodeScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize scanner
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
        ];

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: formatsToSupport,
            showTorchButtonIfSupported: true,
            defaultZoomValueIfSupported: 2
        };

        try {
            // @ts-ignore - Library types might be slightly off
            scannerRef.current = new Html5QrcodeScanner("reader", config, false);

            scannerRef.current?.render(
                (decodedText) => {
                    // Play beep sound
                    try {
                        const audio = new Audio('/sounds/beep.mp3'); // Assuming we have this, or it will fail silently
                        audio.play().catch(() => { });
                    } catch (e) { }

                    onScan(decodedText);
                    // Don't close immediately to allow multiple scans? 
                    // Or close immediately? Let's close for now to avoid accidental double scans of same item
                    // Actually, for POS, continuous scanning is better.
                    // Implementation depends on how we want to handle the flow.
                    // Let's debounce in parent instead.
                },
                (errorMessage) => {
                    // ignore errors during scanning
                }
            );
        } catch (err) {
            console.error("Failed to start scanner", err);
            setError("No se pudo iniciar la cámara. Verifique permisos.");
        }

        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(console.error);
                } catch (e) {
                    console.error("Error clearing scanner", e);
                }
            }
        };
    }, [onScan]);

    return (
        <div className="scanner-overlay flex flex-col items-center justify-center bg-black">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white z-50 rounded-full bg-black/40"
                onClick={onClose}
            >
                <X className="h-6 w-6" />
            </Button>

            <div id="reader" className="w-full max-w-sm overflow-hidden rounded-lg bg-black text-white" />

            {error && (
                <div className="absolute bottom-20 bg-red-500 text-white p-4 rounded-lg mx-4 text-center">
                    {error}
                </div>
            )}

            <div className="absolute bottom-10 text-white/70 text-sm font-medium">
                Apunte la cámara al código de barras
            </div>

            {/* Custom overlay guide */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-violet-500 -mt-0.5 -ml-0.5 rounded-tl-sm"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-violet-500 -mt-0.5 -mr-0.5 rounded-tr-sm"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-violet-500 -mb-0.5 -ml-0.5 rounded-bl-sm"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-violet-500 -mb-0.5 -mr-0.5 rounded-br-sm"></div>

                    <div className="scanner-laser"></div>
                </div>
            </div>
        </div>
    );
}
