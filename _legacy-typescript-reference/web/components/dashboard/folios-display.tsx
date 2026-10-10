"use client"

import { Database } from "lucide-react"

interface FoliosDisplayProps {
    onClick?: () => void
}

/**
 * FoliosDisplay — Botón ligero que NO consulta HKA automáticamente.
 * Solo muestra un botón de "Consultar Folios" que dispara la acción
 * cuando el usuario explícitamente lo presiona.
 * 
 * La consulta real se delega al FoliosConsultationModal que ya existe.
 */
export function FoliosDisplay({ onClick }: FoliosDisplayProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-blue-500/20 dark:bg-blue-500/10 border border-blue-400/30 dark:border-blue-500/20 md:backdrop-blur-sm transition-all hover:scale-105 hover:bg-blue-500/30 dark:hover:bg-blue-500/20 active:scale-95 cursor-pointer"
            title="Click para consultar folios restantes en HKA"
        >
            <Database className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-200 dark:text-blue-400" />
            <span className="text-xs md:text-sm font-semibold text-blue-100 dark:text-blue-400">
                Consultar Folios
            </span>
        </button>
    )
}
