'use server';

import { prismaServer as prisma } from "@core/database";
import { processAttendance } from "./check-in";

export async function verifyKioskSession(sessionId: string, pin: string) {
    try {
        // 1. Validate Session
        const session = await prisma.kioskSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) return { success: false, message: 'Sesión inválida o expirada' };
        if (session.status !== 'PENDING') return { success: false, message: 'Esta sesión ya fue utilizada' };
        if (new Date() > session.expiresAt) return { success: false, message: 'El código QR ha expirado' };

        // 2. Validate Employee PIN
        const employee = await prisma.paydayEmployee.findFirst({
            where: {
                clientId: session.clientId || undefined,
                pinCode: pin,
                isActive: true
            }
        });

        if (!employee) return { success: false, message: 'PIN incorrecto o empleado inactivo' };

        // 3. Process Attendance Logic (Re-using existing check-in logic)
        // action comes from session
        const action = session.action as any;
        const result = await processAttendance(employee.pinCode!, 'QR_DYNAMIC', action, session.clientId!);

        if (!result.success) {
            return { success: false, message: result.message };
        }

        // 4. Update Session to Complete
        await prisma.kioskSession.update({
            where: { id: sessionId },
            data: {
                status: 'COMPLETED',
                employeeId: employee.id
            }
        });

        return { success: true, message: result.message, employeeName: employee.firstName };

    } catch (error) {
        console.error('Verify Session Error:', error);
        return { success: false, message: 'Error interno del servidor' };
    }
}
