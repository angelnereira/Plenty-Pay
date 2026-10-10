"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Lock, CheckCircle, XCircle, Loader2, Shield } from "lucide-react"

export default function SetupPasswordPage() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token") || ""

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [name, setName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isVerifying, setIsVerifying] = useState(true)
    const [tokenValid, setTokenValid] = useState(false)
    const [tokenError, setTokenError] = useState("")
    const [userEmail, setUserEmail] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!token) {
            setIsVerifying(false)
            setTokenError("Enlace inválido.")
            return
        }

        fetch("/api/auth/verify-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, type: "setup" }),
        })
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    setTokenValid(true)
                    setUserEmail(data.email || "")
                } else {
                    setTokenError(data.error || "Token inválido.")
                }
            })
            .catch(() => setTokenError("Error verificando el enlace."))
            .finally(() => setIsVerifying(false))
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (password.length < 12) {
            setError("La contraseña debe tener al menos 12 caracteres.")
            return
        }

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.")
            return
        }

        setIsLoading(true)

        try {
            const res = await fetch("/api/auth/setup-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, name: name || undefined }),
            })

            const data = await res.json()

            if (data.success) {
                setSuccess(true)
            } else {
                setError(data.error || "Error al configurar la contraseña.")
            }
        } catch {
            setError("Error de conexión. Intenta nuevamente.")
        } finally {
            setIsLoading(false)
        }
    }

    if (isVerifying) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Verificando invitación...</p>
                </div>
            </div>
        )
    }

    if (!tokenValid) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Enlace Inválido</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">{tokenError}</p>
                        <p className="text-sm text-gray-500">Contacta al administrador para recibir una nueva invitación.</p>
                    </div>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
                <div className="w-full max-w-md text-center">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cuenta Configurada</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Tu contraseña ha sido configurada exitosamente. Ya puedes iniciar sesión.
                        </p>
                        <Link
                            href="/auth/signin"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Iniciar Sesión
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
                            <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Configura tu Cuenta
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {userEmail && <>Configurando cuenta para <strong>{userEmail}</strong></>}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nombre Completo (opcional)
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Tu nombre"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                minLength={12}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Mínimo 12 caracteres"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Confirmar Contraseña
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                required
                                minLength={12}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="Repite la contraseña"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Configurando..." : "Configurar cuenta"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
