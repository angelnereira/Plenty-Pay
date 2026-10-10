"use client";

import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { PaydayEmployee, ScheduleAssignment, WorkShift, WorkGroup } from "@prisma/client";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { createScheduleAssignment } from "@/features/payday/actions/schedule";
import { AssignmentForm } from "./assignment-form";

// Extended types for props
type EmployeeWithGroup = PaydayEmployee & { workGroup: WorkGroup | null };
type AssignmentWithShift = ScheduleAssignment & { workShift: WorkShift, employee: { firstName: string, lastName: string } | null, workGroup: { name: string } | null };

export function ScheduleCalendar({
    employees,
    assignments,
    shifts,
    workGroups,
    clientId
}: {
    employees: EmployeeWithGroup[],
    assignments: AssignmentWithShift[],
    shifts: WorkShift[],
    workGroups: WorkGroup[],
    clientId: string
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    // Helper to find assignment for employee on date
    const getShiftForEmployee = (empId: string, groupId: string | null, date: Date) => {
        // Priority 1: Individual
        const individual = assignments.find(a =>
            a.employeeId === empId &&
            isDateInRange(date, a.startDate, a.endDate) &&
            a.daysOfWeek.includes(date.getDay())
        );
        if (individual) return individual.workShift;

        // Priority 2: Group
        if (groupId) {
            const group = assignments.find(a =>
                a.workGroupId === groupId &&
                isDateInRange(date, a.startDate, a.endDate) &&
                a.daysOfWeek.includes(date.getDay())
            );
            if (group) return group.workShift;
        }
        return null;
    };

    const isDateInRange = (date: Date, start: Date, end: Date | null) => {
        const d = new Date(date.setHours(0, 0, 0, 0));
        const s = new Date(new Date(start).setHours(0, 0, 0, 0));
        const e = end ? new Date(new Date(end).setHours(0, 0, 0, 0)) : null;
        return d >= s && (!e || d <= e);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-xl border">
                <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, -7))}>Anterior</Button>
                    <span className="font-medium capitalize min-w-[200px] text-center">
                        {format(weekStart, "MMMM yyyy", { locale: es })}
                    </span>
                    <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, 7))}>Siguiente</Button>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button>+ Asignar Horario</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <AssignmentForm shifts={shifts} employees={employees} workGroups={workGroups} clientId={clientId} />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-xl border overflow-x-auto scrollbar-hide">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="p-4 text-left min-w-[200px] bg-slate-50 dark:bg-white/[0.06] dark:backdrop-blur-2xl sticky left-0 z-10 border-b border-r">Empleado</th>
                            {weekDays.map(day => (
                                <th key={day.toISOString()} className="p-2 min-w-[120px] text-center border-b font-medium bg-slate-50 dark:bg-white/[0.06] border-l">
                                    <div className="capitalize">{format(day, "EEE", { locale: es })}</div>
                                    <div className="text-xs text-slate-500">{format(day, "d")}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                <td className="p-3 font-medium sticky left-0 bg-white dark:bg-slate-950 border-r z-10">
                                    <div>{emp.firstName} {emp.lastName}</div>
                                    <div className="text-xs text-slate-500 truncate">{emp.workGroup?.name || 'Sin grupo'}</div>
                                </td>
                                {weekDays.map(day => {
                                    const shift = getShiftForEmployee(emp.id, emp.workGroupId, day);
                                    return (
                                        <td key={day.toISOString()} className="p-2 border-l text-center relative group">
                                            {shift ? (
                                                <div
                                                    className="rounded px-2 py-1 text-xs font-semibold truncate cursor-help transform transition-all hover:scale-105"
                                                    style={{ backgroundColor: shift.color + '33', color: shift.color }}
                                                    title={`${shift.name}: ${shift.startTime} - ${shift.endTime}`}
                                                >
                                                    {shift.startTime}-{shift.endTime}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
