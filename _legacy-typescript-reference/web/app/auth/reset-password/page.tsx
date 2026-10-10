"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Lock, Eye, EyeOff, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthShell } from "@/components/auth/auth-shell"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Verify token on mount (does not consume it)
  useEffect(() => {
    if (!token) {
      setIsVerifying(false)
      setTokenError("Enlace inválido. No se encontró el token.")
      return
    }

    fetch("/api/auth/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, type: "reset" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true)
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

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error al restablecer la contraseña.")
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/auth/signin"), 2500)
    } catch {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const inputClasses = cn(
    "flex h-11 w-full rounded-md px-3 pl-10 text-sm transition-all",
    "bg-background border border-input text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/40"
  )

  // Verificando el enlace
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando enlace…</p>
        </div>
      </div>
    )
  }

  // Enlace inválido o expirado
  if (!tokenValid) {
    return (
      <AuthShell
        side="minimal"
        title="Enlace inválido"
        subtitle="No pudimos validar tu enlace de recuperación."
        backHref="/auth/signin"
        footerSlot={
          <Link href="/auth/signin" className="text-primary hover:underline font-medium">
            Volver a iniciar sesión
          </Link>
        }
      >
        <div className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-6">{tokenError}</p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center justify-center h-11 px-5 rounded-md font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm hover:shadow transition-all duration-200"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      side="minimal"
      title="Nueva contraseña"
      subtitle="Ingresa y confirma tu nueva contraseña."
      backHref="/auth/signin"
      footerSlot={
        <Link href="/auth/signin" className="text-primary hover:underline font-medium">
          Volver a iniciar sesión
        </Link>
      }
    >
      {error && (
        <div className="mb-5 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          ¡Contraseña actualizada! Redirigiendo al inicio de sesión…
        </div>
      )}

      {!success && token && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={cn(inputClasses, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-foreground"
            >
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className={inputClasses}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-11 rounded-md font-semibold text-primary-foreground transition-all duration-200 flex items-center justify-center gap-2",
              "bg-primary hover:bg-primary/90 shadow-sm hover:shadow",
              isLoading && "opacity-70 cursor-wait"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar nueva contraseña"
            )}
          </button>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
