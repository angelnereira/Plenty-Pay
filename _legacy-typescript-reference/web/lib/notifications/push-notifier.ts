import * as Sentry from '@sentry/nextjs';
import webpush from 'web-push';
import { prismaServer as prisma } from '@core/database';
import { after } from 'next/server';

// Configure VAPID keys
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.NEXT_PUBLIC_VAPID_SUBJECT || 'mailto:admin@plentypay.com';

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        vapidSubject,
        publicVapidKey,
        privateVapidKey
    );
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
}

/**
 * Enviar notificación push a un usuario específico (Encolado asíncrono)
 */
export async function sendPushNotification(userId: string, payload: PushPayload) {
    if (process.env.NODE_ENV !== 'test') {
        try {
            after(async () => {
                await sendPushNotificationImmediate(userId, payload);
            });
            return { success: true, queued: true };
        } catch (error) {
            console.warn('[PUSH] Error in after(), intentando envío directo...', error);
        }
    }
    return sendPushNotificationImmediate(userId, payload);
}

/**
 * Enviar notificación push a todos (Encolado asíncrono)
 */
export async function broadcastPushNotification(payload: PushPayload) {
    if (process.env.NODE_ENV !== 'test') {
        try {
            after(async () => {
                await broadcastPushNotificationImmediate(payload);
            });
            return { success: true, queued: true };
        } catch (error) {
            console.warn('[PUSH] Error in broadcast after(), intentando envío directo...', error);
        }
    }
    return broadcastPushNotificationImmediate(payload);
}

/**
 * Ejecución inmediata de notificación
 */
export async function sendPushNotificationImmediate(userId: string, payload: PushPayload) {
    return Sentry.startSpan(
        {
            name: 'webpush.send',
            op: 'push.send',
            attributes: { 'push.user_id': userId, 'push.title': payload.title },
        },
        async (span) => {
            try {
                const subscriptions = await prisma.pushSubscription.findMany({
                    where: { userId }
                });

                if (subscriptions.length === 0) {
                    span.setStatus({ code: 1, message: 'no_subscriptions' });
                    return { success: false, message: 'No subscriptions found' };
                }

                span.setAttribute('push.subscription_count', subscriptions.length);
                const notificationPayload = JSON.stringify(payload);

                const results = await Promise.allSettled(
                    subscriptions.map(sub =>
                        webpush.sendNotification(
                            {
                                endpoint: sub.endpoint,
                                keys: {
                                    p256dh: sub.p256dh,
                                    auth: sub.auth
                                }
                            },
                            notificationPayload
                        )
                    )
                );

                // Limpiar suscripciones inválidas (410 Gone o 404 Not Found)
                let cleaned = 0;
                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    if (result.status === 'rejected') {
                        const error = (result as PromiseRejectedResult).reason;
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            console.log(`[PUSH] Removing invalid subscription: ${subscriptions[i].id}`);
                            await prisma.pushSubscription.delete({ where: { id: subscriptions[i].id } });
                            cleaned++;
                        }
                    }
                }

                const sent = results.filter(r => r.status === 'fulfilled').length;
                span.setAttribute('push.sent_count', sent);
                span.setAttribute('push.cleaned_count', cleaned);
                span.setStatus({ code: sent > 0 ? 1 : 2, message: sent > 0 ? 'ok' : 'all_failed' });

                return { success: true, count: sent };
            } catch (error) {
                console.error('[PUSH_ERROR]', error);
                span.setStatus({ code: 2, message: 'unexpected_error' });
                Sentry.captureException(error, {
                    tags: { integration: 'webpush', operation: 'send', user_id: userId },
                });
                return { success: false, error };
            }
        }
    );
}

/**
 * Ejecución inmediata de broadcast (usada por el Worker)
 */
export async function broadcastPushNotificationImmediate(payload: PushPayload) {
    return Sentry.startSpan(
        {
            name: 'webpush.broadcast',
            op: 'push.broadcast',
            attributes: { 'push.title': payload.title },
        },
        async (span) => {
            try {
                const subscriptions = await prisma.pushSubscription.findMany();
                span.setAttribute('push.subscription_count', subscriptions.length);

                const notificationPayload = JSON.stringify(payload);

                const results = await Promise.allSettled(
                    subscriptions.map(sub =>
                        webpush.sendNotification(
                            {
                                endpoint: sub.endpoint,
                                keys: {
                                    p256dh: sub.p256dh,
                                    auth: sub.auth
                                }
                            },
                            notificationPayload
                        )
                    )
                );

                const sent = results.filter(r => r.status === 'fulfilled').length;
                span.setAttribute('push.sent_count', sent);
                span.setStatus({ code: 1, message: 'ok' });

                return { success: true, total: subscriptions.length, sent };
            } catch (e) {
                console.error('[PUSH_BROADCAST_ERROR]', e);
                span.setStatus({ code: 2, message: 'unexpected_error' });
                Sentry.captureException(e, {
                    tags: { integration: 'webpush', operation: 'broadcast' },
                });
                return { success: false, error: e };
            }
        }
    );
}
