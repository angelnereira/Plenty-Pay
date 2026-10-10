'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Clock, UserCheck, AlertCircle, Fingerprint } from 'lucide-react';
import { processAttendance } from '@/features/payday/actions/check-in';
import { AutoFaceCapture } from './components/auto-face-capture';
import { BiometricAuth } from './components/biometric-auth';
import { PermissionsGate } from '@/shared/components/permissions-gate';

// In a real app, ClientId should be passed from the Server Component wrapper
// Since this is a client file (use client), we expect props.
// However, the previous implementation was a default export page.
// We will modify this to be the Client Component 'KioskContent' and we need a wrapper page.
// But writing this file overwrites the page. 
// So I will make this file export the Page logic assuming it receives props if possible, 
// OR I will refactor it to just be the client logic and keep the page separate.
// Existing file was `export default function PaydayKioskPage`.
// To properly handle clientId, I should probably output a NEW page structure.
// But to avoid file proliferation, I will use a clever trick: 
// I will assume `clientId` is available via a public env or context if I can't fetch it.
// BUT I determined I need `auth()`.
// So I will overwrite this file with the whole new content including the Server Component wrapper if possible?
// No, "use client" must be at top.
// So I need TWO files. 
// 1. `page.tsx` (Server)
// 2. `kiosk-content.tsx` (Client)
// Currently `page.tsx` has `use client`.
// I will RENAME existing `page.tsx` logic to `kiosk-content.tsx` (internal concept) and make `page.tsx` the server component.
// Actually, I can just write `kiosk-content.tsx` and then write `page.tsx`.
// But user directory has `page.tsx`.
// I will creating `components/kiosk-content.tsx` first.

// Wait, I am writing to `app/payday/kiosk/page.tsx` directly in this tool call?
// I should split this.

// Step 1: Create `app/payday/kiosk/kiosk-content.tsx` with the new logic.
// Step 2: Create `app/payday/kiosk/page.tsx` that imports `KioskContent` and passes `clientId`.

// This tool call will create `kiosk-content.tsx`.
// Next tool call will update `page.tsx`.

// CONTENT For `kiosk-content.tsx`:
// Removed PIN/QR. Added BiometricAuth.

interface KioskContentProps {
    clientId: string;
}

type KioskMode = 'IDLE' | 'AUTH' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
type AuthMethod = 'FINGERPRINT' | 'FACE'; // Only biometric

