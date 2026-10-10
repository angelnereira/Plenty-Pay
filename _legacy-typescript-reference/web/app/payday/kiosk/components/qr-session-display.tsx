'use client';

import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode'; // Client-side QR generation
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';

interface QRSessionDisplayProps {
    action: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
    onSuccess: (employeeName: string) => void;
    onCancel: () => void;
}

export function QRSessionDisplay({ action, onSuccess, onCancel }: QRSessionDisplayProps) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('PENDING');

    // Create Session
    useEffect(() => {
        const createSession = async () => {
            try {
                const res = await fetch('/api/payday/kiosk/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });

                if (!res.ok) throw new Error('Error creating session');

                const data = await res.json();
                setSessionId(data.sessionId);

                // Generate QR URL: https://app.plentypay.com/payday/mobile/verify/[sessionId]
                // For dev/test, use current origin
                const verifyUrl = `${window.location.origin}/payday/mobile/verify/${data.sessionId}`;
                const qrUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 2 });
                setQrDataUrl(qrUrl);

            } catch (err) {
                console.error(err);
                setError('No se pudo generar el código QR. Intenta de nuevo.');
            }
        };

        createSession();
    }, [action]);

    // Poll Status
    useEffect(() => {
        if (!sessionId || status === 'COMPLETED') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/payday/kiosk/session/${sessionId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'COMPLETED') {
                        setStatus('COMPLETED');
                        onSuccess(data.employeeName || 'Empleado');
                    }
                }
            } catch (e) {
                // Ignore poll errors
            }
        }, 2000); // Check every 2 seconds

        return () => clearInterval(interval);
    }, [sessionId, status, onSuccess]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400 gap-4">
                <p>{error}</p>
                <button onClick={onCancel} className="px-4 py-2 bg-slate-800 rounded-lg">Volver</button>
            </div>
        );
    }

    if (!qrDataUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-blue-400 gap-4">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p>Generando código QR único...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-500">
            <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
                <img src={qrDataUrl} alt="Scan to Verify" className="w-64 h-64" />
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    <Smartphone className="w-6 h-6 text-blue-400" />
                    Escanea con tu celular
                </h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                    Abre la cámara de tu teléfono y escanea este código para confirmar tu identidad de forma segura.
                </p>
            </div>

            <button
                onClick={onCancel}
                className="mt-8 px-6 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-400 rounded-lg text-sm transition-colors"
            >
                Cancelar
            </button>
        </div>
    );
}
