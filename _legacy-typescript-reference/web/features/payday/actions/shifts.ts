"use server";

import { prisma } from "@core/database/prisma-singleton";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ShiftSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
    breakDuration: z.number().min(0, "Debe ser mayor o igual a 0"),
    gracePeriodMinutes: z.number().min(0).default(0),
    color: z.string().optional(),
    clientId: z.string(),
});

export async function getCompanyShifts(clientId: string) {
    return await prisma.workShift.findMany({
        where: { clientId, isActive: true },
        orderBy: { name: 'asc' }
    });
}

export async function createWorkShift(data: z.infer<typeof ShiftSchema>) {
    const validData = ShiftSchema.parse(data);

    try {
        const shift = await prisma.workShift.create({
            data: {
                ...validData,
                isActive: true
            }
        });
        revalidatePath('/dashboard/payday/settings'); // Or wherever this list is shown
        return { success: true, data: shift };
    } catch (error) {
        return { success: false, error: 'Error al crear el turno. Verifique si el nombre ya existe.' };
    }
}

export async function updateWorkShift(id: string, data: Partial<z.infer<typeof ShiftSchema>>) {
    try {
        const shift = await prisma.workShift.update({
            where: { id },
            data
        });
        revalidatePath('/dashboard/payday/settings');
        return { success: true, data: shift };
    } catch (error) {
        return { success: false, error: 'Error al actualizar el turno.' };
    }
}

export async function deleteWorkShift(id: string) {
    try {
        // Soft delete
        await prisma.workShift.update({
            where: { id },
            data: { isActive: false }
        });
        revalidatePath('/dashboard/payday/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al eliminar el turno.' };
    }
}
