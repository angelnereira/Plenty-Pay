'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Fingerprint, Loader2, AlertCircle } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { generateAuthOptions, verifyAuth } from '@/features/payday/actions/webauthn';
import { Alert, AlertDescription } from '@/shared/ui/alert';

interface BiometricAuthProps {
    clientId: string;
    onAuthenticated: (employeeId: string, employeeName: string) => void;
    onCancel: () => void;
}

export function BiometricAuth({ clientId, onAuthenticated, onCancel }: BiometricAuthProps) {
    const [status, setStatus] = useState<'IDLE' | 'WAITING_DEVICE' | 'VERIFYING' | 'ERROR'>('IDLE');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const startAuth = async () => {
        setStatus('WAITING_DEVICE');
        setErrorMessage(null);
        try {
            // 1. Get options from server
            const { options, sessionId } = await generateAuthOptions(clientId);

            // 2. Browser handles biometric prompt
            // Note: browser auto-detects if platform authenticator is available
            const authResp = await startAuthentication(options);

            setStatus('VERIFYING');

            // 3. Verify with server
            const result = await verifyAuth(clientId, sessionId, authResp);

            if (result.success && result.employeeId) {
                toast.success(`Identificado: ${result.firstName}`);
                onAuthenticated(result.employeeId, `${result.firstName} ${result.lastName}`);
            }
        } catch (error: any) {
            console.error('Auth error', error);
            setStatus('ERROR');
            if (error.name === 'NotAllowedError') {
                setErrorMessage('Operación cancelada en el dispositivo.');
            } else {
                setErrorMessage(error.message || 'No se pudo verificar la huella digital.');
            }

            // Auto-retry or reset after delay?
            setTimeout(() => setStatus('IDLE'), 3000);
        }
    };

    // Auto-start auth when component mounts
    React.useEffect(() => {
        startAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex flex-col items-center justify-center space-y-6 py-8 w-full max-w-md mx-auto animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
                <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    {status === 'WAITING_DEVICE' || status === 'VERIFYING' ? (
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    ) : (
                        <Fingerprint className="h-12 w-12 text-primary" />
                    )}
                </div>
                <h2 className="text-2xl font-bold">Biometría Requerida</h2>
                <p className="text-muted-foreground">
                    {status === 'WAITING_DEVICE'
                        ? 'Coloque su huella en el sensor...'
                        : status === 'VERIFYING'
                            ? 'Verificando...'
                            : 'Utilice el sensor de huella digital para continuar'}
                </p>
            </div>

            {status === 'ERROR' && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col gap-3 w-full">
                <Button
                    size="lg"
                    onClick={startAuth}
                    disabled={status === 'WAITING_DEVICE' || status === 'VERIFYING'}
                    className="w-full text-lg h-12"
                >
                    {(status === 'WAITING_DEVICE' || status === 'VERIFYING') ? 'Escaneando...' : 'Escanear Huella'}
                </Button>

                <Button variant="ghost" onClick={onCancel}>
                    Cancelar / Volver
                </Button>
            </div>
        </div>
    );
}
