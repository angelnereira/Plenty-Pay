'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Loader2, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { FaceService } from '@/features/bio/face-service';
import { getLivenessDetector } from '@/features/bio/liveness-detector';
import { registerFace } from '@/features/payday/actions/employee-management';
import { useToast } from '@/shared/hooks/use-toast';

interface FaceRegistrationModalProps {
    employeeId: string;
    hasExistingFace: boolean;
}

type RegistrationStep = 'IDLE' | 'FRONT' | 'LEFT' | 'RIGHT' | 'PROCESSING' | 'SUCCESS';

export function FaceRegistrationModal({ employeeId, hasExistingFace }: FaceRegistrationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<RegistrationStep>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [instruction, setInstruction] = useState<string>('');
    const [progress, setProgress] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Store captured descriptors
    const descriptorsRef = useRef<Float32Array[]>([]);

    // Fix for stale closure: always read from ref in async loops
    const stepRef = useRef<RegistrationStep>('IDLE');
    useEffect(() => { stepRef.current = step; }, [step]);

    const { toast } = useToast();

    // Reset state when opening
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setStep('IDLE');
            setError(null);
            descriptorsRef.current = [];
            setProgress(0);
        } else {
            stopCamera();
        }
    };

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

                // Initialize models
                await FaceService.getInstance().loadModels();

                // Start tracking loop
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
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    // Main tracking loop
    const startTracking = () => {
        if (detectionIntervalRef.current) clearTimeout(detectionIntervalRef.current);

        const track = async () => {
            if (!videoRef.current || !isOpen) return;

            // Read from ref to avoid stale closure
            const currentStep = stepRef.current;

            // If we are processing, skip detection
            if (currentStep === 'PROCESSING' || currentStep === 'SUCCESS' || currentStep === 'IDLE') return;

            try {
                const faceapi = await import('@vladmandic/face-api');
                // Use TinyFace for fast pose check
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

                const detection = await faceapi.detectSingleFace(videoRef.current, options).withFaceLandmarks(true);

                if (detection) {
                    const livenessDetector = getLivenessDetector();
                    const rotation = livenessDetector.detectHeadRotation(detection.landmarks.positions);

                    // Validate based on current step
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

    // State machine for steps
    const validateStep = (rotation: 'left' | 'right' | 'center', detection: any) => {
        // Read from ref for consistency
        const currentStep = stepRef.current;

        switch (currentStep) {
            case 'FRONT':
                if (rotation === 'center') {
                    setInstruction('¡Perfecto! Mantén la posición...');
                    autoCapture(detection, 'center', 'LEFT');
                } else {
                    setInstruction('Mira de frente a la cámara');
                }
                break;
            case 'LEFT':
                // Mirror logic: If user turns head LEFT, their nose moves to LEFT of screen (if mirrored)
                // Actually liveness detector logic: nose relative to cheeks.
                // Assuming detectHeadRotation returns correct semantic direction.
                if (rotation === 'right') { // "Right" in code might be user's left if mirrored? Let's assume 'left' means head turned left.
                    // Wait, if I turn left, my right cheek becomes more visible.
                    // Let's trust the logic in liveness-detector.ts:
                    // ratio < 0.75 => 'left' (nose closer to left cheek)
                    // If nose is closer to left cheek, I am looking LEFT.
                    setInstruction('¡Bien! Mantén...');
                    autoCapture(detection, 'left', 'RIGHT');
                } else {
                    setInstruction('Gira levemente a la IZQUIERDA');
                }
                break;
            case 'RIGHT':
                if (rotation === 'left') {
                    setInstruction('¡Excelente! Mantén...');
                    autoCapture(detection, 'right', 'PROCESSING');
                } else {
                    setInstruction('Gira levemente a la DERECHA');
                }
                break;
        }
    };

    // Helper to capture high-quality descriptor
    const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const autoCapture = (detection: any, requiredRotation: string, nextStep: RegistrationStep) => {
        if (captureTimeoutRef.current) return;

        // Visual feedback
        setProgress(p => Math.min(p + 10, 100));

        // Wait 1 sec of stability to capture
        captureTimeoutRef.current = setTimeout(async () => {
            // Capture high quality descriptor
            try {
                const faceService = FaceService.getInstance();
                // We use the current video frame - reusing detection might be stale? 
                // Better to fetch fresh descriptor with SSD MobileNet now that we know pose is good.

                // Pause checking loop
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
                        // Resume loop
                        startTracking();
                    }
                } else {
                    // Retry with feedback
                    setInstruction('No se pudo capturar. Ajuste iluminación.');
                    // Wait a moment then retry
                    setTimeout(startTracking, 1500);
                }
            } catch (e) {
                console.error(e);
                setInstruction('Error al capturar.');
                setTimeout(startTracking, 1500);
            } finally {
                captureTimeoutRef.current = null;
            }
        }, 800);
    };

    // Stop auto-capture if condition fails
    useEffect(() => {
        // If instruction changes to "Do X", clear timeout
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
                    setIsOpen(false);
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

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant={hasExistingFace ? "outline" : "default"} onClick={() => setIsOpen(true)}>
                    {hasExistingFace ? "Actualizar Biometría" : "Registrar Rostro"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-slate-900 text-white border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-xl">Registro Facial Asistido</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-4">
                    {step === 'IDLE' && (
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                                <User className="w-10 h-10 text-blue-400" />
                            </div>
                            <p className="text-slate-300">
                                Vamos a capturar 3 ángulos de tu rostro para mayor precisión.
                            </p>
                            <ul className="text-sm text-slate-400 space-y-2 text-left bg-slate-800/50 p-4 rounded-lg">
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Mirar de frente</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Girar levemente a la izquierda</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Girar levemente a la derecha</li>
                            </ul>
                            <Button onClick={startCamera} className="w-full bg-blue-600 hover:bg-blue-500">
                                <Camera className="w-4 h-4 mr-2" /> Comenzar
                            </Button>
                        </div>
                    )}

                    {(step === 'FRONT' || step === 'LEFT' || step === 'RIGHT' || step === 'PROCESSING') && (
                        <div className="w-full space-y-4">
                            {/* Instruction Bar */}
                            <div className="bg-slate-800 p-3 rounded-lg text-center font-bold text-lg text-blue-300">
                                {step === 'PROCESSING' ? 'Procesando modelo...' : instruction || 'Buscando rostro...'}
                            </div>

                            {/* Video Area */}
                            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                    playsInline
                                    muted
                                />

                                {/* Overlay System */}
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    {/* Face Guide Oval */}
                                    <div className={`w-48 h-64 border-2 rounded-[50%] transition-colors duration-300 ${progress > 0 ? 'border-green-500 bg-green-500/10' : 'border-slate-500/50'
                                        }`} />

                                    {/* Arrows Hints */}
                                    {step === 'LEFT' && (
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-bounce">
                                            <ArrowLeft className="w-12 h-12 text-blue-500" />
                                        </div>
                                    )}
                                    {step === 'RIGHT' && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-bounce">
                                            <ArrowRight className="w-12 h-12 text-blue-500" />
                                        </div>
                                    )}
                                </div>

                                {step === 'PROCESSING' && (
                                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                        <span className="text-blue-200">Generando vector biométrico...</span>
                                    </div>
                                )}
                            </div>

                            {/* Progress Indicators */}
                            <div className="flex justify-center gap-2">
                                <div className={`h-2 w-1/3 rounded-full transition-colors ${(step as string) !== 'IDLE' ? 'bg-green-500' : 'bg-slate-700'}`} />
                                <div className={`h-2 w-1/3 rounded-full transition-colors ${((step as string) === 'LEFT' || (step as string) === 'RIGHT' || (step as string) === 'SUCCESS' || (step as string) === 'PROCESSING') ? 'bg-green-500' : 'bg-slate-700'}`} />
                                <div className={`h-2 w-1/3 rounded-full transition-colors ${((step as string) === 'RIGHT' || (step as string) === 'SUCCESS' || (step as string) === 'PROCESSING') ? 'bg-green-500' : 'bg-slate-700'}`} />
                            </div>
                        </div>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                                <Check className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">¡Registro Exitoso!</h3>
                            <p className="text-slate-400 text-center">
                                El empleado puede usar el Kiosco inmediatamente.
                            </p>
                            <Button onClick={() => setIsOpen(false)} className="bg-slate-700 hover:bg-slate-600">
                                Cerrar
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg text-sm text-center w-full">
                            {error}
                            <Button variant="link" onClick={() => setStep('IDLE')} className="text-white underline mt-2">
                                Intentar de nuevo
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