export function KioskContent({ clientId }: KioskContentProps) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [mode, setMode] = useState<KioskMode>('IDLE');
    const [authMethod, setAuthMethod] = useState<AuthMethod>('FINGERPRINT');
    const [targetAction, setTargetAction] = useState<'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END' | null>(null);
    const [message, setMessage] = useState('');
    const [employeeName, setEmployeeName] = useState('');

    // Clock Logic
    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStart = (action: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END') => {
        setTargetAction(action);
        setMode('AUTH');
        setAuthMethod('FINGERPRINT'); // Default to fingerprint
        setMessage('');
    };

    const handleAuthentication = async (identifier: string, method: 'FINGERPRINT' | 'FACE_RECOGNITION') => {
        setMode('PROCESSING');
        const actionMessages: Record<string, string> = {
            CHECK_IN: 'Verificando entrada...',
            CHECK_OUT: 'Procesando salida...',
            BREAK_START: 'Registrando salida a almuerzo...',
            BREAK_END: 'Registrando entrada de almuerzo...'
        };
        setMessage(actionMessages[targetAction!] || 'Procesando...');

        try {
            const result = await processAttendance(identifier, method, targetAction!, clientId);

            if (result.success) {
                setMode('SUCCESS');
                setEmployeeName(result.employeeName || 'Empleado');
                setMessage(result.message);
                setTimeout(() => resetKiosk(), 4000);
            } else {
                setMode('ERROR');
                setMessage(result.message);
                setTimeout(() => {
                    setMode('AUTH');
                }, 3000);
            }
        } catch (e: any) {
            setMode('ERROR');
            setMessage('Error de conexión o validación');
            setTimeout(() => resetKiosk(), 3000);
        }
    };

    const resetKiosk = () => {
        setMode('IDLE');
        setTargetAction(null);
        setAuthMethod('FINGERPRINT');
        setMessage('');
        setEmployeeName('');
    };

    const handleBiometricScan = (payload: string) => {
        handleAuthentication(payload, 'FINGERPRINT');
    }

    const handleFaceCapture = (descriptorString: string) => {
        handleAuthentication(descriptorString, 'FACE_RECOGNITION');
    };

    if (!currentTime) return null;

    return (
        <PermissionsGate required={['camera']}>
            <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden">
                {/* Background */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
                </div>

                <div className="z-10 w-full max-w-4xl p-8 flex flex-col items-center gap-12">
                    {/* Clock Header */}
                    <div className="text-center space-y-2">
                        <h1 className="text-7xl font-bold tracking-tighter bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </h1>
                        <p className="text-slate-400 text-xl font-light">
                            {currentTime.toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Dynamic Content Area */}
                    <div className={`
                    w-full max-w-lg transition-all duration-500 rounded-3xl border backdrop-blur-xl flex flex-col items-center justify-center p-8
                    ${mode === 'IDLE' ? 'aspect-[3/1] bg-white/5 border-white/10' : ''}
                    ${mode === 'AUTH' ? 'min-h-[400px] bg-slate-900/80 border-blue-500/30 ring-2 ring-blue-500/20' : ''}
                    ${mode === 'PROCESSING' ? 'aspect-video bg-blue-900/20 border-blue-500/50' : ''}
                    ${mode === 'SUCCESS' ? 'aspect-video bg-emerald-900/20 border-emerald-500/50 ring-2 ring-emerald-500/30' : ''}
                    ${mode === 'ERROR' ? 'aspect-video bg-red-900/20 border-red-500/50' : ''}
                `}>

                        {mode === 'IDLE' && (
                            <div className="text-center space-y-4 text-slate-400">
                                <div className="flex gap-4 justify-center opacity-50">
                                    <Fingerprint className="w-8 h-8" />
                                    <Camera className="w-8 h-8" />
                                </div>
                                <p>Selecciona ENTRADA o SALIDA para comenzar</p>
                            </div>
                        )}

                        {mode === 'AUTH' && (
                            <div className="w-full h-full flex flex-col items-center">
                                {/* Method Tabs */}
                                <div className="flex gap-1 mb-4 p-1 bg-slate-800 rounded-lg">
                                    <button
                                        onClick={() => setAuthMethod('FINGERPRINT')}
                                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors ${authMethod === 'FINGERPRINT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Fingerprint className="w-4 h-4" /> Huella
                                    </button>
                                    <button
                                        onClick={() => setAuthMethod('FACE')}
                                        className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors ${authMethod === 'FACE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Camera className="w-4 h-4" /> Face ID
                                    </button>
                                </div>

                                {/* Action Title */}
                                <div className="text-center mb-4">
                                    <h3 className="text-xl font-medium text-blue-200">
                                        {targetAction === 'CHECK_IN' ? 'Entrada' : targetAction === 'CHECK_OUT' ? 'Salida' : 'Almuerzo'}
                                    </h3>
                                </div>

                                {/* Biometric Auth */}
                                {authMethod === 'FINGERPRINT' && (
                                    <BiometricAuth
                                        clientId={clientId}
                                        onAuthenticated={(payload) => handleBiometricScan(payload)}
                                        onCancel={resetKiosk}
                                    />
                                )}

                                {/* Auto Face Capture */}
                                {authMethod === 'FACE' && (
                                    <div className="w-full">
                                        <p className="text-center text-sm text-slate-400 mb-4">
                                            Mira a la cámara - El sistema te detectará automáticamente
                                        </p>
                                        <AutoFaceCapture
                                            onCapture={handleFaceCapture}
                                            minConfidence={0.8}
                                            countdownSeconds={2}
                                        />
                                        <button onClick={resetKiosk} className="mt-4 text-red-400 text-sm hover:underline w-full">Cancelar</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'PROCESSING' && (
                            <div className="text-center space-y-4 text-blue-400 animate-pulse">
                                <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-white/5 animate-spin mx-auto" />
                                <p className="text-xl font-medium">{message}</p>
                            </div>
                        )}

                        {mode === 'SUCCESS' && (
                            <div className="text-center space-y-4 text-emerald-400">
                                <UserCheck className="w-20 h-20 mx-auto" />
                                <div>
                                    <h3 className="text-3xl font-bold text-white mb-2">{employeeName}</h3>
                                    <p className="text-xl">{message}</p>
                                </div>
                            </div>
                        )}

                        {mode === 'ERROR' && (
                            <div className="text-center space-y-4 text-red-400">
                                <AlertCircle className="w-20 h-20 mx-auto" />
                                <p className="text-xl font-bold">{message}</p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons (Visible only in IDLE) */}
                    {mode === 'IDLE' && (
                        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                            {/* Main Actions Row */}
                            <button
                                onClick={() => handleStart('CHECK_IN')}
                                className="group relative h-28 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/30 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-2xl font-bold text-emerald-100 group-hover:text-white">ENTRADA</span>
                                <span className="text-xs text-emerald-400/80">Check-In</span>
                            </button>

                            <button
                                onClick={() => handleStart('CHECK_OUT')}
                                className="group relative h-28 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/30 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-2xl font-bold text-rose-100 group-hover:text-white">SALIDA</span>
                                <span className="text-xs text-rose-400/80">Check-Out</span>
                            </button>

                            {/* Lunch Break Actions Row */}
                            <button
                                onClick={() => handleStart('BREAK_START')}
                                className="group relative h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/30 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-lg font-bold text-amber-100 group-hover:text-white">ALMUERZO</span>
                                <span className="text-xs text-amber-400/80">Salida</span>
                            </button>

                            <button
                                onClick={() => handleStart('BREAK_END')}
                                className="group relative h-24 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/30 transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                            >
                                <span className="text-lg font-bold text-sky-100 group-hover:text-white">ALMUERZO</span>
                                <span className="text-xs text-sky-400/80">Entrada</span>
                            </button>
                        </div>
                    )}

                    <div className="text-xs text-slate-600">
                        PlentyPay Payday Module &bull; Biometric Access Only
                    </div>
                </div>
            </div>
        </PermissionsGate>
    );
}
