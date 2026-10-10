/**
 * Enhanced Activity Types for Payday Module
 * 
 * Type definitions for improved attendance activity tracking and display.
 */

/**
 * Enhanced attendance activity with employee details for dashboard display
 */
export interface EnhancedAttendanceActivity {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        position: string | null;
        department: string | null;
    };
    checkIn: Date;
    checkOut: Date | null;
    status: 'OPEN' | 'COMPLETED';
    entryMethod: 'PIN_CODE' | 'FACE_RECOGNITION' | 'QR' | 'NFC' | null;
    exitMethod: 'PIN_CODE' | 'FACE_RECOGNITION' | 'QR' | 'NFC' | null;
    regularHours: number;
    overtime25: number;
    overtime50: number;
    overtime75: number;
    shiftDate: Date;
}

/**
 * Method badge display configuration
 */
export const METHOD_BADGE_CONFIG = {
    PIN_CODE: {
        label: 'PIN',
        color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
        icon: '🔢'
    },
    FACE_RECOGNITION: {
        label: 'Face',
        color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
        icon: '👤'
    },
    QR: {
        label: 'QR',
        color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        icon: '📱'
    },
    NFC: {
        label: 'NFC',
        color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        icon: '📡'
    }
} as const;
