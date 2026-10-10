"use client"

import { WifiOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@shared/ui/button'

export default function OfflinePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <div className="mb-6 rounded-full bg-muted p-6">
                <WifiOff className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="mb-2 text-2xl font-bold tracking-tight">Sin Conexión</h1>
            <p className="mb-8 max-w-md text-muted-foreground">
                Parece que no tienes conexión a internet.
                PlentyPay funciona parcialmente en modo offline, pero algunas funciones pueden estar limitadas.
            </p>
            <div className="flex gap-4">
                <Button asChild variant="outline">
                    <Link href="/dashboard">
                        Ir al Dashboard
                    </Link>
                </Button>
                <Button onClick={() => window.location.reload()}>
                    Reintentar
                </Button>
            </div>
        </div>
    )
}
