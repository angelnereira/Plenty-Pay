'use client';

import { useEffect, useRef, useState } from 'react';
import { XCircle, Loader2, QrCode } from 'lucide-react';

interface QRScannerProps {
    onScan: (result: string) => void;
    onError?: (error: string) => void;
    onCancel: () => void;
}

export function QRScanner({ onScan, onError, onCancel }: QRScannerProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(false);
    const scannerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        let scanner: any = null;

        const startScanner = async () => {
            // Dynamic import to avoid SSR issues
            try {
                const { Html5Qrcode } = await import('html5-qrcode');

                if (!mountedRef.current) return;

                scanner = new Html5Qrcode('qr-reader');
                scannerRef.current = scanner;

                let cameras;
                try {
                    cameras = await Html5Qrcode.getCameras();
                } catch (camError: any) {
                    throw new Error('No se pudo acceder a la cámara. Verifica los permisos.');
                }

                if (!mountedRef.current) return;

                if (!cameras || cameras.length === 0) {
                    throw new Error('No se encontró ninguna cámara');
                }

                // Prefer back camera on mobile
                const cameraId = cameras.find(c =>
                    c.label.toLowerCase().includes('back') ||
                    c.label.toLowerCase().includes('trasera')
                )?.id || cameras[0].id;

                await scanner.start(
                    cameraId,
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1
                    },
                    (decodedText: string) => {
                        // Success - stop scanner and return result
                        if (mountedRef.current) {
                            setIsActive(false);
                            scanner.stop().catch(() => { }).finally(() => {
                                onScan(decodedText);
                            });
                        }
                    },
                    () => {
                        // Ignore scan failures (scanning in progress)
                    }
                );

                if (mountedRef.current) {
                    setIsLoading(false);
                    setIsActive(true);
                }

            } catch (err: any) {
                console.error('QR Scanner Error:', err);
                if (mountedRef.current) {
                    let message = 'Error al iniciar el escáner';

                    if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
                        message = 'Permiso de cámara denegado. Permite el acceso a la cámara para escanear QR.';
                    } else if (err?.message) {
                        message = err.message;
                    }

                    setError(message);
                    setIsLoading(false);
                    onError?.(message);
                }
            }
        };

        startScanner();

        return () => {
            mountedRef.current = false;
            if (scannerRef.current && isActive) {
                try {
                    scannerRef.current.stop().catch(() => { });
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [onScan, onError]);

    const handleCancel = () => {
        if (scannerRef.current && isActive) {
            try {
                scannerRef.current.stop().catch(() => { });
            } catch (e) {
                // Ignore
            }
        }
        onCancel();
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            {isLoading && (
                <div className="text-center space-y-4 text-blue-400">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto" />
                    <p>Iniciando cámara...</p>
                </div>
            )}

            {error && (
                <div className="text-center space-y-4 text-red-400 max-w-xs">
                    <XCircle className="w-12 h-12 mx-auto" />
                    <p className="text-sm">{error}</p>
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                    >
                        Volver
                    </button>
                </div>
            )}

            {!isLoading && !error && (
                <>
                    <div
                        id="qr-reader"
                        ref={containerRef}
                        className="w-full max-w-[300px] rounded-xl overflow-hidden"
                    />
                    <div className="mt-4 text-center">
                        <p className="text-sm text-slate-400 mb-3 flex items-center justify-center gap-2">
                            <QrCode className="w-4 h-4" />
                            Escanea tu código QR de empleado
                        </p>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-sm"
                        >
                            Cancelar
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
