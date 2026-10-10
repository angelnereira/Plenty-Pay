import { getEmployees } from '@/features/payday/actions/employee-management';
import { EmployeeCard } from '@/features/payday/components/employee-card';
import { Button } from '@/shared/ui/button';
import { Plus, Users, Filter, Search, Clock } from 'lucide-react';
import Link from 'next/link';
import { EmployeeFilters } from './components/employee-filters';
import { auth } from '@/core/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function EmployeesListPage() {
    const session = await auth();

    if (!session) {
        redirect('/auth/signin');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user?.id },
        include: { client: true }
    });

    if (!user?.client) {
        redirect('/dashboard');
    }

    // Module access check - only allow if paydayEnabled or user is SUPER_ADMIN
    if (!user.client.paydayEnabled && session.user?.role !== "SUPER_ADMIN") {
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

    const clientId = user.client.id;
    const { employees } = await getEmployees(clientId);

    // Calculate stats
    const activeCount = employees.filter(e => e.isActive).length;
    const withFaceCount = employees.filter(e => e.faceIdHash).length;
    const withQRCount = employees.filter(e => e.qrSecret).length;
    const withPINCount = employees.filter(e => e.pinCode).length;

    return (
        <div className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-white/[0.06] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Gestión de Empleados
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {employees.length} empleados totales • {activeCount} activos
                    </p>
                </div>
                <Link href="/dashboard/payday/employees/new">
                    <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Empleado
                    </Button>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label="Activos"
                    value={activeCount}
                    total={employees.length}
                    color="green"
                />
                <StatCard
                    label="Con Face ID"
                    value={withFaceCount}
                    total={employees.length}
                    color="purple"
                />
                <StatCard
                    label="Con QR"
                    value={withQRCount}
                    total={employees.length}
                    color="blue"
                />
                <StatCard
                    label="Con PIN"
                    value={withPINCount}
                    total={employees.length}
                    color="orange"
                />
            </div>

            {/* Filters */}
            <EmployeeFilters />

            {/* Employee Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees.map((emp) => (
                    <EmployeeCard
                        key={emp.id}
                        id={emp.id}
                        employeeCode={emp.employeeCode}
                        firstName={emp.firstName}
                        lastName={emp.lastName}
                        cedula={emp.cedula}
                        contractType={emp.contractType}
                        baseSalary={Number(emp.baseSalary)}
                        isActive={emp.isActive}
                        hasPIN={!!emp.pinCode}
                        hasQR={!!emp.qrSecret}
                        hasFace={!!emp.faceIdHash}
                        hasNFC={!!emp.nfcTagId}
                    />
                ))}
            </div>

            {employees.length === 0 && (
                <div className="premium-card p-12 text-center">
                    <Users className="h-16 w-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        No hay empleados registrados
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Comienza registrando tu primer empleado
                    </p>
                    <Link href="/dashboard/payday/employees/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Registrar Empleado
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorClasses = {
        green: 'from-green-50 to-white border-green-200 text-green-600 dark:from-green-950/20 dark:to-white/[0.06] dark:border-green-500/20 dark:text-green-400',
        purple: 'from-purple-50 to-white border-purple-200 text-purple-600 dark:from-purple-950/20 dark:to-white/[0.06] dark:border-purple-500/20 dark:text-purple-400',
        blue: 'from-blue-50 to-white border-blue-200 text-blue-600 dark:from-blue-950/20 dark:to-white/[0.06] dark:border-blue-500/20 dark:text-blue-400',
        orange: 'from-orange-50 to-white border-orange-200 text-orange-600 dark:from-orange-950/20 dark:to-white/[0.06] dark:border-orange-500/20 dark:text-orange-400',
    }[color];

    return (
        <div className={`premium-card bg-gradient-to-br ${colorClasses} p-4`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{label}</p>
                    <p className="text-2xl font-black mt-1 dark:text-white">
                        {value}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{percentage}% del total</p>
                </div>
                <div className="text-3xl font-bold opacity-20 dark:opacity-30 dark:text-white">
                    {percentage}%
                </div>
            </div>
        </div>
    );
}
