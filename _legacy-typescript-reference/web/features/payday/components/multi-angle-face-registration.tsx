'use client';

import { useState } from 'react';
import { X, Check, Camera, Loader2, AlertCircle, RotateCcw, RotateCw } from 'lucide-react';
import { AutoFaceCapture } from '@/app/payday/kiosk/components/auto-face-capture';
import { registerFace } from '@/features/payday/actions/employee-management';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
}

interface MultiAngleFaceRegistrationProps {
    employee: Employee;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type CaptureAngle = 'frontal' | 'left' | 'right';
type ModalStep = 'instruction' | 'frontal' | 'left' | 'right' | 'processing' | 'success' | 'error';

interface AngleData {
    frontal: string | null;
    left: string | null;
    right: string | null;
}

export function MultiAngleFaceRegistration({
    employee,
    isOpen,
    onClose,
    onSuccess
}: MultiAngleFaceRegistrationProps) {
    const [step, setStep] = useState<ModalStep>('instruction');
    const [angleData, setAngleData] = useState<AngleData>({ frontal: null, left: null, right: null });
    const [error, setError] = useState<string>('');

    if (!isOpen) return null;

    const handleStartCapture = () => {
        setStep('frontal');
        setError('');
    };

    const handleAngleCapture = (angle: CaptureAngle, descriptorString: string) => {
        console.log(`[MultiAngle] Captured ${angle}:`, descriptorString.length);

        setAngleData(prev => ({ ...prev, [angle]: descriptorString }));

        // Move to next step
        if (angle === 'frontal') {
            setStep('left');
        } else if (angle === 'left') {
            setStep('right');
        } else if (angle === 'right') {
            // All angles captured, process
            processMultiAngleRegistration(descriptorString);
        }
    };

    const processMultiAngleRegistration = async (rightDescriptor: string) => {
        setStep('processing');

        try {
            // Parse all descriptors
            const frontalDesc = JSON.parse(angleData.frontal!);
            const leftDesc = JSON.parse(angleData.left!);
            const rightDesc = JSON.parse(rightDescriptor);

            // Average the three descriptors for better robustness
            const avgDescriptor = averageDescriptors([frontalDesc, leftDesc, rightDesc]);
            const avgDescriptorString = JSON.stringify(avgDescriptor);

            console.log('[MultiAngle] Averaged descriptor:', avgDescriptor.length);

            // Register averaged descriptor
            const result = await registerFace(employee.id, avgDescriptorString);

            if (result.success) {
                setStep('success');
                setTimeout(() => {
                    onSuccess?.();
                    handleClose();
                }, 2000);
            } else {
                setError(result.message);
                setStep('error');
            }
        } catch (err) {
            console.error('[MultiAngle] Processing error:', err);
            setError('Error al procesar capturas. Intenta nuevamente.');
            setStep('error');
        }
    };

    const handleCaptureError = (errorMsg: string) => {
        setError(errorMsg);
        setStep('error');
    };

    const handleClose = () => {
        setStep('instruction');
        setAngleData({ frontal: null, left: null, right: null });
        setError('');
        onClose();
    };

    const handleRetry = () => {
        setStep('instruction');
        setAngleData({ frontal: null, left: null, right: null });
        setError('');
    };

    const getInstructions = (): { title: string; icon: React.ReactNode; instruction: string } => {
        if (step === 'frontal') {
            return {
                title: 'Captura Frontal (1/3)',
                icon: <Camera className="h-8 w-8 text-blue-500" />,
                instruction: 'Mira directamente a la cámara con expresión neutral'
            };
        } else if (step === 'left') {
            return {
                title: 'Captura Lado Izquierdo (2/3)',
                icon: <RotateCcw className="h-8 w-8 text-purple-500" />,
                instruction: 'Gira suavemente tu cabeza hacia la izquierda (30-45°)'
            };
        } else if (step === 'right') {
            return {
                title: 'Captura Lado Derecho (3/3)',
                icon: <RotateCw className="h-8 w-8 text-green-500" />,
                instruction: 'Gira suavemente tu cabeza hacia la derecha (30-45°)'
            };
        }
        return { title: '', icon: null, instruction: '' };
    };

    const instructions = getInstructions();

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={step === 'processing' ? undefined : handleClose}
                />

                {/* Modal */}
                <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                                <Camera className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    Registro Facial Multi-Ángulo
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {employee.firstName} {employee.lastName}
                                </p>
                            </div>
                        </div>
                        {step !== 'processing' && (
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Instruction Screen */}
                        {step === 'instruction' && (
                            <div className="space-y-6">
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
                                    <Camera className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        Registro Mejorado
                                    </h3>
                                    <p className="text-slate-300">
                                        Capturaremos tu rostro desde 3 ángulos diferentes para mayor precisión
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <AngleStep number={1} title="Vista Frontal" description="Mira directamente a la cámara" />
                                    <AngleStep number={2} title="Lado Izquierdo" description="Gira tu cabeza ligeramente a la izquierda" />
                                    <AngleStep number={3} title="Lado Derecho" description="Gira tu cabeza ligeramente a la derecha" />
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                    <p className="text-sm text-yellow-300 flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>
                                            Asegúrate de tener buena iluminación y quitar lentes oscuros o accesorios que cubran el rostro
                                        </span>
                                    </p>
                                </div>

                                <button
                                    onClick={handleStartCapture}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
                                >
                                    Comenzar Registro
                                </button>
                            </div>
                        )}

                        {/* Capture Screens */}
                        {(step === 'frontal' || step === 'left' || step === 'right') && (
                            <div className="space-y-4">
                                {/* Progress Indicator */}
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    <div className={`w-3 h-3 rounded-full ${angleData.frontal ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <div className={`w-3 h-3 rounded-full ${angleData.left ? 'bg-green-500' : step === 'left' || step === 'right' ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                    <div className={`w-3 h-3 rounded-full ${step === 'right' ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                </div>

                                {/* Instructions Header */}
                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        {instructions.icon}
                                        <h3 className="text-lg font-bold text-white">
                                            {instructions.title}
                                        </h3>
                                    </div>
                                    <p className="text-slate-300">{instructions.instruction}</p>
                                </div>

                                {/* Auto Face Capture Component */}
                                <div>
                                    <AutoFaceCapture
                                        onCapture={(descriptor) => handleAngleCapture(step as CaptureAngle, descriptor)}
                                        onError={handleCaptureError}
                                        minConfidence={0.8}
                                        countdownSeconds={2}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Processing */}
                        {step === 'processing' && (
                            <div className="py-12 text-center space-y-4">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
                                <div>
                                    <p className="text-white font-medium">Procesando biometr\u00eda...</p>
                                    <p className="text-sm text-slate-400">
                                        Promediando descriptores de 3 ángulos
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Success */}
                        {step === 'success' && (
                            <div className="py-12 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <Check className="h-8 w-8 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-lg">
                                        ¡Registro Multi-Ángulo Completado!
                                    </p>
                                    <p className="text-sm text-slate-400">
                                        Mayor precisión de reconocimiento garantizada
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {step === 'error' && (
                            <div className="py-8 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-lg">
                                        Error en Registro
                                    </p>
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                                <div className="flex gap-3 justify-center pt-2">
                                    <button
                                        onClick={handleClose}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        onClick={handleRetry}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AngleStep({ number, title, description }: { number: number; title: string; description: string }) {
    return (
        <div className="flex items-center gap-4 bg-slate-800/50 rounded-lg p-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white">
                {number}
            </div>
            <div>
                <p className="font-medium text-white">{title}</p>
                <p className="text-sm text-slate-400">{description}</p>
            </div>
        </div>
    );
}

/**
 * Average multiple face descriptors for better accuracy
 */
function averageDescriptors(descriptors: number[][]): number[] {
    const length = descriptors[0].length;
    const result = new Array(length).fill(0);

    for (let i = 0; i < length; i++) {
        let sum = 0;
        for (const desc of descriptors) {
            sum += desc[i];
        }
        result[i] = sum / descriptors.length;
    }

    return result;
}
