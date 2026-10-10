/**
 * Centralized Debug Logger Utility
 * Controls debug output via NEXT_PUBLIC_DEBUG_MODE environment variable
 * 
 * - info/success: Only logs if DEBUG_MODE is 'true'
 * - error: Always logs to console.error for critical issues
 */

type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    data?: any;
    timestamp: string;
}

class DebugLogger {
    private isDebugMode: boolean;

    constructor() {
        // Check if debug mode is explicitly enabled
        this.isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    }

    /**
     * Format log entry with timestamp and context
     */
    private formatLog(entry: LogEntry): string {
        const { level, message, context, timestamp } = entry;
        const prefix = context ? `[${context}]` : '';
        const emoji = this.getEmoji(level);
        return `${emoji} ${timestamp} ${prefix} ${message}`;
    }

    /**
     * Get emoji for log level
     */
    private getEmoji(level: LogLevel): string {
        const emojis = {
            info: '💡',
            success: '[SUCCESS]',
            warn: '[WARN]',
            error: '❌'
        };
        return emojis[level] || '📝';
    }

    /**
     * Get current timestamp
     */
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Info log - only outputs if debug mode is enabled
     */
    info(message: string, context?: string, data?: any): void {
        if (!this.isDebugMode) return; // No-op if debug is off

        const entry: LogEntry = {
            level: 'info',
            message,
            context,
            data,
            timestamp: this.getTimestamp()
        };

        console.log(this.formatLog(entry));
        if (data) {
            console.log('  📊 Data:', data);
        }
    }

    /**
     * Success log - only outputs if debug mode is enabled
     */
    success(message: string, context?: string, data?: any): void {
        if (!this.isDebugMode) return; // No-op if debug is off

        const entry: LogEntry = {
            level: 'success',
            message,
            context,
            data,
            timestamp: this.getTimestamp()
        };

        console.log(this.formatLog(entry));
        if (data) {
            console.log('  📊 Data:', data);
        }
    }

    /**
     * Warning log - only outputs if debug mode is enabled
     */
    warn(message: string, context?: string, data?: any): void {
        if (!this.isDebugMode) return; // No-op if debug is off

        const entry: LogEntry = {
            level: 'warn',
            message,
            context,
            data,
            timestamp: this.getTimestamp()
        };

        console.warn(this.formatLog(entry));
        if (data) {
            console.warn('  📊 Data:', data);
        }
    }

    /**
     * Error log - ALWAYS outputs (even in production)
     * Stack traces are logged server-side but never sent to client
     */
    error(message: string, context?: string, error?: any): void {
        const entry: LogEntry = {
            level: 'error',
            message,
            context,
            data: error,
            timestamp: this.getTimestamp()
        };

        // Always log errors to console.error
        console.error(this.formatLog(entry));

        if (error) {
            // Log full error details server-side
            console.error('  🔍 Error Details:', {
                name: error?.name,
                message: error?.message,
                stack: this.isDebugMode ? error?.stack : '[Stack trace hidden in production]'
            });
        }
    }

    /**
     * Get sanitized error message for client
     * Never expose stack traces or sensitive server info
     */
    getSanitizedError(error: any): string {
        if (typeof error === 'string') return error;

        // In production, provide generic message
        if (!this.isDebugMode) {
            return 'Ocurrió un error. Por favor, intenta nuevamente.';
        }

        // In debug mode, provide more details (but still sanitized)
        return error?.message || 'Error desconocido';
    }

    /**
     * Check if debug mode is active
     */
    isDebug(): boolean {
        return this.isDebugMode;
    }
}

// Export singleton instance
export const debugLogger = new DebugLogger();

// Export type for use in other modules
export type { LogLevel, LogEntry };
