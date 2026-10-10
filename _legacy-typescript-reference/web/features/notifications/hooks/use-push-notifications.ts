import { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string | undefined) {
    if (!base64String) return new Uint8Array()
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [isSupported, setIsSupported] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
            setIsSupported(true)
            setPermissionState(Notification.permission)

            // Check existing subscription
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(sub => {
                    if (sub) setSubscription(sub)
                })
            })
        }
    }, [])

    const subscribe = async () => {
        if (!isSupported) return
        setIsLoading(true)

        try {
            if (Notification.permission === 'denied') {
                alert('Las notificaciones están bloqueadas. Habilítalas en tu navegador.')
                return
            }

            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })

            // Send to server
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub })
            })

            setSubscription(sub)
            setPermissionState('granted')

            // Test notification
            new Notification("PlentyPay", { body: "Notificaciones activadas correctamente" })

        } catch (error) {
            console.error('Push subscription failed', error)
            alert('Error al activar notificaciones. Puede que falte configurar VAPID KEYS en el servidor.')
        } finally {
            setIsLoading(false)
        }
    }

    return { subscription, subscribe, isSupported, isLoading, permissionState }
}
