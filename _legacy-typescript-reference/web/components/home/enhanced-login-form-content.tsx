"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { EnhancedLoginForm } from "./enhanced-login-form"

export function EnhancedLoginFormContent() {
  const searchParams = useSearchParams()
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    const successParam = searchParams?.get("success")
    if (successParam === "AccountCreated") {
      setSuccessMessage("¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.")
      
      // Limpiar el parámetro de la URL después de 10 segundos
      setTimeout(() => {
        setSuccessMessage("")
        window.history.replaceState({}, '', '/')
      }, 10000)
    }
  }, [searchParams])

  return <EnhancedLoginForm successMessage={successMessage} />
}

