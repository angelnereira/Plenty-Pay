"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AuthShell } from "@/components/auth/auth-shell"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const success = searchParams.get("success")
    const token = searchParams.get("token")

    if (success === "true") {
      setStatus("success")
      setMessage("¡Tu correo ha sido verificado exitosamente!")
    } else if (token) {
      window.location.href = `/api/auth/verify-email?token=${token}`
    } else {
      setStatus("error")
      setMessage("El enlace de verificación es inválido o ha expirado.")
    }
  }, [searchParams])

  const title =
    status === "loading"
      ? "Verificando tu cuenta…"
      : status === "success"
      ? "¡Verificación exitosa!"
      : "Error de verificación"

  const subtitle =
    status === "loading"
      ? "Estamos validando tu dirección de correo. Un momento por favor."
      : undefined

  return (
    <AuthShell side="minimal" title={title} subtitle={subtitle}>
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div
            className={cn(
              "p-4 rounded-full",
              status === "loading" && "bg-muted",
              status === "success" && "bg-emerald-500/15",
              status === "error" && "bg-destructive/15"
            )}
          >
            {status === "loading" && (
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            )}
            {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
        </div>

        {status !== "loading" && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
            {status === "success" && (
              <>
                <br />
                <br />
                Tu cuenta ha sido enviada a revisión. Recibirás un correo cuando
                el administrador apruebe tu acceso.
              </>
            )}
          </p>
        )}

        {status !== "loading" && (
          <Link
            href="/auth/signin"
            className={cn(
              "inline-flex items-center justify-center gap-2 w-full h-11 rounded-md text-sm font-semibold transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow"
            )}
          >
            Ir al inicio de sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
