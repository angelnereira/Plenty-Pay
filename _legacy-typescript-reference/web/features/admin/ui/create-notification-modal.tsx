"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, Bell } from "lucide-react"

interface CreateNotificationModalProps {
    isOpen: boolean
    onClose: () => void
}

export function CreateNotificationModal({ isOpen, onClose }: CreateNotificationModalProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const [formData, setFormData] = useState({
        title: "",
        message: "",
        type: "INFO",
        targetAll: true,
        targetPlans: [] as string[],
    })

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const response = await fetch("/api/admin/broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Error al crear notificación")
            }

            router.refresh()
            onClose()

            // Reset form
            setFormData({
                title: "",
                message: "",
                type: "INFO",
                targetAll: true,
                targetPlans: [],
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Bell className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                Nueva Notificación
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Título
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                placeholder="Ej: Nueva función disponible"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Mensaje
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                placeholder="Describe la notificación..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            >
                                <option value="INFO">Información</option>
                                <option value="WARNING">Advertencia</option>
                                <option value="MAINTENANCE">Mantenimiento</option>
                                <option value="FEATURE">Nueva Función</option>
                            </select>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="targetAll"
                                checked={formData.targetAll}
                                onChange={(e) => setFormData({ ...formData, targetAll: e.target.checked })}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="targetAll" className="text-sm text-gray-700 dark:text-gray-300">
                                Enviar a todos los usuarios
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                disabled={isLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <Bell className="h-4 w-4 mr-2" />
                                        Crear Notificación
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
