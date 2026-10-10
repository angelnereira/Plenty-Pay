"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  useEffect(() => {
    // Verificar si hay mensaje de éxito
    const successParam = searchParams?.get("success")
    if (successParam === "AccountCreated") {
      setSuccess("¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.")

      // Limpiar el parámetro de la URL después de 5 segundos
      setTimeout(() => {
        setSuccess("")
        window.history.replaceState({}, '', '/')
      }, 5000)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError("Email o contraseña incorrectos")
        setIsLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError("Error al iniciar sesión")
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-slate-800">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Iniciar Sesión</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Accede a tu cuenta</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 border border-green-200">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </button>


      </form>

      <p className="mt-6 text-xs text-center text-gray-500 dark:text-slate-500">
        Al iniciar sesión, aceptas nuestros términos y condiciones
      </p>
    </div>
  )
}

