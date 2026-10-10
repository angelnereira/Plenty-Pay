"use client"

import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

// Rutas base donde NO queremos que aparezca el botón "Volver"
// Estas suelen ser las raíces de cada módulo.
const ROOT_PATHS = [
    "/dashboard",
    "/dashboard/configuracion",
    "/dashboard/configuracion/suscripcion",
    "/dashboard/inventory",
    "/dashboard/pos",
    "/dashboard/payday",
    "/dashboard/admin",
    "/dashboard/facturas"
]

export function GlobalBackButton() {
    const router = useRouter()
    const pathname = usePathname()

    // Comprobamos si la ruta actual es una de las raíces
    // Usamos split para limpiar query params u hash por si acaso, aunque usePathname() ya viene limpio
    const isRootPath = ROOT_PATHS.includes(pathname)

    // Si es una ruta raíz, no mostramos el botón
    if (isRootPath) {
        return null
    }

    const handleBack = () => {
        // Lógica segura de retorno
        if (window.history.length > 2) {
            router.back()
        } else {
            // Hotlink fallback: subimos un nivel en la jerarquía de la URL
            const segments = pathname.split('/')
            segments.pop() // Quitamos el último segmento
            const parentPath = segments.join('/')

            // Si por error bajamos demasiado, aseguramos que siempre vaya a /dashboard
            router.push(parentPath || '/dashboard')
        }
    }

    return (
        <button
            onClick={handleBack}
            className={cn(
                "hidden md:inline-flex items-center gap-2 mb-4 px-3 py-1.5",
                "text-sm font-medium text-muted-foreground hover:text-foreground",
                "bg-background/40 hover:bg-muted/60 backdrop-blur-md",
                "border border-border/50 rounded-lg shadow-sm",
                "transition-all duration-200 ease-in-out",
                "focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
            aria-label="Volver a la página anterior"
        >
            <ChevronLeft className="h-4 w-4" />
            <span>Volver</span>
        </button>
    )
}
