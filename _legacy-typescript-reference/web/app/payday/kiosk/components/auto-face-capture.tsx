'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, CheckCircle, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { getLivenessDetector, resetLivenessDetector } from '@/features/bio/liveness-detector';

const MODEL_URL = '/models';

interface AutoFaceCaptureProps {
    onCapture: (descriptor: string, imageKey?: string) => void;
    onError?: (error: string) => void;
    minConfidence?: number;
    countdownSeconds?: number;
}

// Helper for feedback
function validateFacePosition(box: any, videoWidth: number, videoHeight: number): 'valid' | 'too_far' | 'too_close' | 'off_center' {
    const boxWidth = box.width;
    const ratio = boxWidth / videoWidth;

    if (ratio < 0.25) return 'too_far';    // "Acércate más"
    if (ratio > 0.65) return 'too_close';  // "Aléjate"

    // Check centering
    const centerX = box.x + boxWidth / 2;
    // Center X should be within 30% and 70% of width
    if (centerX < videoWidth * 0.3 || centerX > videoWidth * 0.7) {
        return 'off_center';  // "Centra tu rostro"
    }

    return 'valid';
}

export function AutoFaceCapture({
    onCapture,
    onError,
    minConfidence = 0.5,
    countdownSeconds = 2
}: AutoFaceCaptureProps) {
    const [status, setStatus] = useState<'loading' | 'detecting' | 'liveness_check' | 'countdown' | 'capturing' | 'success' | 'error'>('loading');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('Iniciando...');
    const [detectionScore, setDetectionScore] = useState<number>(0);
    const [blinkDetected, setBlinkDetected] = useState(false);
    const [instruction, setInstruction] = useState<string>('Buscando rostro...');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceapiRef = useRef<any>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isCapturingRef = useRef(false);

    // Initialize camera and models
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                setDebugInfo('Solicitando cámara...');
                console.log('[AutoFace] Requesting camera...');

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 480 },
                        height: { ideal: 480 }
                    },
                    audio: false
                });

                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                setDebugInfo('Cámara OK, cargando IA...');

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;

                    await new Promise<void>((resolve, reject) => {
                        const video = videoRef.current!;
                        video.onloadedmetadata = () => {
                            video.play()
                                .then(resolve)
                                .catch(reject);
                        };
                        video.onerror = () => reject(new Error('Video error'));
                    });

                    console.log('[AutoFace] Video playing, loading face-api...');
                    setDebugInfo('Video OK, cargando modelos...');

                    // Load face-api dynamically
                    const faceapi = await import('@vladmandic/face-api');
                    faceapiRef.current = faceapi;

                    // Initialize FaceService for warmup (shared singleton)
                    const { FaceService } = await import('@/features/bio/face-service');
                    await FaceService.getInstance().initializeWithWarmup();

                    console.log('[AutoFace] Models loaded, starting detection');
                    setDebugInfo('¡Listo! Buscando rostro...');

                    // Reset liveness detector for new session
                    resetLivenessDetector();

                    if (mounted) {
                        setStatus('detecting');
                        startDetection();
                    }
                }
            } catch (err: any) {
                console.error('[AutoFace] Init error:', err);
                const message = err?.name === 'NotAllowedError'
                    ? 'Permiso de cámara denegado'
                    : `Error: ${err?.message || 'desconocido'}`;
                setError(message);
                setDebugInfo(message);
                setStatus('error');
                onError?.(message);
            }
        };

        init();

        return () => {
            mounted = false;
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (detectionIntervalRef.current) {
            clearTimeout(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
    };

    // Detection loop using recursive setTimeout for better control
    const startDetection = () => {
        if (detectionIntervalRef.current) return;

        console.log('[AutoFace] Starting detection loop');

        const detect = async () => {
            if (isCapturingRef.current) return;
            // Ensure checking happens even if component unmounts mid-way
            if (!videoRef.current || !faceapiRef.current) return;
            if (videoRef.current.readyState < 2) {
                detectionIntervalRef.current = setTimeout(detect, 100);
                return;
            }

            try {
                const faceapi = faceapiRef.current;

                // Use TinyFaceDetector for speed, BUT full landmarks (68 points) for accurate EAR
                // TinyLandmarks only has 5 points, which can't calculate EAR for blink detection
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

                const detection = await faceapi.detectSingleFace(
                    videoRef.current,
                    options
                ).withFaceLandmarks(); // Full 68-point landmarks (NOT tiny)

                if (detection) {
                    const score = detection.detection.score;
                    setDetectionScore(score);

                    if (score >= minConfidence && !isCapturingRef.current) {
                        // Validate Face Position
                        const positionStatus = validateFacePosition(
                            detection.detection.box,
                            videoRef.current.videoWidth,
                            videoRef.current.videoHeight
                        );

                        if (positionStatus !== 'valid') {
                            setDetectionScore(0); // Hide score to avoid confusion
                            const msgs = {
                                'too_far': 'Acércate más',
                                'too_close': 'Aléjate un poco',
                                'off_center': 'Centra tu rostro'
                            };
                            setDebugInfo(msgs[positionStatus]);
                            setInstruction(msgs[positionStatus]);
                            // Continue loop
                        } else {
                            // Face detected and positioned, now check liveness
                            const livenessDetector = getLivenessDetector();

                            // Convert face-api landmarks to simple point array
                            const points = detection.landmarks.positions;

                            const blinkJustDetected = livenessDetector.processFrame(points);
                            const isLive = livenessDetector.isLive();

                            if (isLive) {
                                setBlinkDetected(true);
                                console.log('[AutoFace] Liveness verified via blink!');

                                isCapturingRef.current = true;
                                detectionIntervalRef.current = null; // Stop loop
                                // Skip countdown - capture immediately
                                capture();
                                return; // Stop recursion
                            } else {
                                setStatus('liveness_check');
                                const currentEAR = livenessDetector.getCurrentEAR();
                                const baseline = livenessDetector.getBaseline();
                                setDebugInfo(`Parpadea (EAR: ${currentEAR.toFixed(2)} / Base: ${baseline.toFixed(2)})`);
                                setInstruction('Parpadea para confirmar');
                                if (blinkJustDetected) {
                                    setBlinkDetected(true);
                                    setTimeout(() => setBlinkDetected(false), 200);
                                }
                            }
                        }
                    } else {
                        setDebugInfo(`Rostro: ${(score * 100).toFixed(0)}%`);
                        setInstruction('Buscando rostro...');
                    }
                } else {
                    setDetectionScore(0);
                    setStatus('detecting');
                    setDebugInfo('Buscando rostro...');
                }
            } catch (err: any) {
                console.error('[AutoFace] Detection error:', err);
            }

            // Schedule next frame
            if (!isCapturingRef.current) {
                detectionIntervalRef.current = setTimeout(detect, 60); // ~15 FPS target
            }
        };

        detect();
    };

    const startCountdown = () => {
        let remaining = countdownSeconds;
        setCountdown(remaining);
        setDebugInfo(`Capturando en ${remaining}...`);

        countdownIntervalRef.current = setInterval(() => {
            remaining--;
            setCountdown(remaining);
            setDebugInfo(`Capturando en ${remaining}...`);

            if (remaining <= 0) {
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                // Stop detection loop
                if (detectionIntervalRef.current) {
                    clearTimeout(detectionIntervalRef.current);
                    detectionIntervalRef.current = null;
                }
                capture();
            }
        }, 1000);
    };

    // Helper to upload image
    async function uploadAuditImage(blob: Blob): Promise<string | null> {
        try {
            // 1. Get Presigned URL
            const res = await fetch('/api/storage/presigned', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to get presigned URL');
            const { uploadUrl, key } = await res.json();

            // 2. Upload to Blob Storage (Mocked for now)
            // const upload = await fetch(uploadUrl, { method: 'PUT', body: blob });
            // if (!upload.ok) throw new Error('Upload failed');

            console.log('[AutoFace] Audit image uploaded to:', key);
            return key;
        } catch (e) {
            console.warn('[AutoFace] Audit upload failed (non-critical):', e);
            return null; // Fail safe, don't block auth
        }
    }
    // Continues into capture logic...

    const capture = async () => {
        if (!videoRef.current || !faceapiRef.current) return;

        setStatus('capturing');
        setCountdown(null);
        setDebugInfo('Capturando descriptor...');

        try {
            const faceapi = faceapiRef.current;

            const detection = await faceapi.detectSingleFace(
                videoRef.current,
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
            ).withFaceLandmarks().withFaceDescriptor();

            if (!detection) {
                setError('No se detectó rostro');
                setDebugInfo('Sin rostro, reintentando...');
                setStatus('detecting');
                isCapturingRef.current = false;
                startDetection();
                return;
            }

            // Capture Snapshot (Audit)
            let imageKey: string | undefined;
            if (videoRef.current) {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) uploadAuditImage(blob).then(key => {
                            if (key) console.log('Image key:', key);
                            // We don't await this here to keep UI snappy, 
                            // BUT if we need key in onCapture, we must await.
                            // For critical path speed, usually we fire and forget or use a separate ID.
                        });
                    }, 'image/jpeg', 0.8);
                }
            }

            const descriptor = detection.descriptor;
            console.log('[AutoFace] Captured descriptor, length:', descriptor.length);

            setStatus('success');
            setDebugInfo('¡Captura exitosa!');

            // Convert Float32Array to regular array and stringify
            const descriptorArray = Array.from(descriptor);

            setTimeout(() => {
                // Pass imageKey if we awaited it, otherwise skip it for now or move upload earlier
                // For this implementations, we skip waiting for upload to favor speed.
                onCapture(JSON.stringify(descriptorArray));
            }, 800);

        } catch (err: any) {
            console.error('[AutoFace] Capture error:', err);
            setError('Error al capturar');
            setDebugInfo('Error, reintentando...');
            setStatus('detecting');
            isCapturingRef.current = false;
            resetLivenessDetector(); // Reset for retry
            startDetection();
        }
    };

    const retry = () => {
        setError(null);
        setStatus('detecting');
        setBlinkDetected(false);
        isCapturingRef.current = false;
        resetLivenessDetector();
        startDetection();
    };

    return (
        <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden max-w-xs sm:max-w-sm mx-auto">
            {/* Video Stream */}
            <video
                ref={videoRef}
                className="w-full h-full object-cover transform scale-x-[-1]"
                playsInline
                muted
                autoPlay
            />

            {/* Face Guide Oval */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                    className={`w-[60%] h-[75%] border-2 rounded-[50%] transition-colors ${status === 'success' ? 'border-green-500' :
                        status === 'liveness_check' ? 'border-purple-500' :
                            detectionScore >= minConfidence ? 'border-yellow-400' :
                                detectionScore > 0.3 ? 'border-yellow-500/50' :
                                    'border-blue-500/50'
                        } ${status === 'detecting' ? 'animate-pulse' : ''}`}
                />
            </div>

            {/* Liveness Instruction Overlay */}
            {status === 'liveness_check' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full mb-32 flex items-center gap-2 animate-bounce">
                        <Eye className="w-5 h-5 text-purple-400" />
                        <span className="text-white font-bold text-shadow">Parpadea para confirmar</span>
                    </div>
                </div>
            )}

            {/* Countdown Overlay */}
            {status === 'countdown' && countdown !== null && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-5xl font-black">{countdown}</span>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {status === 'loading' && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 p-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-white font-medium text-sm text-center">{debugInfo}</p>
                </div>
            )}

            {/* Capturing Overlay */}
            {status === 'capturing' && (
                <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3">
                    <Camera className="w-12 h-12 text-blue-600 animate-pulse" />
                    <p className="text-blue-600 font-bold">Procesando...</p>
                </div>
            )}

            {/* Success Overlay */}
            {status === 'success' && (
                <div className="absolute inset-0 bg-green-500 flex flex-col items-center justify-center gap-3">
                    <CheckCircle className="w-16 h-16 text-white" />
                    <p className="text-white font-bold text-xl">¡Listo!</p>
                </div>
            )}

            {/* Error Overlay */}
            {status === 'error' && (
                <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center gap-3 p-4">
                    <AlertCircle className="w-12 h-12 text-white" />
                    <p className="text-white font-bold text-center">{error}</p>
                    <button
                        onClick={retry}
                        className="mt-2 px-4 py-2 bg-white text-red-600 rounded-lg font-bold flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reintentar
                    </button>
                </div>
            )}

            {/* Status Bar - Top */}
            <div className="absolute top-2 left-2 right-2">
                <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status === 'detecting' ? 'bg-blue-500 animate-pulse' :
                                status === 'liveness_check' ? 'bg-purple-500 animate-pulse' :
                                    status === 'countdown' ? 'bg-green-500' :
                                        status === 'success' ? 'bg-green-500' :
                                            status === 'error' ? 'bg-red-500' :
                                                'bg-slate-500'
                                }`} />
                            <span className="text-white text-xs font-medium">{debugInfo}</span>
                        </div>
                        {detectionScore > 0 && status !== 'error' && status !== 'loading' && (
                            <span className={`text-xs font-bold ${detectionScore >= minConfidence ? 'text-green-400' : 'text-yellow-400'
                                }`}>
                                {(detectionScore * 100).toFixed(0)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Re-export for backwards compatibility
export { AutoFaceCapture as FaceCapture };
