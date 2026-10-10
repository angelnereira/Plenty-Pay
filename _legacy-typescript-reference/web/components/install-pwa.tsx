"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Listener para el evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setIsVisible(true)
      console.log('📲 PWA: Prompt de instalación disponible')
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listener para detectar cuando se instala la app
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App instalada exitosamente')
      setIsInstalled(true)
      setIsVisible(false)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    try {
      // Mostrar el prompt de instalación
      await installPrompt.prompt()

      // Esperar la respuesta del usuario
      const { outcome } = await installPrompt.userChoice

      console.log(`📲 PWA: Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`)

      if (outcome === 'accepted') {
        setIsVisible(false)
        setInstallPrompt(null)
      }
    } catch (error) {
      console.error('❌ PWA: Error al instalar', error)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    // Guardar en localStorage para no mostrar por un tiempo
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // No mostrar si ya está instalado o si no hay prompt disponible
  if (isInstalled || !isVisible || !installPrompt) {
    return null
  }

  return (
    <>
      {/* Banner en la parte superior */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white shadow-lg animate-slide-down">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Download className="h-6 w-6 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm md:text-base">
                  Instala PlentyPay en tu dispositivo
                </p>
                <p className="text-xs md:text-sm opacity-90 hidden md:block">
                  Acceso rápido, trabaja offline y recibe notificaciones
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Instalar</span>
                <span className="sm:hidden">Instalar</span>
              </button>

              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer para evitar que el contenido quede oculto */}
      <div className="h-16 md:h-20" />
    </>
  )
}

// Componente para el botón flotante (alternativa)
export function InstallPWAButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setInstallPrompt(null)
      }
    } catch (error) {
      console.error('Error al instalar:', error)
    }
  }

  // No mostrar si ya está instalado o no hay prompt
  if (isInstalled || !installPrompt) {
    return null
  }

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-lg"
      title="Instalar PlentyPay"
    >
      <Download className="h-4 w-4" />
      <span className="text-sm font-medium">Instalar App</span>
    </button>
  )
}

