"use server";

import { auth } from "@core/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs"; // Ensure bcryptjs is installed/used

export async function verifyPasswordAction(password: string) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return { success: false, error: "No autorizado" };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user || !user.password) {
        return { success: false, error: "Usuario no encontrado" };
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
        return { success: true };
    } else {
        return { success: false, error: "Contraseña incorrecta" };
    }
}
