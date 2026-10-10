"use server";

import { prisma } from "@core/database/prisma-singleton";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const GroupSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    description: z.string().optional(),
    clientId: z.string(),
});

export async function getWorkGroups(clientId: string) {
    return await prisma.workGroup.findMany({
        where: { clientId },
        include: {
            members: {
                select: { id: true, firstName: true, lastName: true, employeeCode: true }
            },
            _count: {
                select: { members: true }
            }
        },
        orderBy: { name: 'asc' }
    });
}

export async function createWorkGroup(data: z.infer<typeof GroupSchema>) {
    const validData = GroupSchema.parse(data);

    try {
        const group = await prisma.workGroup.create({
            data: validData
        });
        revalidatePath('/dashboard/payday/settings');
        return { success: true, data: group };
    } catch (error) {
        return { success: false, error: 'Error al crear el grupo.' };
    }
}

export async function assignMembersToGroup(groupId: string, employeeIds: string[]) {
    try {
        await prisma.$transaction(
            employeeIds.map(empId =>
                prisma.paydayEmployee.update({
                    where: { id: empId },
                    data: { workGroupId: groupId }
                })
            )
        );
        revalidatePath('/dashboard/payday/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al asignar miembros.' };
    }
}

export async function removeMemberFromGroup(employeeId: string) {
    try {
        await prisma.paydayEmployee.update({
            where: { id: employeeId },
            data: { workGroupId: null }
        });
        revalidatePath('/dashboard/payday/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al remover miembro.' };
    }
}
