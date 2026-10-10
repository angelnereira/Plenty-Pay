"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock } from "lucide-react"

// Schema de validación
const loginSchema = z.object({
  email: z.string().email("Introduce un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

type LoginFormData = z.infer<typeof loginSchema>

interface EnhancedLoginFormProps {
  successMessage?: string
}

export function EnhancedLoginForm({ successMessage }: EnhancedLoginFormProps) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError("")

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setServerError("Credenciales incorrectas. Verifica email y contraseña.")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setServerError("Error al iniciar sesión. Por favor, intenta de nuevo.")
    }
  }

  return (
    <div className="w-full">
      {/* Header del formulario */}
      <div className="text-center lg:text-left mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Bienvenido de nuevo
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          Ingresa tus credenciales para acceder al panel
        </p>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="mb-6 rounded-lg bg-green-900/30 p-4 border border-green-600/50" role="alert">
          <p className="text-sm text-green-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {successMessage}
          </p>
        </div>
      )}

      {/* Error del servidor */}
      {serverError && (
        <div className="mb-6 rounded-lg bg-red-900/30 p-4 border border-red-600/50" role="alert">
          <p className="text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {serverError}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Input Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Correo Electrónico
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
              className={`
                block w-full pl-10 pr-3 py-3 border rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                ${errors.email ? "border-red-500" : "border-gray-300 dark:border-slate-700"}
                hover:border-gray-400 dark:hover:border-slate-600
                sm:text-sm
                min-h-[44px]
              `}
              placeholder="nombre@empresa.com"
            />
          </div>
          {errors.email && (
            <p id="email-error" role="alert" className="mt-2 text-sm text-red-400 flex items-start gap-1">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Input Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Contraseña
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
              className={`
                block w-full pl-10 pr-12 py-3 border rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                ${errors.password ? "border-red-500" : "border-gray-300 dark:border-slate-700"}
                hover:border-gray-400 dark:hover:border-slate-600
                sm:text-sm
                min-h-[44px]
              `}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors min-h-[44px]"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="mt-2 text-sm text-red-400 flex items-start gap-1">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Recordarme y ¿Olvidaste contraseña? */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 cursor-pointer"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
              Recordarme
            </label>
          </div>

          <div className="text-sm">
            <Link
              href="/auth/forgot-password"
              className="font-medium text-violet-400 hover:text-violet-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-1"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {/* Botón Submit */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`
              w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white
              transition-all duration-150
              ${isSubmitting
                ? "bg-violet-500 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 active:scale-[0.98]"
              }
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 focus:ring-offset-slate-900
              min-h-[44px]
            `}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </div>
      </form>



      {/* Microcopy de confianza */}
      <p className="mt-6 text-xs text-center text-gray-500 dark:text-slate-600 leading-relaxed">
        Al iniciar sesión, aceptas nuestros{" "}
        <Link href="/terms" className="text-violet-400 hover:text-violet-300 underline">
          términos y condiciones
        </Link>
      </p>
    </div>
  )
}
