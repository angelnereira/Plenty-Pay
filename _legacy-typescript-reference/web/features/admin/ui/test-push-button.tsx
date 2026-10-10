"use client"

import { useState } from "react"
import { BellRing, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function TestPushButton() {
    const [isLoading, setIsLoading] = useState(false)

    const handleTestPush = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/admin/notifications/test-push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "PlentyPay - ¡Prueba Exitosa!",
                    body: "Las notificaciones push están configuradas correctamente.",
                    url: "/dashboard/admin/notifications"
                })
            })
            const data = await res.json()

            if (data.success) {
                toast.success(data.message)
            } else {
                toast.error(data.error || "Error al enviar")
            }
        } catch (e) {
            toast.error("Error de conexión")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handleTestPush}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <BellRing className="h-4 w-4" />
            )}
            Probar Push
        </button>
    )
}
