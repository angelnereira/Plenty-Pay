"use server";

import { prisma } from "@core/database/prisma-singleton";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

const AssignmentSchema = z.object({
    workShiftId: z.string(),
    startDate: z.string().transform(str => new Date(str)), // Expects ISO string YYYY-MM-DD
    endDate: z.string().optional().nullable().transform(str => str ? new Date(str) : null),
    daysOfWeek: z.array(z.number().min(0).max(6)), // 0=Sun, 1=Mon, etc.
    // Target (one of these must be set)
    employeeId: z.string().optional(),
    workGroupId: z.string().optional(),
});

export async function createScheduleAssignment(data: z.infer<typeof AssignmentSchema>) {
    // Validate that at least one target is set
    if (!data.employeeId && !data.workGroupId) {
        return { success: false, error: 'Debe seleccionar un empleado o un grupo.' };
    }

    try {
        const assignment = await prisma.scheduleAssignment.create({
            data: {
                workShiftId: data.workShiftId,
                startDate: data.startDate,
                endDate: data.endDate,
                daysOfWeek: data.daysOfWeek,
                employeeId: data.employeeId,
                workGroupId: data.workGroupId
            }
        });
        revalidatePath('/dashboard/payday/schedule');
        return { success: true, data: assignment };
    } catch (error) {
        return { success: false, error: 'Error al crear la asignación.' };
    }
}

export async function getAssignments(clientId: string, viewDate: Date) {
    // Fetch assignments active around the viewDate
    // This is a simplified list fetch
    return await prisma.scheduleAssignment.findMany({
        where: {
            workShift: { clientId },
            startDate: { lte: endOfDay(viewDate) },
            OR: [
                { endDate: null },
                { endDate: { gte: startOfDay(viewDate) } }
            ]
        },
        include: {
            workShift: true,
            employee: { select: { firstName: true, lastName: true } },
            workGroup: { select: { name: true } }
        }
    });
}

/**
 * Determines the effective WorkShift for an employee on a specific date.
 * Priority: Individual Assignment > Group Assignment
 */
export async function getEffectiveSchedule(employeeId: string, date: Date) {
    const dayOfWeek = date.getDay(); // 0-6
    const targetDate = startOfDay(date);

    // 1. Check Individual Assignment
    const individualAssignment = await prisma.scheduleAssignment.findFirst({
        where: {
            employeeId,
            startDate: { lte: targetDate },
            OR: [
                { endDate: null },
                { endDate: { gte: targetDate } }
            ],
            daysOfWeek: { has: dayOfWeek }
        },
        include: { workShift: true }
    });

    if (individualAssignment) {
        return individualAssignment.workShift;
    }

    // 2. Check Group Assignment
    // First, get the employee's group
    const employee = await prisma.paydayEmployee.findUnique({
        where: { id: employeeId },
        select: { workGroupId: true }
    });

    if (!employee?.workGroupId) return null;

    const groupAssignment = await prisma.scheduleAssignment.findFirst({
        where: {
            workGroupId: employee.workGroupId,
            startDate: { lte: targetDate },
            OR: [
                { endDate: null },
                { endDate: { gte: targetDate } }
            ],
            daysOfWeek: { has: dayOfWeek }
        },
        include: { workShift: true }
    });

    return groupAssignment ? groupAssignment.workShift : null;
}
