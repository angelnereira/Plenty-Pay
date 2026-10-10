"use client"

import { useState, useEffect } from "react"
import { Bell, X, CheckCircle, AlertTriangle, Info, XCircle, Settings, CheckCheck } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { usePushNotifications } from "@/features/notifications/hooks/use-push-notifications"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: Date
}



export function NotificationsCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const { subscribe, isSupported, permissionState, subscription, isLoading: isPushLoading } = usePushNotifications()

  // Cargar notificaciones
  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications?limit=20")
      const data = await response.json()

      if (data.success) {
        setNotifications(data.data.notifications)
        setUnreadCount(data.data.unreadCount)
      }
    } catch (error) {
      console.error("Error al cargar notificaciones:", error)
    } finally {
      setLoading(false)
    }
  }

  // Cargar al abrir
  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  // Marcar como leída
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error al marcar como leída:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      // Idealmente endpoint bulk, pero por ahora loop o update many
      // Simplificación: Update UI y llamar endpoint que marca todas
      await fetch(`/api/notifications/mark-all-read`, { method: "PATCH" })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e) { console.error(e) }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "SUCCESS": return <CheckCircle className="h-5 w-5 text-green-500" />
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "ERROR": return <XCircle className="h-5 w-5 text-red-500" />
      default: return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  // Group notifications
  const groupedNotifications = {
    today: notifications.filter(n => isToday(new Date(n.createdAt))),
    yesterday: notifications.filter(n => isYesterday(new Date(n.createdAt))),
    older: notifications.filter(n => !isToday(new Date(n.createdAt)) && !isYesterday(new Date(n.createdAt)))
  }

  const renderGroup = (title: string, items: Notification[]) => {
    if (items.length === 0) return null
    return (
      <div className="mb-4">
        <h4 className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
          {title}
        </h4>
        <div>
          {items.map(notification => (
            <div key={notification.id}
              className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!notification.read ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                }`}
              onClick={() => !notification.read && markAsRead(notification.id)}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {format(new Date(notification.createdAt), "HH:mm", { locale: es })}
                  </p>
                </div>
                {!notification.read && (
                  <div className="h-2 w-2 bg-indigo-600 dark:bg-indigo-400 rounded-full shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center h-5 w-5 bg-red-500 dark:bg-red-600 text-white text-xs font-bold rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden flex flex-col max-h-[85vh]">

            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Marcar todo leido">
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Push Permission Request */}
            {isSupported && permissionState !== 'granted' && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                    <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Habilitar notificaciones Push</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Recibe alertas importantes incluso con la app cerrada.</p>
                    <button
                      onClick={subscribe}
                      disabled={isPushLoading}
                      className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition-colors"
                    >
                      {isPushLoading ? "Activando..." : "Activar Notificaciones"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-y-auto scrollbar-hide flex-1">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No hay notificaciones</p>
                </div>
              ) : (
                <>
                  {renderGroup("Hoy", groupedNotifications.today)}
                  {renderGroup("Ayer", groupedNotifications.yesterday)}
                  {renderGroup("Antiguas", groupedNotifications.older)}
                </>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
              <Link href="/dashboard/notificaciones" className="text-xs text-indigo-600 hover:underline">
                Ver historial completo
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

