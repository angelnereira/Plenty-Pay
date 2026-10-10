'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, XCircle, Loader2, User, RefreshCw } from 'lucide-react';
import { FaceService } from '@/features/bio/face-service';

interface FaceCaptureProps {
    onCapture: (imageData: string) => void;
    onError?: (error: string) => void;
    onCancel: () => void;
}

export function FaceCapture({ onCapture, onError, onCancel }: FaceCaptureProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);


    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            try {
                console.log('[FaceCapture] Starting camera initialization...');

                // Check if MediaDevices API is available
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('MediaDevices API not available. Please use HTTPS.');
                }

                console.log('[FaceCapture] Requesting camera access...');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    },
                    audio: false
                });

                console.log('[FaceCapture] Camera access granted, tracks:', stream.getTracks().length);

                if (!mounted) {
                    console.log('[FaceCapture] Component unmounted, stopping stream');
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        console.log('[FaceCapture] Video metadata loaded, playing...');
                        videoRef.current?.play().then(() => {
                            console.log('[FaceCapture] Video playing successfully');
                            if (mounted) setIsLoading(false);

                            // Load models AFTER camera is working
                            FaceService.getInstance().loadModels()
                                .then(() => console.log('[FaceCapture] Face models loaded'))
                                .catch(err => console.error('[FaceCapture] Model loading error:', err));
                        }).catch(playErr => {
                            console.error('[FaceCapture] Video play error:', playErr);
                            if (mounted) {
                                setError('Error al reproducir video de cámara');
                                setIsLoading(false);
                            }
                        });
                    };

                    videoRef.current.onerror = (e) => {
                        console.error('[FaceCapture] Video element error:', e);
                        if (mounted) {
                            setError('Error en el elemento de video');
                            setIsLoading(false);
                        }
                    };
                }
            } catch (err: any) {
                console.error('[FaceCapture] Camera Error:', err);
                console.error('[FaceCapture] Error name:', err?.name);
                console.error('[FaceCapture] Error message:', err?.message);

                if (mounted) {
                    let message = 'Error al acceder a la cámara';

                    if (err?.name === 'NotAllowedError') {
                        message = 'Permiso de cámara denegado. Por favor, permite el acceso en la configuración del navegador.';
                    } else if (err?.name === 'NotFoundError') {
                        message = 'No se encontró ninguna cámara. Verifica que esté conectada.';
                    } else if (err?.name === 'NotReadableError') {
                        message = 'La cámara está siendo usada por otra aplicación. Cierra otras apps que la utilicen.';
                    } else if (err?.name === 'OverconstrainedError') {
                        message = 'Configuración de cámara no compatible. Intenta con otro dispositivo.';
                    } else if (err?.name === 'SecurityError' || err?.message?.includes('https')) {
                        message = 'Acceso bloqueado por seguridad. Verifica que estés usando HTTPS.';
                    } else if (err?.message) {
                        message = `Error: ${err.message}`;
                    }

                    setError(message);
                    setIsLoading(false);
                    onError?.(message);
                }
            }
        };

        startCamera();

        return () => {
            mounted = false;
            if (streamRef.current) {
                console.log('[FaceCapture] Cleanup: stopping camera stream');
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [onError]);

    const captureFrame = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Set canvas size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        try {
            setIsLoading(true);
            const faceService = FaceService.getInstance();

            // Get descriptor from video stream directly (better performance) or canvas
            const descriptor = await faceService.getFaceDescriptor(video);

            if (!descriptor) {
                setError('No se detectó rostro. Intente de nuevo.');
                setIsLoading(false);
                setCountdown(null);
                return;
            }

            // Return stringified descriptor for backend
            onCapture(JSON.stringify(Array.from(descriptor)));

            // Cleanup matches existing logic
            streamRef.current?.getTracks().forEach(t => t.stop());

        } catch (e) {
            console.error('Face processing error', e);
            setError('Error procesando rostro');
            setIsLoading(false);
        }
    }, [onCapture]);

    const startCountdown = useCallback(async () => {
        // Ensure models are ready
        const faceService = FaceService.getInstance();
        if (!faceService.getModelsLoaded()) {
            setIsLoading(true);
            await faceService.loadModels();
            setIsLoading(false);
        }

        setError(null);
        setCountdown(3);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    captureFrame();
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    }, [captureFrame]);

    const handleCancel = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
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
                <div className="text-center space-y-4 text-red-400">
                    <XCircle className="w-12 h-12 mx-auto" />
                    <p>{error}</p>
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                    >
                        Volver
                    </button>
                </div>
            )}

            <div className={`relative ${isLoading || error ? 'hidden' : ''}`}>
                {/* Face Guide Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="w-48 h-56 border-4 border-dashed border-blue-400/50 rounded-[50%]" />
                </div>

                {/* Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                        <span className="text-7xl font-bold text-white animate-pulse">
                            {countdown}
                        </span>
                    </div>
                )}

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-[300px] rounded-xl transform scale-x-[-1]"
                />

                <canvas ref={canvasRef} className="hidden" />
            </div>

            {!isLoading && !error && (
                <div className="mt-4 text-center space-y-3">
                    <p className="text-sm text-slate-400">
                        Centra tu rostro en el óvalo
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={startCountdown}
                            disabled={countdown !== null}
                            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            <Camera className="w-4 h-4" />
                            Capturar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
