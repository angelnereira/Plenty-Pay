import { getPaydayStats } from "@/features/payday/actions/dashboard-stats";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, UserPlus, Clock, Banknote } from "lucide-react";
import Link from "next/link";
import { PaydayStatsGrid } from "./components/payday-stats-grid";
import { MobileHeader } from "./components/mobile-header";
import { MobileBottomNav } from "./components/mobile-bottom-nav";
import { ComplianceItem } from "./components/compliance-item";
import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@core/database/prisma-singleton";
import { QuickStatsWidget } from "./components/quick-stats-widget";

export default async function PaydayDashboardPage() {
    const session = await auth();

    if (!session) {
        redirect("/");
    }

    const appUser = await prisma.user.findUnique({
        where: { id: session.user?.id },
        include: { client: true }
    });

    // Redirect if user doesn't have client
    if (!appUser?.client) {
        redirect("/dashboard");
    }

    // Module access check - only allow if paydayEnabled or user is SUPER_ADMIN
    if (!appUser.client.paydayEnabled && session.user?.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-full mb-6">
                    <Clock className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    El módulo de nómina no está habilitado para su plan actual.
                    Contacte con soporte para activarlo.
                </p>
                <Link
                    href="/dashboard"
                    className="text-violet-600 hover:text-violet-700 font-medium"
                >
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    const clientId = appUser.client.id;
    const stats = await getPaydayStats(clientId);

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-slate-50 dark:bg-transparent min-h-screen pb-24 md:pb-8">
            {/* Mobile Hero (title + action chips) */}
            <MobileHeader />

            {/* Desktop Header Section */}
            <div className="hidden md:flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                        Centro de Comando de Nómina
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Gestión de Tiempo y Cumplimiento Legal
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/payday/employees/new">
                        <button className="bg-violet-600 text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-all font-bold shadow-lg shadow-violet-500/20 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Agregar Empleado
                        </button>
                    </Link>
                    <Link href="/dashboard/payday/employees">
                        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Ver Empleados
                        </button>
                    </Link>
                    <Link href="/payday/kiosk" target="_blank">
                        <button className="bg-slate-900 dark:bg-white/[0.05] text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-white/[0.1] transition-all font-bold flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Abrir Kiosco
                        </button>
                    </Link>
                    <button className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                        <Banknote className="w-4 h-4" />
                        Generar Pago
                    </button>
                </div>
            </div>

            {/* KPI Cards (Client Component) */}
            <PaydayStatsGrid stats={{
                activeEmployeeCount: stats.activeEmployeeCount,
                weeklyHours: stats.weeklyHours,
                estimatedPayroll: stats.estimatedPayroll
            }} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 premium-card p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Actividad Reciente
                        </h3>
                        <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">
                            Ver todo
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {stats.recentActivity.map((record) => {
                            const totalHours = record.regularHours + record.overtime25 + record.overtime50 + record.overtime75;
                            const method = record.entryMethod || 'PIN_CODE';
                            const methodConfig: Record<string, { label: string, color: string, icon: string }> = {
                                PIN_CODE: { label: 'PIN', color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400', icon: '🔢' },
                                FACE_RECOGNITION: { label: 'Face', color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400', icon: '👤' },
                                QR_DYNAMIC: { label: 'QR', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400', icon: '📱' },
                                NFC: { label: 'NFC', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400', icon: '📡' },
                                FINGERPRINT: { label: 'Biom.', color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400', icon: '👆' },
                                MANUAL_ADMIN: { label: 'Manual', color: 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400', icon: '📝' }
                            };

                            const currentConfig = methodConfig[method] || methodConfig.PIN_CODE;

                            return (
                                <div key={record.id} className="group flex items-center justify-between p-3 md:p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.08] hover:border-slate-200 dark:hover:border-white/[0.1] transition-all active:scale-[0.98] md:active:scale-100">
                                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-bold text-base md:text-lg shadow-sm shrink-0 ${record.status === 'OPEN' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'}`}>
                                            {record.employee.firstName[0]}{record.employee.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-sm md:text-base text-slate-900 dark:text-white truncate">{record.employee.firstName} {record.employee.lastName}</h4>
                                                <span className={`px-1.5 md:px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] font-bold shrink-0 ${currentConfig.color}`}>
                                                    <span className="hidden sm:inline">{currentConfig.icon} </span>{currentConfig.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <p className="font-medium text-slate-500 dark:text-slate-400 truncate">
                                                    {record.status === 'OPEN' ? 'Entrada registrada' : 'Turno completado'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-black text-sm md:text-base text-slate-900 dark:text-white tracking-tight">
                                            {record.status === 'OPEN'
                                                ? formatDistanceToNow(record.checkIn, { addSuffix: true, locale: es })
                                                : `${totalHours.toFixed(1)}h`
                                            }
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {record.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {stats.recentActivity.length === 0 && (
                            <div className="text-center py-12">
                                <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-white/[0.05] mb-3">
                                    <Clock className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 font-medium">No hay actividad reciente registrada.</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Los registros de asistencia de los últimos 7 días aparecerán aquí.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions / Compliance Status */}
                <div className="space-y-6">
                    <div className="premium-card p-6 md:p-8">
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">
                                Estado Legal
                            </h3>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Resumen Semanal</p>
                        </div>

                        <div className="space-y-5">
                            <ComplianceItem label="Límite Horas Extras" value="12%" status="good" />
                            <ComplianceItem label="Descansos Obligatorios" value="100%" status="good" />
                            <ComplianceItem label="Contratos por Vencer" value="1" status="warning" />
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.05]">
                            <button className="w-full py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 group">
                                Ver Reporte Completo <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    <QuickStatsWidget />
                </div>

            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
        </div>
    );
}
