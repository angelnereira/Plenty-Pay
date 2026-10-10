"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  // Prevenir hydration mismatch
  useEffect(() => {
    setMounted(true)
    console.log('🌓 ThemeToggle mounted')
    console.log('Theme:', theme)
    console.log('Resolved Theme:', resolvedTheme)
  }, [theme, resolvedTheme])

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 transition-colors"
        disabled
        aria-label="Cargando tema..."
      >
        <div className="h-5 w-5" />
      </button>
    )
  }

  // Usar resolvedTheme para obtener el tema real
  const currentTheme = resolvedTheme || theme

  const toggleTheme = () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    console.log('🌓 Toggling theme from', currentTheme, 'to', newTheme)
    setTheme(newTheme)
    
    // Force update del DOM
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      aria-label={currentTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={currentTheme === "dark" ? "Modo oscuro activo - Click para modo claro" : "Modo claro activo - Click para modo oscuro"}
    >
      {currentTheme === "dark" ? (
        <Moon className="h-5 w-5 text-indigo-400" />
      ) : (
        <Sun className="h-5 w-5 text-amber-500" />
      )}
    </button>
  )
}
