import React, { Suspense } from "react";
import { prisma } from "@core/database/prisma";
import { ScheduleCalendar } from "./components/schedule-calendar";
import { getCompanyShifts } from "@/features/payday/actions/shifts";
import { getWorkGroups } from "@/features/payday/actions/groups";
import { getAssignments } from "@/features/payday/actions/schedule";

export default async function SchedulePage() {
    const clientId = "cm6nzi045000008l16i82155y"; // TODO: Restore Auth integration
    const today = new Date();

    // Fetch data in parallel
    const [employees, shifts, groups, assignments] = await Promise.all([
        prisma.paydayEmployee.findMany({
            where: { clientId, isActive: true },
            include: { workGroup: true },
            orderBy: { firstName: 'asc' }
        }),
        getCompanyShifts(clientId),
        getWorkGroups(clientId),
        getAssignments(clientId, today)
    ]);

    // Cast assignments to include extended types if necessary or ensure getAssignments returns what we need
    // getAssignments returns matches with includes, so it should match the prop type roughly.
    // We might need to map or ensure types match exactly.
    // the component expects: AssignmentWithShift = ScheduleAssignment & { workShift: WorkShift ... }
    // getAssignments in schedule.ts includes workShift.

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Planificación de Horarios</h1>
                <p className="text-slate-500 dark:text-slate-400">Asigna turnos y visualiza la cobertura semanal.</p>
            </div>

            <Suspense fallback={<div>Cargando calendario...</div>}>
                <ScheduleCalendar
                    clientId={clientId}
                    employees={employees}
                    shifts={shifts}
                    workGroups={groups}
                    assignments={assignments as any} // Forced cast for rapid dev, ensure types later
                />
            </Suspense>
        </div>
    );
}
