"use client"

import { Suspense, useEffect, useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import Image from "next/image"
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Sun,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { persistSessionActive } from "@/lib/session-persister"

function FooterThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-7 w-7" aria-hidden />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function SigninContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const error = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        rememberMe,
        redirect: false,
      })

      if (result?.error) {
        setFormError("Credenciales inválidas. Verifica tu correo y contraseña.")
      } else if (result?.ok) {
        try {
          const session = await getSession()
          if (session?.user?.id) {
            await persistSessionActive(session.user.id)
          }
        } catch (persistErr) {
          console.error("Error persisting optimistic session:", persistErr)
        }

        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setFormError("Error al iniciar sesión. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative h-screen h-[100dvh] w-full overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      {/* Gradient orbs — dark mode */}
      <div
        className="hidden dark:block absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-violet-600/20 blur-[120px] animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-5%] w-[50%] h-[50%] rounded-full bg-indigo-600/15 blur-[140px] animate-pulse"
          style={{ animationDuration: "10s" }}
        />
        <div
          className="absolute top-[30%] left-[40%] w-[35%] h-[35%] rounded-full bg-fuchsia-600/10 blur-[100px] animate-pulse"
          style={{ animationDuration: "12s" }}
        />
      </div>

      {/* Gradient orbs — light mode */}
      <div
        className="dark:hidden absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-violet-300/30 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[50%] h-[50%] rounded-full bg-indigo-300/25 blur-[140px]" />
        <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-fuchsia-200/40 blur-[100px]" />
      </div>

      {/* Dot grid texture — dark mode: subtle violet dots */}
      <div
        className="hidden dark:block absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,130,196,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      {/* Dot grid texture — light mode: subtle slate dots */}
      <div
        className="dark:hidden absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(100,116,139,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />

      {/* Main layout */}
      <div className="relative z-10 flex h-full flex-col overflow-hidden px-4 sm:px-6 pt-5 sm:pt-8 pb-2">
        {/* Headline */}
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-[2rem] leading-[1.05] sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Tu negocio,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              un paso adelante
            </span>
          </h1>
        </div>

        {/* Card — flex-1 so it takes remaining height */}
        <div className="flex-1 flex items-center justify-center py-3 sm:py-5 min-h-0">
          <div
            className={cn(
              "w-full max-w-md rounded-2xl p-5 sm:p-7",
              "bg-white/85 dark:bg-white/[0.06] backdrop-blur-2xl",
              "border border-slate-200 dark:border-white/[0.1]",
              "shadow-lg shadow-slate-900/5 dark:shadow-[0_0_80px_-20px_rgba(139,92,246,0.25)]"
            )}
          >
            {/* Header: logo + welcome */}
            <div className="text-center mb-5">
              <Image
                src="/plentypay-logo-light.png"
                alt="PlentyPay"
                width={96}
                height={96}
                priority
                className="mx-auto w-auto h-11 sm:h-12 mb-3 hidden dark:block"
              />
              <Image
                src="/plentypay-logo-dark.png"
                alt="PlentyPay"
                width={96}
                height={96}
                priority
                className="mx-auto w-auto h-11 sm:h-12 mb-3 dark:hidden"
              />
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Bienvenido
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Ingresa a tu cuenta para continuar
              </p>
            </div>

            {/* Error */}
            {(error || formError) && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium">Error de autenticación</p>
                  <p className="text-xs opacity-90">
                    {formError ||
                      "Credenciales inválidas o problema de conexión."}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "flex h-11 w-full rounded-lg px-3 pl-11 text-sm transition-all duration-200",
                      "bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1]",
                      "text-slate-900 dark:text-white",
                      "placeholder:text-slate-400 dark:placeholder:text-slate-600",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50",
                      "hover:border-slate-300 dark:hover:border-white/[0.2]"
                    )}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Contraseña
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400 transition-colors" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "flex h-11 w-full rounded-lg px-3 pl-11 pr-11 text-sm transition-all duration-200",
                      "bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1]",
                      "text-slate-900 dark:text-white",
                      "placeholder:text-slate-400 dark:placeholder:text-slate-600",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50",
                      "hover:border-slate-300 dark:hover:border-white/[0.2]"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2.5">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 text-violet-600 focus:ring-1 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                >
                  Mantener sesión iniciada
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full h-11 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2",
                  "bg-gradient-to-r from-violet-600 to-indigo-600",
                  "hover:from-violet-500 hover:to-indigo-500 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.5)]",
                  "active:scale-[0.99]",
                  isLoading && "opacity-70 cursor-wait"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Conectando…
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </button>

              {/* Signup */}
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-1">
                ¿No tienes una cuenta?{" "}
                <Link
                  href="/auth/signup"
                  className="text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 font-medium transition-colors"
                >
                  Crear cuenta
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Footer: theme toggle + copyright */}
        <footer className="flex items-center justify-center gap-3 pb-2 pt-1">
          <FooterThemeToggle />
          <span className="h-3 w-px bg-slate-300 dark:bg-white/15" aria-hidden />
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            2026 PlentyPay. Todos los derechos reservados.
          </p>
        </footer>
      </div>
    </div>
  )
}

export default function SigninPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen h-[100dvh] flex items-center justify-center bg-white dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <SigninContent />
    </Suspense>
  )
}
