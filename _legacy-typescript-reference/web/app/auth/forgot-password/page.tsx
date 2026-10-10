"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthShell } from "@/components/auth/auth-shell"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || "Ocurrió un error. Intenta nuevamente.")
      } else {
        setMessage(
          data.message || "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña."
        )
        setEmail("")
      }
    } catch {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      side="minimal"
      title="Recuperar contraseña"
      subtitle="Te enviaremos instrucciones a tu correo."
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

      {message && (
        <div className="mb-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              className={cn(
                "flex h-11 w-full rounded-md px-3 pl-10 text-sm transition-all",
                "bg-background border border-input text-foreground",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/40"
              )}
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
              Enviando…
            </>
          ) : (
            "Enviar instrucciones"
          )}
        </button>
      </form>
    </AuthShell>
  )
}
