/**
 * Camera Permission Utilities
 * Provides detailed diagnostics for camera permission issues
 */

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export interface CameraPermissionResult {
    state: PermissionState;
    hasCamera: boolean;
    errorDetails?: string;
    browserInfo: string;
}

/**
 * Check camera permission state without requesting access
 */
export async function checkCameraPermission(): Promise<CameraPermissionResult> {
    const browserInfo = navigator.userAgent;

    try {
        // Check if camera API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return {
                state: 'denied',
                hasCamera: false,
                errorDetails: 'MediaDevices API not available. Check HTTPS and browser compatibility.',
                browserInfo
            };
        }

        // Try to get permission state (Permissions API - not supported in all browsers)
        if (navigator.permissions && navigator.permissions.query) {
            try {
                // @ts-ignore - camera permission may not be in types
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                return {
                    state: permissionStatus.state as PermissionState,
                    hasCamera: true,
                    browserInfo
                };
            } catch (e) {
                // Permissions API not fully supported, fallback to device enumeration
                console.warn('[CameraPermission] Permissions API not supported:', e);
            }
        }

        // Fallback: enumerate devices to check if camera exists
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === 'videoinput');

        return {
            state: hasVideoInput ? 'prompt' : 'unknown',
            hasCamera: hasVideoInput,
            errorDetails: hasVideoInput ? undefined : 'No camera device detected',
            browserInfo
        };

    } catch (error) {
        return {
            state: 'unknown',
            hasCamera: false,
            errorDetails: `Error checking permissions: ${error}`,
            browserInfo
        };
    }
}

/**
 * Request camera access with detailed error reporting
 */
export async function requestCameraAccess(constraints: MediaStreamConstraints = {
    video: { facingMode: 'user' },
    audio: false
}): Promise<{ stream?: MediaStream; error?: string }> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return { stream };
    } catch (error: any) {
        console.error('[CameraAccess] Error:', error);

        let errorMessage = 'Error desconocido al acceder a la cámara';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permiso de cámara denegado. Por favor, permite el acceso en la configuración del navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No se encontró ninguna cámara conectada al dispositivo.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'La cámara está siendo usada por otra aplicación. Cierra otras apps que usen la cámara.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = 'La configuración de cámara solicitada no es compatible con tu dispositivo.';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Acceso a cámara bloqueado por seguridad. Verifica que estés usando HTTPS.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Error de configuración de cámara. Constraints inválidos.';
        }

        return { error: errorMessage };
    }
}

/**
 * Get user-friendly message for permission state
 */
export function getPermissionMessage(state: PermissionState): string {
    switch (state) {
        case 'granted':
            return 'Permiso de cámara concedido';
        case 'denied':
            return 'Permiso de cámara denegado. Ve a configuración del navegador para habilitarlo.';
        case 'prompt':
            return 'Se solicitará permiso de cámara al continuar';
        default:
            return 'Estado de permiso desconocido';
    }
}
