'use client';

import React, { useState } from 'react';
import { verifyKioskSession } from '@/features/payday/actions/kiosk-session';
import { Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function MobileVerifyPage() {
    const params = useParams();
    const sessionId = params?.sessionId as string;

    const [pin, setPin] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [message, setMessage] = useState('');
    const [employeeName, setEmployeeName] = useState('');

    const handleSubmit = async () => {
        if (pin.length < 4) return;
        setStatus('PROCESSING');

        try {
            const result = await verifyKioskSession(sessionId, pin);

            if (result.success) {
                setStatus('SUCCESS');
                setEmployeeName(result.employeeName || 'Empleado');
                setMessage(result.message || 'Verificado correctamente');
            } else {
                setStatus('ERROR');
                setMessage(result.message || 'Error de verificación');
                setPin('');
            }
        } catch (e) {
            setStatus('ERROR');
            setMessage('Error de conexión');
        }
    };

    if (status === 'SUCCESS') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 animate-in zoom-in duration-300">
                    <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">¡Confirmado!</h2>
                        <p className="text-lg text-emerald-600 font-medium mt-1">{employeeName}</p>
                    </div>
                    <p className="text-slate-500">{message}</p>
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Ya puedes cerrar esta ventana</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <ShieldCheck className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white">Confirmar Identidad</h1>
                    <p className="text-slate-400 mt-2">Ingresa tu PIN para completar el proceso</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-center gap-4 mb-8">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? 'bg-blue-500 scale-110' : 'bg-slate-700'}`} />
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => pin.length < 4 && setPin(p => p + num)}
                                disabled={status === 'PROCESSING'}
                                className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white text-2xl font-bold transition-all disabled:opacity-50"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={() => setPin('')}
                            disabled={status === 'PROCESSING'}
                            className="h-16 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-red-400 font-bold disabled:opacity-50"
                        >
                            CLR
                        </button>
                        <button
                            onClick={() => pin.length < 4 && setPin(p => p + '0')}
                            disabled={status === 'PROCESSING'}
                            className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white text-2xl font-bold transition-all disabled:opacity-50"
                        >
                            0
                        </button>
                        <button
                            onClick={() => setPin(prev => prev.slice(0, -1))}
                            disabled={status === 'PROCESSING'}
                            className="h-16 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-400 font-bold disabled:opacity-50"
                        >
                            ⌫
                        </button>
                    </div>

                    {status === 'ERROR' && (
                        <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-200 text-sm animate-in shake">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p>{message}</p>
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={pin.length < 4 || status === 'PROCESSING'}
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        {status === 'PROCESSING' ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            'CONFIRMAR'
                        )}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-600 mt-8">
                    Conexión Segura &bull; PlentyPay Payday
                </p>
            </div>
        </div>
    );
}
