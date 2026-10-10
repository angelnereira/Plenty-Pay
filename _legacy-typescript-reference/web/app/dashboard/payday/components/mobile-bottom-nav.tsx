'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Users, Clock, BarChart2 } from 'lucide-react';

interface NavButton {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavButton[] = [
    { icon: LayoutGrid, label: 'Dashboard', href: '/dashboard/payday' },
    { icon: Users, label: 'Equipo', href: '/dashboard/payday/employees' },
    { icon: Clock, label: 'Kiosco', href: '/payday/kiosk' },
    { icon: BarChart2, label: 'Reportes', href: '/dashboard/payday/reports' },
];

export function MobileBottomNav() {
    const pathname = usePathname();

    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 safe-area-inset-bottom">
            <div className="grid grid-cols-4 gap-1 px-2 pt-2 pb-safe-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all active:scale-95 ${isActive
                                    ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'font-black' : 'font-semibold'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
