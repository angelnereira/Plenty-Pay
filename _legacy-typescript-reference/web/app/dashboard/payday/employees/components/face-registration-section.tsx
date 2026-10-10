'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Check, Loader2, ArrowLeft, ArrowRight, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FaceService } from '@/features/bio/face-service';
import { getLivenessDetector } from '@/features/bio/liveness-detector';
import { registerFace } from '@/features/payday/actions/employee-management';
import { useToast } from '@/shared/hooks/use-toast';

interface FaceRegistrationSectionProps {
    employeeId: string;
    hasExistingFace: boolean;
}

type RegistrationStep = 'IDLE' | 'FRONT' | 'LEFT' | 'RIGHT' | 'PROCESSING' | 'SUCCESS';

export function FaceRegistrationSection({ employeeId, hasExistingFace }: FaceRegistrationSectionProps) {
    const [step, setStep] = useState<RegistrationStep>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [instruction, setInstruction] = useState<string>('');
    const [progress, setProgress] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const descriptorsRef = useRef<Float32Array[]>([]);
    const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fix for stale closure
    const stepRef = useRef<RegistrationStep>('IDLE');
    useEffect(() => { stepRef.current = step; }, [step]);

    const { toast } = useToast();

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        setStep('FRONT');
        setError(null);
        descriptorsRef.current = [];
        setProgress(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await new Promise((resolve) => {
                    videoRef.current!.onloadedmetadata = () => {
                        videoRef.current!.play().then(resolve);
                    };
                });

                await FaceService.getInstance().loadModels();
                startTracking();
            }
        } catch (e: any) {
            console.error('Camera error:', e);
            setError('No se pudo acceder a la cámara. Verifique permisos.');
            setStep('IDLE');
        }
    };

    const stopCamera = () => {
        if (detectionIntervalRef.current) clearTimeout(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const startTracking = () => {
        if (detectionIntervalRef.current) clearTimeout(detectionIntervalRef.current);

        const track = async () => {
            if (!videoRef.current) return;
            const currentStep = stepRef.current;
            if (currentStep === 'PROCESSING' || currentStep === 'SUCCESS' || currentStep === 'IDLE') return;

            try {
                const faceapi = await import('@vladmandic/face-api');
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
                // Use full 68-point landmarks for accurate head rotation detection
                const detection = await faceapi.detectSingleFace(videoRef.current, options).withFaceLandmarks();

                if (detection) {
                    const livenessDetector = getLivenessDetector();
                    const rotation = livenessDetector.detectHeadRotation(detection.landmarks.positions);
                    validateStep(rotation, detection);
                } else {
                    setInstruction('Rostro no detectado');
                }
            } catch (err) {
                console.error('Tracking error:', err);
            }

            detectionIntervalRef.current = setTimeout(track, 100);
        };

        track();
    };

    const validateStep = (rotation: 'left' | 'right' | 'center', detection: any) => {
        const currentStep = stepRef.current;

        switch (currentStep) {
            case 'FRONT':
                if (rotation === 'center') {
                    setInstruction('¡Perfecto! Mantén la posición...');
                    autoCapture(detection, 'LEFT');
                } else {
                    setInstruction('Mira de frente a la cámara');
                }
                break;
            case 'LEFT':
                if (rotation === 'right') {
                    setInstruction('¡Bien! Mantén...');
                    autoCapture(detection, 'RIGHT');
                } else {
                    setInstruction('Gira levemente a la IZQUIERDA');
                }
                break;
            case 'RIGHT':
                if (rotation === 'left') {
                    setInstruction('¡Excelente! Mantén...');
                    autoCapture(detection, 'PROCESSING');
                } else {
                    setInstruction('Gira levemente a la DERECHA');
                }
                break;
        }
    };

    const autoCapture = (detection: any, nextStep: RegistrationStep) => {
        if (captureTimeoutRef.current) return;
        setProgress(p => Math.min(p + 10, 100));

        captureTimeoutRef.current = setTimeout(async () => {
            try {
                const faceService = FaceService.getInstance();
                if (detectionIntervalRef.current) clearTimeout(detectionIntervalRef.current);

                setInstruction('Capturando...');
                const descriptor = await faceService.getFaceDescriptor(videoRef.current!);

                if (descriptor) {
                    descriptorsRef.current.push(descriptor);

                    if (nextStep === 'PROCESSING') {
                        finishRegistration();
                    } else {
                        setStep(nextStep);
                        setProgress(0);
                        startTracking();
                    }
                } else {
                    setInstruction('No se pudo capturar. Ajuste iluminación.');
                    setTimeout(startTracking, 1500);
                }
            } catch (e) {
                console.error(e);
                setInstruction('Error al capturar.');
                setTimeout(startTracking, 1500);
            } finally {
                captureTimeoutRef.current = null;
            }
        }, 400); // Reduced from 800ms for faster capture
    };

    useEffect(() => {
        if (instruction.includes('Gira') || instruction.includes('Mira')) {
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
                setProgress(0);
            }
        }
    }, [instruction]);

    const finishRegistration = async () => {
        setStep('PROCESSING');
        try {
            const faceService = FaceService.getInstance();
            const averaged = faceService.averageDescriptors(descriptorsRef.current);

            const result = await registerFace(employeeId, JSON.stringify(Array.from(averaged)));

            if (result.success) {
                setStep('SUCCESS');
                toast({ title: 'Biometría completada', description: 'Modelo facial de alta precisión guardado.' });
                setTimeout(() => {
                    stopCamera();
                }, 2000);
            } else {
                setError(result.message);
                setStep('IDLE');
            }
        } catch (e) {
            setError('Error al procesar el modelo facial');
            setStep('IDLE');
        }
    };

    const resetRegistration = () => {
        stopCamera();
        setStep('IDLE');
        setError(null);
        setInstruction('');
        setProgress(0);
        descriptorsRef.current = [];
    };

    return (
        <div className="space-y-4">
            {step === 'IDLE' && (
                <div className="text-center space-y-4 py-4">
                    {hasExistingFace ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                            <Check className="w-5 h-5" />
                            <span className="font-medium">Biometría Activa</span>
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-slate-200 dark:bg-white/[0.05] rounded-full flex items-center justify-center mx-auto">
                            <User className="w-8 h-8 text-slate-500" />
                        </div>
                    )}
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Captura 3 ángulos de rostro para mayor precisión.
                    </p>
                    <Button onClick={startCamera} className="bg-indigo-600 hover:bg-indigo-500">
                        <Camera className="w-4 h-4 mr-2" />
                        {hasExistingFace ? 'Actualizar Biometría' : 'Iniciar Registro'}
                    </Button>
                </div>
            )}

            {(step === 'FRONT' || step === 'LEFT' || step === 'RIGHT' || step === 'PROCESSING') && (
                <div className="space-y-4">
                    {/* Instruction Bar */}
                    <div className="bg-slate-100 dark:bg-white/[0.05] p-3 rounded-lg text-center font-bold text-indigo-700 dark:text-indigo-300">
                        {step === 'PROCESSING' ? 'Procesando modelo...' : instruction || 'Buscando rostro...'}
                    </div>

                    {/* Video Area */}
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-200 dark:border-white/[0.1]">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover transform scale-x-[-1]"
                            playsInline
                            muted
                        />

                        {/* Face Guide Oval */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className={`w-48 h-64 border-2 rounded-[50%] transition-colors duration-300 ${progress > 0 ? 'border-green-500 bg-green-500/10' : 'border-slate-500/50'}`} />

                            {step === 'LEFT' && (
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-bounce">
                                    <ArrowLeft className="w-10 h-10 text-indigo-500" />
                                </div>
                            )}
                            {step === 'RIGHT' && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-bounce">
                                    <ArrowRight className="w-10 h-10 text-indigo-500" />
                                </div>
                            )}
                        </div>

                        {step === 'PROCESSING' && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                <span className="text-indigo-200">Generando vector biométrico...</span>
                            </div>
                        )}
                    </div>

                    {/* Progress Indicators */}
                    <div className="flex justify-center gap-2">
                        <div className={`h-2 w-1/3 rounded-full transition-colors ${(step as string) !== 'IDLE' ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/[0.1]'}`} />
                        <div className={`h-2 w-1/3 rounded-full transition-colors ${((step as string) === 'LEFT' || (step as string) === 'RIGHT' || (step as string) === 'SUCCESS' || (step as string) === 'PROCESSING') ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/[0.1]'}`} />
                        <div className={`h-2 w-1/3 rounded-full transition-colors ${((step as string) === 'RIGHT' || (step as string) === 'SUCCESS' || (step as string) === 'PROCESSING') ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/[0.1]'}`} />
                    </div>

                    <Button variant="outline" onClick={resetRegistration} className="w-full">
                        <RefreshCw className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                </div>
            )}

            {step === 'SUCCESS' && (
                <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center">
                        <Check className="w-10 h-10 text-green-600 dark:text-green-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">¡Registro Exitoso!</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-center">
                        El empleado puede usar el Kiosco inmediatamente.
                    </p>
                    <Button onClick={resetRegistration} variant="outline">
                        Cerrar
                    </Button>
                </div>
            )}

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 p-4 rounded-lg text-sm text-center">
                    <AlertCircle className="w-5 h-5 inline-block mr-2" />
                    {error}
                    <Button variant="link" onClick={resetRegistration} className="text-red-600 dark:text-red-300 underline ml-2">
                        Intentar de nuevo
                    </Button>
                </div>
            )}
        </div>
    );
}
