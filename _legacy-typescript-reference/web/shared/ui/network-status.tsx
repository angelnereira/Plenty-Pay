'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wifi, WifiOff } from 'lucide-react'

export function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        // Initial check
        setIsOnline(navigator.onLine)

        const handleOnline = () => {
            setIsOnline(true)
            toast.success('Conexión restaurada', {
                icon: <Wifi className="h-4 w-4" />,
                description: 'Has vuelto a estar en línea.',
                duration: 4000,
            })
        }

        const handleOffline = () => {
            setIsOnline(false)
            toast.error('Sin conexión a internet', {
                icon: <WifiOff className="h-4 w-4" />,
                description: 'La aplicación está funcionando en modo offline.',
                duration: Infinity, // Stay until back online or dismissed
                id: 'offline-toast', // Unique ID to dismiss programmatically if needed
            })
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // We rely on Sonner toasts, so this component renders nothing itself
    return null
}
