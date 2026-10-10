'use client';

import Link from 'next/link';
import { Home, FileText, LucideIcon, Package, Store, Clock, Truck, Building2, ArrowUpCircle, Mail, Bell, CreditCard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BottomNavProps {
    userRole?: string;
    facturacionEnabled?: boolean;
    inventoryEnabled?: boolean;
    posEnabled?: boolean;
    paydayEnabled?: boolean;
    logisticsEnabled?: boolean;
    creditosEnabled?: boolean;
}

interface NavItem {
    id: string;
    icon: LucideIcon;
    label: string;
    href: string;
}

export function BottomNav({ userRole, facturacionEnabled, inventoryEnabled, posEnabled, paydayEnabled, logisticsEnabled, creditosEnabled }: BottomNavProps) {
    const pathname = usePathname();

    const isSuperAdmin = userRole === 'SUPER_ADMIN'

    const navItems: NavItem[] = [
        { id: 'home', icon: Home, label: 'Inicio', href: '/dashboard' },
    ];

    if (isSuperAdmin) {
        // Super Admin gets specific administrative modules
        navItems.push(
            { id: 'admin-clients', icon: Building2, label: 'Clientes', href: '/dashboard/admin/clients' },
            { id: 'admin-crm', icon: Mail, label: 'CRM Email', href: '/dashboard/admin/crm' },
            { id: 'admin-upgrades', icon: ArrowUpCircle, label: 'Upgrades', href: '/dashboard/admin/upgrade-requests' },
            { id: 'admin-notifications', icon: Bell, label: 'Notif.', href: '/dashboard/admin/notifications' }
        );
    } else {
        // Regular user modules based on enabled flags
        if (facturacionEnabled) {
            navItems.push({ id: 'invoices', icon: FileText, label: 'Facturas', href: '/dashboard/facturas' });
        }

        if (posEnabled) {
            navItems.push({ id: 'pos', icon: Store, label: 'POS', href: '/dashboard/pos' });
        }

        if (inventoryEnabled) {
            navItems.push({ id: 'inventory', icon: Package, label: 'Inv.', href: '/dashboard/inventory' });
        }

        if (paydayEnabled) {
            navItems.push({ id: 'payday', icon: Clock, label: 'Nómina', href: '/dashboard/payday' });
        }

        if (logisticsEnabled) {
            navItems.push({ id: 'logistics', icon: Truck, label: 'Envíos', href: '/dashboard/logistics' });
        }

        if (creditosEnabled) {
            navItems.push({ id: 'creditos', icon: CreditCard, label: 'Créditos', href: '/dashboard/creditos' });
        }
    }


    const isActive = (item: NavItem): boolean => {
        if (item.href === '/dashboard' && pathname === '/dashboard') {
            return true;
        }
        if (item.href !== '/dashboard' && pathname.startsWith(item.href)) {
            return true;
        }
        return false;
    };

    return (
        <nav
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                'md:hidden'
            )}
        >
            {/* Atmospheric Background with Glassmorphism */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl border-t border-border/50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]" />
            
            <div className="relative safe-area-inset-bottom">
                <div className="flex items-center justify-around h-16 w-full px-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);

                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={cn(
                                    'relative flex flex-col items-center justify-center flex-1 h-full gap-0.5',
                                    'transition-all duration-300 active:scale-90',
                                    'focus:outline-none'
                                )}
                            >
                                {/* Active Indicator Pill */}
                                {active && (
                                    <motion.div
                                        layoutId="nav-pill"
                                        className="absolute inset-0 mx-1 my-1.5 bg-primary/10 rounded-2xl border border-primary/20"
                                        initial={false}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 400,
                                            damping: 30
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-primary/5 blur-md rounded-2xl" />
                                    </motion.div>
                                )}

                                {/* Icon container with micro-animation */}
                                <motion.div 
                                    className={cn(
                                        "relative z-10 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300",
                                        active ? "text-primary scale-110 -translate-y-0.5" : "text-muted-foreground opacity-70"
                                    )}
                                    animate={active ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
                                >
                                    <Icon className={cn(
                                        "h-5 w-5 transition-all duration-300",
                                        active ? "stroke-[2.5px]" : "stroke-[1.5px]"
                                    )} />
                                    
                                    {/* Active Glow for icon */}
                                    {active && (
                                        <div className="absolute inset-0 bg-primary/20 blur-[10px] rounded-full -z-10" />
                                    )}
                                </motion.div>

                                {/* Label with refined typography */}
                                <span
                                    className={cn(
                                        'relative z-10 text-[9px] font-bold tracking-tight transition-all duration-300 uppercase',
                                        active ? "text-primary opacity-100" : "text-muted-foreground opacity-60"
                                    )}
                                >
                                    {item.label}
                                </span>

                                {/* Bottom active dot */}
                                {active && (
                                    <motion.div
                                        layoutId="nav-dot"
                                        className="absolute bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 500,
                                            damping: 30
                                        }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
