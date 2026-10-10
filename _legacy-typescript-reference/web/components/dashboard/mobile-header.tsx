'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Bell, User, LogOut, X, Settings } from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { clearSessionPersisted } from '@/lib/session-persister';

interface MobileHeaderProps {
    userName: string;
    avatarUrl?: string;
    className?: string; // Allow external styling
}

export function MobileHeader({ userName, avatarUrl, className }: MobileHeaderProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleTheme = () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = async () => {
        try {
            await clearSessionPersisted();
        } catch (e) {
            console.error("Error clearing session background flag:", e);
        }
        await signOut({ callbackUrl: '/auth/signin' });
    };

    const handleNotifications = () => {
        router.push('/dashboard/notificaciones');
    };

    const firstName = userName?.split(' ')[0] || 'Usuario';

    return (
        <>
            <header
                className={cn(
                    'fixed top-0 left-0 right-0 z-40',
                    'flex items-center justify-between',
                    'px-4 py-3',
                    'transition-all duration-200',
                    scrolled ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shadow-sm' : 'bg-white/60 dark:bg-slate-950/60 backdrop-blur-md',
                    className // Merge external classes
                )}
            >
                {/* Left: Avatar and Greeting */}
                <button
                    onClick={() => setShowUserMenu(true)}
                    className="flex items-center gap-3"
                >
                    {/* Avatar */}
                    <div
                        className={cn(
                            'flex items-center justify-center',
                            'w-10 h-10 rounded-full',
                            'bg-gradient-to-br from-violet-500 to-purple-600',
                            'ring-2 ring-gray-200 dark:ring-white/[0.08]'
                        )}
                    >
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={firstName}
                                width={40}
                                height={40}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <User className="h-5 w-5 text-white" />
                        )}
                    </div>

                    {/* Greeting */}
                    <div className="flex flex-col text-left">
                        <span className="text-xs text-gray-500 dark:text-slate-400">Bienvenido</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{firstName}</span>
                    </div>
                </button>

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
                    {/* Theme Toggle */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={cn(
                            'p-2.5 rounded-lg',
                            'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                            'hover:bg-gray-100 dark:hover:bg-white/[0.05]',
                            'transition-colors duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-violet-500'
                        )}
                    >
                        {mounted && resolvedTheme === 'dark' ? (
                            <Sun className="h-5 w-5" />
                        ) : (
                            <Moon className="h-5 w-5" />
                        )}
                    </button>

                    {/* Notifications Button */}
                    <button
                        type="button"
                        onClick={handleNotifications}
                        className={cn(
                            'p-2.5 rounded-lg',
                            'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
                            'hover:bg-gray-100 dark:hover:bg-white/[0.05]',
                            'transition-colors duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-violet-500'
                        )}
                    >
                        <Bell className="h-5 w-5" />
                    </button>
                </div>
            </header>


            {/* User Menu Bottom Sheet */}
            {showUserMenu && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 dark:bg-black/60 z-50 animate-in fade-in duration-200"
                        onClick={() => setShowUserMenu(false)}
                    />

                    {/* Bottom Sheet */}
                    <div
                        className={cn(
                            'fixed bottom-0 left-0 right-0 z-50',
                            'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl',
                            'border-t border-gray-200 dark:border-white/[0.08]',
                            'rounded-t-2xl',
                            'animate-in slide-in-from-bottom duration-300',
                            'pb-safe shadow-2xl'
                        )}
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/[0.1]" />
                        </div>

                        {/* User Info */}
                        <div className="flex items-center gap-4 px-4 pb-4 border-b border-gray-200 dark:border-white/[0.08]">
                            <div
                                className={cn(
                                    'flex items-center justify-center',
                                    'w-14 h-14 rounded-full',
                                    'bg-gradient-to-br from-blue-500 to-indigo-600'
                                )}
                            >
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt={firstName}
                                        width={56}
                                        height={56}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    <User className="h-7 w-7 text-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{userName}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Mi Cuenta</p>
                            </div>
                            <button
                                onClick={() => setShowUserMenu(false)}
                                className="p-2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="py-2">
                            <Link
                                href="/dashboard/configuracion"
                                onClick={() => setShowUserMenu(false)}
                                className={cn(
                                    'w-full flex items-center gap-4 px-4 py-4',
                                    'transition-colors',
                                    'hover:bg-gray-50 dark:hover:bg-white/[0.05]',
                                    'active:bg-gray-100 dark:active:bg-white/[0.08]'
                                )}
                            >
                                <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/[0.08]">
                                    <Settings className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        Configuración
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-500">
                                        Ajustes de la cuenta
                                    </p>
                                </div>
                            </Link>

                            <button
                                onClick={handleLogout}
                                className={cn(
                                    'w-full flex items-center gap-4 px-4 py-4',
                                    'transition-colors',
                                    'hover:bg-red-50 dark:hover:bg-red-500/10',
                                    'active:bg-red-100 dark:active:bg-red-500/20'
                                )}
                            >
                                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/10">
                                    <LogOut className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-red-600 dark:text-red-400">
                                        Cerrar Sesión
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-500">
                                        Salir de tu cuenta
                                    </p>
                                </div>
                            </button>
                        </div>

                        {/* Spacer for bottom nav */}
                        <div className="h-20" />
                    </div>
                </>
            )}
        </>
    );
}
