'use client';

import { useState } from 'react';
import { X, Camera, Loader2, Check, AlertCircle, User } from 'lucide-react';
import { FaceCapture } from '@/app/payday/kiosk/components/face-capture';
import { registerFace } from '@/features/payday/actions/employee-management';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    cedula: string;
    faceDescriptor?: unknown;
}

interface FaceRegistrationModalProps {
    employee: Employee;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type ModalStep = 'info' | 'capture' | 'processing' | 'success' | 'error';

export function FaceRegistrationModal({
    employee,
    isOpen,
    onClose,
    onSuccess
}: FaceRegistrationModalProps) {
    const [step, setStep] = useState<ModalStep>('info');
    const [error, setError] = useState<string>('');

    if (!isOpen) return null;

    const handleStartCapture = () => {
        setStep('capture');
        setError('');
    };

    const handleCapture = async (descriptorString: string) => {
        setStep('processing');

        try {
            const result = await registerFace(employee.id, descriptorString);

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
            console.error('Face registration error:', err);
            setError('Error de conexión. Intente nuevamente.');
            setStep('error');
        }
    };

    const handleCaptureError = (errorMsg: string) => {
        setError(errorMsg);
        setStep('error');
    };

    const handleCaptureCancel = () => {
        setStep('info');
    };

    const handleClose = () => {
        setStep('info');
        setError('');
        onClose();
    };

    const handleRetry = () => {
        setStep('info');
        setError('');
    };

    const hasExistingFace = Boolean(employee.faceDescriptor);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={step === 'capture' ? undefined : handleClose}
                />

                {/* Modal */}
                <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                                <Camera className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {hasExistingFace ? 'Actualizar Rostro' : 'Registrar Rostro'}
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
                    <div className="p-5">
                        {/* Step: Info */}
                        {step === 'info' && (
                            <div className="space-y-4">
                                {/* Employee Info Card */}
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-slate-700 rounded-full">
                                            <User className="h-6 w-6 text-slate-300" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">
                                                {employee.firstName} {employee.lastName}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                Cédula: {employee.cedula}
                                            </p>
                                        </div>
                                        {hasExistingFace && (
                                            <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                                Rostro registrado
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="space-y-2 text-sm text-slate-300">
                                    <p className="font-medium text-white">Instrucciones:</p>
                                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                                        <li>Asegúrese de tener buena iluminación</li>
                                        <li>Mire directamente a la cámara</li>
                                        <li>Retire lentes oscuros o accesorios que cubran el rostro</li>
                                        <li>Mantenga una expresión neutral</li>
                                    </ul>
                                </div>

                                {hasExistingFace && (
                                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                        <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-yellow-300">
                                            Este empleado ya tiene un rostro registrado.
                                            Continuar reemplazará el registro anterior.
                                        </p>
                                    </div>
                                )}

                                {/* Privacy Notice */}
                                <p className="text-xs text-slate-500 text-center">
                                    Solo se almacenan datos matemáticos del rostro, nunca la imagen.
                                    <br />
                                    Cumplimiento con Ley 81 de Protección de Datos.
                                </p>

                                <button
                                    onClick={handleStartCapture}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Camera className="h-5 w-5" />
                                    Iniciar Captura
                                </button>
                            </div>
                        )}

                        {/* Step: Capture */}
                        {step === 'capture' && (
                            <div className="min-h-[400px]">
                                <FaceCapture
                                    onCapture={handleCapture}
                                    onError={handleCaptureError}
                                    onCancel={handleCaptureCancel}
                                />
                            </div>
                        )}

                        {/* Step: Processing */}
                        {step === 'processing' && (
                            <div className="py-12 text-center space-y-4">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
                                <div>
                                    <p className="text-white font-medium">Procesando biometría...</p>
                                    <p className="text-sm text-slate-400">
                                        Guardando datos faciales de forma segura
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step: Success */}
                        {step === 'success' && (
                            <div className="py-12 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <Check className="h-8 w-8 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-lg">
                                        ¡Rostro Registrado!
                                    </p>
                                    <p className="text-sm text-slate-400">
                                        {employee.firstName} puede usar reconocimiento facial
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step: Error */}
                        {step === 'error' && (
                            <div className="py-8 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-lg">
                                        Error al Registrar
                                    </p>
                                    <p className="text-sm text-red-400">
                                        {error}
                                    </p>
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
