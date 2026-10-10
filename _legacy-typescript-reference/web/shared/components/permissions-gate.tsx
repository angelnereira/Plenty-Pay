'use client';

import React from 'react';
import { useDevicePermissions } from '@/shared/hooks/use-device-permissions';
import { Camera, Mic, Lock, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PermissionsGateProps {
    children: React.ReactNode;
    required: ('camera' | 'microphone')[];
    title?: string;
    description?: string;
}

export function PermissionsGate({
    children,
    required,
    title = "Permisos Requeridos",
    description = "Esta aplicación necesita acceso a tus dispositivos para funcionar correctamente."
}: PermissionsGateProps) {
    const { permissions, requestPermissions, isLoading, error } = useDevicePermissions();

    // Check if all required permissions are granted
    const allGranted = required.every(type => permissions[type] === 'granted');
    const anyDenied = required.some(type => permissions[type] === 'denied');

    const handleGrant = () => {
        requestPermissions(required);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="animate-pulse flex flex-col items-center">
                    <ShieldCheck className="w-12 h-12 text-slate-600 mb-4" />
                    <p className="text-slate-400">Verificando permisos...</p>
                </div>
            </div>
        );
    }

    if (allGranted) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">

                {/* Icon Header */}
                <div className="flex justify-center mb-6 relative">
                    <div className="bg-blue-500/10 p-6 rounded-full ring-1 ring-blue-500/20">
                        {anyDenied ? (
                            <Lock className="w-12 h-12 text-red-400" />
                        ) : (
                            <ShieldCheck className="w-12 h-12 text-blue-400" />
                        )}
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    {anyDenied
                        ? (error || "Has bloqueado el acceso a nuestra aplicación. No podemos continuar sin estos permisos.")
                        : description
                    }
                </p>

                {/* Status List */}
                <div className="bg-slate-950/50 rounded-xl p-4 mb-8 space-y-3 border border-slate-800/50">
                    {required.includes('camera') && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Camera className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-200">Cámara</span>
                            </div>
                            <StatusBadge state={permissions.camera} />
                        </div>
                    )}
                    {required.includes('microphone') && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Mic className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-200">Micrófono</span>
                            </div>
                            <StatusBadge state={permissions.microphone} />
                        </div>
                    )}
                </div>

                {/* Actions */}
                {anyDenied ? (
                    <div className="space-y-4">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-200 text-left flex gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p>
                                Por favor abre la configuración de tu navegador (usualmente un ícono de candado en la barra de dirección) y permite el acceso. Luego recarga la página.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Recargar Página
                        </button>
                        <button
                            onClick={handleGrant}
                            className="w-full bg-slate-800/50 hover:bg-slate-700/50 text-blue-400 font-medium py-3 rounded-xl transition-colors border border-blue-500/20"
                        >
                            Intentar nuevamente
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGrant}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] hover:shadow-[0_0_25px_-5px_rgba(37,99,235,0.7)]"
                    >
                        Permitir Acceso
                    </button>
                )}

                <p className="mt-6 text-xs text-slate-600">
                    PlentyPay Respeta tu privacidad. Solo usamos estos dispositivos para tu identificación en el sistema.
                </p>
            </div>
        </div>
    );
}

function StatusBadge({ state }: { state: string }) {
    if (state === 'granted') {
        return (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-400/10 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                PERMITIDO
            </span>
        );
    }
    if (state === 'denied') {
        return (
            <span className="flex items-center gap-1 text-red-400 text-xs font-bold px-2 py-1 bg-red-400/10 rounded-full">
                <Lock className="w-3 h-3" />
                BLOQUEADO
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-amber-400 text-xs font-bold px-2 py-1 bg-amber-400/10 rounded-full">
            REQUERIDO
        </span>
    );
}
