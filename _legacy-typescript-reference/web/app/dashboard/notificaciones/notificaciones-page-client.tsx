'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Bell,
    CheckCircle,
    AlertTriangle,
    Info,
    XCircle,
    Check,
    Loader2,
} from 'lucide-react';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: Date;
}

interface NotificacionesPageClientProps {
    userName: string;
}

export function NotificacionesPageClient({ userName }: NotificacionesPageClientProps) {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAllRead, setMarkingAllRead] = useState(false);

    // Load notifications
    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/notifications?limit=50');
            const data = await response.json();

            if (data.success) {
                setNotifications(data.data.notifications);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            toast.error('Error al cargar notificaciones');
        } finally {
            setLoading(false);
        }
    };

    // Mark single notification as read
    const markAsRead = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PATCH',
            });

            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        setMarkingAllRead(true);
        try {
            await fetch('/api/notifications/mark-all-read', {
                method: 'PATCH',
            });

            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            toast.success('Todas las notificaciones marcadas como leídas');
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Error al marcar notificaciones');
        } finally {
            setMarkingAllRead(false);
        }
    };

    // Get icon based on notification type
    const getIcon = (type: string) => {
        switch (type) {
            case 'SUCCESS':
                return <CheckCircle className="h-5 w-5 text-emerald-500" />;
            case 'WARNING':
                return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'ERROR':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    // Get background color based on notification type
    const getIconBg = (type: string) => {
        switch (type) {
            case 'SUCCESS':
                return 'bg-emerald-100 dark:bg-emerald-500/20';
            case 'WARNING':
                return 'bg-amber-100 dark:bg-amber-500/20';
            case 'ERROR':
                return 'bg-red-100 dark:bg-red-500/20';
            default:
                return 'bg-blue-100 dark:bg-blue-500/20';
        }
    };

    // Format relative time
    const formatRelativeTime = (date: Date) => {
        return formatDistanceToNow(new Date(date), { addSuffix: false, locale: es });
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-transparent pb-24">
            {/* Page Header */}
            <div className="sticky top-[60px] z-10 bg-white/90 dark:bg-white/[0.03] backdrop-blur-md px-4 py-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-xl text-gray-900 dark:text-white">
                        Notificaciones
                    </h1>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            disabled={markingAllRead}
                            className={cn(
                                'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
                                'bg-gray-100 dark:bg-slate-800',
                                'text-gray-700 dark:text-gray-300',
                                'hover:bg-gray-200 dark:hover:bg-slate-700',
                                'disabled:opacity-50'
                            )}
                        >
                            {markingAllRead ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Marcar todas como leídas'
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <main className="px-4 py-4 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                        <p className="mt-4 text-gray-500 dark:text-gray-400">
                            Cargando notificaciones...
                        </p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="p-4 bg-gray-100 dark:bg-slate-800 rounded-full mb-4">
                            <Bell className="h-12 w-12 text-gray-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Sin notificaciones
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mt-2 max-w-xs">
                            Cuando tengas nuevas notificaciones, aparecerán aquí
                        </p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                                'w-full text-left p-4 rounded-xl transition-all',
                                'bg-white dark:bg-slate-900',
                                'border border-gray-200 dark:border-slate-800',
                                'shadow-sm',
                                !notification.read && 'ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                            )}
                        >
                            <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div
                                    className={cn(
                                        'p-2 rounded-xl shrink-0',
                                        getIconBg(notification.type)
                                    )}
                                >
                                    {getIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {notification.title}
                                        </h3>
                                        {!notification.read && (
                                            <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-md">
                                                Nueva
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                        Hace {formatRelativeTime(notification.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </main>

            {/* Bottom Navigation */}
            <BottomNav />
        </div>
    );
}
