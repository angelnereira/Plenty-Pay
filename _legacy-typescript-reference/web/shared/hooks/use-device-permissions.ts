import { useState, useEffect, useCallback } from 'react';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface PermissionStatus {
    camera: PermissionState;
    microphone: PermissionState;
}

export function useDevicePermissions() {
    const [permissions, setPermissions] = useState<PermissionStatus>({
        camera: 'unknown',
        microphone: 'unknown'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial check using Permissions API (Metadata only)
    const checkPermissions = useCallback(async () => {
        if (typeof navigator === 'undefined') {
            setIsLoading(false);
            return;
        }

        // Helper to check specific permission safely
        const queryPermission = async (name: string): Promise<PermissionState> => {
            try {
                // @ts-ignore
                const result = await navigator.permissions.query({ name });

                // Add listener for changes
                result.onchange = () => {
                    setPermissions(prev => ({
                        ...prev,
                        [name === 'camera' ? 'camera' : 'microphone']: result.state
                    }));
                };

                return result.state;
            } catch (e) {
                return 'prompt'; // Fallback for Firefox/Safari if query fails
            }
        };

        try {
            const camState = await queryPermission('camera');
            const micState = await queryPermission('microphone');

            setPermissions(prev => ({
                camera: prev.camera === 'granted' ? 'granted' : camState, // Don't downgrade if we already verified
                microphone: prev.microphone === 'granted' ? 'granted' : micState
            }));
        } catch (err: any) {
            console.error('Permission Check Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const requestPermissions = async (types: ('camera' | 'microphone')[]) => {
        setIsLoading(true);
        setError(null);
        try {
            const constraints: MediaStreamConstraints = {};
            if (types.includes('camera')) constraints.video = true;
            if (types.includes('microphone')) constraints.audio = true;

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // If successful, stop tracks immediately
            stream.getTracks().forEach(track => track.stop());

            // Force update state to 'granted' because we just proved it works
            setPermissions(prev => ({
                camera: types.includes('camera') ? 'granted' : prev.camera,
                microphone: types.includes('microphone') ? 'granted' : prev.microphone
            }));

            return true;
        } catch (err: any) {
            console.error('Permission Request Error:', err);

            let message = 'Error desconocido al acceder a dispositivos.';
            let isDennied = false;

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                message = 'Permisos denegados por el usuario o el sistema.';
                isDennied = true;
            } else if (err.name === 'NotFoundError') {
                message = 'No se encontró cámara o micrófono en este dispositivo.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                message = 'El dispositivo está siendo usado por otra aplicación.';
            } else if (err.name === 'OverconstrainedError') {
                message = 'La cámara no cumple con los requisitos solicitados.';
            }

            if (isDennied) {
                setPermissions(prev => ({
                    camera: types.includes('camera') ? 'denied' : prev.camera,
                    microphone: types.includes('microphone') ? 'denied' : prev.microphone
                }));
            }

            setError(message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkPermissions();
    }, [checkPermissions]);

    return {
        permissions,
        isLoading,
        error,
        requestPermissions,
        checkPermissions
    };
}
