"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react" // Import from client package
import { Loader2 } from "lucide-react"

export default function ImpersonatePage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get("token")
    const [error, setError] = useState("")

    useEffect(() => {
        if (!token) {
            setError("Token inválido o faltante")
            return
        }

        const performLogin = async () => {
            try {
                const result = await signIn("credentials", {
                    impersonationToken: token,
                    redirect: false,
                    callbackUrl: "/dashboard",
                })

                if (result?.error) {
                    setError("Error de autenticación: " + result.error)
                } else if (result?.ok) {
                    router.push("/dashboard")
                    router.refresh()
                }
            } catch (err: any) {
                setError("Error al iniciar sesión: " + err.message)
            }
        }

        performLogin()
    }, [token, router])

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg border border-red-200 dark:border-red-900">
                    <h1 className="text-red-600 font-bold text-xl mb-4">Error de Suplantación</h1>
                    <p className="text-slate-600 dark:text-slate-300">{error}</p>
                    <button
                        onClick={() => router.push("/dashboard/admin/users")}
                        className="mt-6 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                    >
                        Volver al Admin
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
            <h2 className="text-2xl font-bold">Iniciando modo Dios...</h2>
            <p className="text-slate-400">Accediendo como el usuario seleccionado</p>
        </div>
    )
}
