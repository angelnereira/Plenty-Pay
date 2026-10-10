'use client';

import { UserPlus, Clock, DollarSign, Users } from 'lucide-react';
import { ActionChip } from './action-chip';

export function MobileHeader() {
    return (
        <div className="md:hidden space-y-4">
            {/* Compact Title */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    Nómina
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Gestión de Tiempo
                </p>
            </div>

            {/* Grid Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
                <ActionChip
                    icon={Users}
                    label="Ver Empleados"
                    href="/dashboard/payday/employees"
                    variant="secondary"
                    className="w-full"
                />
                <ActionChip
                    icon={UserPlus}
                    label="Agregar"
                    href="/dashboard/payday/employees/new"
                    variant="primary"
                    className="w-full"
                />
                <ActionChip
                    icon={Clock}
                    label="Kiosco"
                    href="/payday/kiosk"
                    variant="dark"
                    className="w-full"
                />
                <ActionChip
                    icon={DollarSign}
                    label="Generar Pago"
                    onClick={() => alert('Generar pago - próximamente')}
                    variant="primary"
                    className="w-full"
                />
            </div>
        </div>
    );
}
