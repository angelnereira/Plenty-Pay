"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, AlertTriangle } from "lucide-react"
import { User } from "@prisma/client"

interface DeleteUserModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
}

export function DeleteUserModal({ user, isOpen, onClose }: DeleteUserModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen) return null

  const handleDelete = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/users/${user.id}/delete`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar usuario")
      }

      router.refresh()
      onClose()
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

        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>

            <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100 text-center">
              Eliminar Usuario
            </h2>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 text-center">
              ¿Estás seguro de que deseas eliminar a{" "}
              <strong>{user.name}</strong>? Esta acción no se puede deshacer.
            </p>

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900/30 transition-colors"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar Usuario"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

