/**
 * Mail Utility
 * Centralized email sending using Resend
 * Instrumented with Sentry for monitoring
 */

import * as Sentry from '@sentry/nextjs';
import { Resend } from 'resend';

/**
 * Typed email sender addresses.
 * Each address maps to a specific use case — override via env vars per environment.
 *
 * | Address                  | Env var                  | Use case                                     |
 * |--------------------------|--------------------------|----------------------------------------------|
 * | notifications@plentypay.com | EMAIL_FROM              | Default: activaciones, aprobaciones, alertas |
 * | recovery@plentypay.com      | EMAIL_FROM_RECOVERY     | Recuperación y verificación de contraseña    |
 * | soporte@plentypay.com       | EMAIL_FROM_SUPPORT      | Respuestas a tickets de soporte              |
 * | marketing@plentypay.com     | EMAIL_FROM_MARKETING    | Campañas, promociones, newsletters           |
 */
export const EMAIL_SENDERS = {
    /** Notificaciones transaccionales generales (activaciones, aprobaciones, alertas) */
    notifications: process.env.EMAIL_FROM               ?? 'PlentyPay <notifications@plentypay.com>',
    /** Recuperación de contraseña y verificación de cuenta */
    recovery:      process.env.EMAIL_FROM_RECOVERY      ?? 'PlentyPay <recovery@plentypay.com>',
    /** Respuestas a tickets de soporte */
    support:       process.env.EMAIL_FROM_SUPPORT       ?? 'PlentyPay <soporte@plentypay.com>',
    /** Campañas de marketing, newsletters y promociones */
    marketing:     process.env.EMAIL_FROM_MARKETING     ?? 'PlentyPay <marketing@plentypay.com>',
} as const;

// Lazy initialization of Resend client to prevent build-time errors
let _resend: Resend | null = null;

function getResendClient(): Resend {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('[MAIL] RESEND_API_KEY environment variable is not configured');
        }
        _resend = new Resend(apiKey);
    }
    return _resend;
}

interface EmailAttachment {
    filename: string;
    /** Contenido binario del adjunto. */
    content: Buffer;
}

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    attachments?: EmailAttachment[];
}

interface SendEmailResult {
    success: boolean;
    data?: any;
    error?: string;
    skipped?: boolean;
}

/**
 * Sends an email using Resend
 * Instrumented with Sentry spans for latency & error tracking
 *
 * @param params - Email parameters (to, subject, html, from)
 * @returns Result of the send operation
 */
export async function sendEmail({ to, subject, html, from, attachments }: SendEmailParams): Promise<SendEmailResult> {
    return Sentry.startSpan(
        {
            name: 'resend.emails.send',
            op: 'email.send',
            attributes: {
                'email.subject': subject,
                'email.recipient_count': Array.isArray(to) ? to.length : 1,
            },
        },
        async (span): Promise<SendEmailResult> => {
            const emailConfig = {
                from: from || process.env.EMAIL_FROM || 'PlentyPay <notifications@plentypay.com>',
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                ...(attachments && attachments.length > 0
                    ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) }
                    : {}),
            };

            console.log(`[MAIL] Sending email to: ${emailConfig.to.join(', ')} | Subject: ${subject}`);

            if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
                console.warn('[MAIL] ENABLE_EMAIL_NOTIFICATIONS is not "true". Email was NOT sent.');
                span.setStatus({ code: 1, message: 'disabled' }); // OK
                return {
                    success: false,
                    skipped: true,
                    error: 'El envío de correos está deshabilitado. Configure ENABLE_EMAIL_NOTIFICATIONS=true en las variables de entorno.',
                };
            }

            if (!process.env.RESEND_API_KEY) {
                console.error('[MAIL] RESEND_API_KEY is not configured.');
                span.setStatus({ code: 2, message: 'missing_api_key' }); // ERROR
                return {
                    success: false,
                    error: 'RESEND_API_KEY no está configurada. No se pueden enviar correos.',
                };
            }

            try {
                const { data, error } = await getResendClient().emails.send(emailConfig);

                if (error) {
                    console.error('[MAIL] Resend API error:', JSON.stringify(error));
                    span.setStatus({ code: 2, message: 'resend_api_error' }); // ERROR
                    Sentry.captureException(new Error(`Resend API error: ${JSON.stringify(error)}`), {
                        tags: { integration: 'resend', operation: 'send' },
                    });
                    return {
                        success: false,
                        error: `Error de Resend: ${error.message || JSON.stringify(error)}`,
                    };
                }

                console.log('[MAIL] Email sent successfully via Resend:', data?.id);
                span.setStatus({ code: 1, message: 'ok' }); // OK
                span.setAttribute('email.id', data?.id ?? 'unknown');
                return { success: true, data };
            } catch (error) {
                console.error('[MAIL] Unexpected error:', error);
                span.setStatus({ code: 2, message: 'unexpected_error' }); // ERROR
                Sentry.captureException(error, {
                    tags: { integration: 'resend', operation: 'send' },
                });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Error desconocido al enviar correo',
                };
            }
        }
    );
}
