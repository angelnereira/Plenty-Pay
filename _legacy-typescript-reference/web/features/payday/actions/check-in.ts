'use server';

import { validateQRToken } from './qr-access';

import { prisma } from '@core/database/prisma-singleton';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { determineShiftType, calculateShiftHours } from '../lib/panama-rules';

function euclideanDistance(desc1: number[], desc2: number[]): number {
    return Math.sqrt(
        desc1
            .map((val, i) => val - desc2[i])
            .reduce((sum, diff) => sum + diff * diff, 0)
    );
}

export type CheckInResult = {
    success: boolean;
    message: string;
    employeeName?: string;
    time?: Date;
};

export type AttendanceMethod = 'PIN_CODE' | 'FACE_RECOGNITION' | 'QR_DYNAMIC' | 'NFC' | 'FINGERPRINT' | 'MANUAL_ADMIN';
export type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';

export async function processAttendance(
    identifier: string,
    method: AttendanceMethod,
    action: AttendanceAction,
    clientId: string, // Mandatory clientId for security
    timestamp?: number // Optional: Provide trusted timestamp for offline sync
): Promise<CheckInResult> {
    // 1. Identification Strategy
    let employee;

    if (!identifier) return { success: false, message: 'No identifier provided' };
    if (!clientId) return { success: false, message: 'Client ID is required' };

    if (method === 'PIN_CODE') {
        employee = await prisma.paydayEmployee.findFirst({
            where: {
                pinCode: identifier,
                isActive: true,
                clientId // Scope to client
            }
        });
    } else if (method === 'NFC') {
        employee = await prisma.paydayEmployee.findFirst({
            where: {
                nfcTagId: identifier,
                isActive: true,
                clientId // Scope to client
            }
        });
    } else if (method === 'QR_DYNAMIC') {
        const qrResult = await validateQRToken(identifier);

        if (!qrResult.valid || !qrResult.employeeId) {
            return { success: false, message: qrResult.message || 'Identificador inválido' };
        }

        employee = await prisma.paydayEmployee.findUnique({
            where: { id: qrResult.employeeId }
        });

        // Verify employee belongs to client
        if (employee && employee.clientId !== clientId) {
            return { success: false, message: 'Credenciales inválidas para este sitio' };
        }

        // Double check active status
        if (employee && !employee.isActive) employee = null;
    } else if (method === 'FACE_RECOGNITION') {
        try {
            const inputDescriptor = JSON.parse(identifier);
            if (!Array.isArray(inputDescriptor) || inputDescriptor.length !== 128) {
                return { success: false, message: 'Datos biométricos inválidos' };
            }

            // Fetch potential matches (employees with registered faces)
            // Note: In a large scale system, we would use a vector DB (pgvector)
            // For < 1000 employees, in-memory calc is fine (< 10ms)
            const candidates = await prisma.paydayEmployee.findMany({
                where: {
                    isActive: true,
                    clientId, // Scope to client
                    faceDescriptor: { not: Prisma.DbNull }
                },
                select: { id: true, firstName: true, faceDescriptor: true, isActive: true, contractType: true, terminatedAt: true }
            });

            let bestMatch = null;
            let minDistance = 0.55; // Threshold (0.55 is strict, 0.6 is loose)

            for (const candidate of candidates) {
                if (!candidate.faceDescriptor) continue;

                const storedDescriptor = candidate.faceDescriptor as unknown as number[];
                const distance = euclideanDistance(inputDescriptor, storedDescriptor);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = candidate;
                }
            }

            if (bestMatch) {
                employee = bestMatch;
            } else {
                return { success: false, message: 'Rostro no reconocido' };
            }
        } catch (e) {
            console.error('Face Auth Error:', e);
            return { success: false, message: 'Error procesando biometría' };
        }
    } else if (method === 'FINGERPRINT') {
        try {
            const { sessionId, response, clientId: authClientId } = JSON.parse(identifier);

            // Validate client ID matches
            if (authClientId && authClientId !== clientId) {
                return { success: false, message: 'Error de validación de sitio' };
            }

            if (!sessionId || !response) {
                return { success: false, message: 'Datos de autenticación incompletos' };
            }

            // Verify with WebAuthn service
            // Dynamic import to avoid circular dependency issues if any, keeping cleaner
            const { verifyAuth } = await import('./webauthn');
            const verification = await verifyAuth(clientId, sessionId, response);

            if (verification.success && verification.employeeId) {
                employee = await prisma.paydayEmployee.findUnique({
                    where: { id: verification.employeeId }
                });

                // Verify employee belongs to client (redundant but safe)
                if (employee && employee.clientId !== clientId) {
                    return { success: false, message: 'Credenciales inválidas para este sitio' };
                }
            } else {
                return { success: false, message: 'Huella no reconocida o sesión expirada' };
            }

        } catch (e) {
            console.error('Fingerprint Auth Error:', e);
            return { success: false, message: 'Error procesando huella digital' };
        }
    }

    if (!employee) {
        return { success: false, message: 'Credenciales inválidas o no reconocidas.' };
    }

    // 2. Process Action
    try {
        switch (action) {
            case 'CHECK_IN':
                return await handleCheckIn(employee, method, timestamp ? new Date(timestamp) : new Date());
            case 'CHECK_OUT':
                return await handleCheckOut(employee, method, timestamp ? new Date(timestamp) : new Date());
            case 'BREAK_START':
                return await handleBreakStart(employee, timestamp ? new Date(timestamp) : new Date());
            case 'BREAK_END':
                return await handleBreakEnd(employee, timestamp ? new Date(timestamp) : new Date());
            default:
                return { success: false, message: 'Acción no reconocida' };
        }
    } catch (error: any) {
        console.error('Attendance Error:', error);
        return { success: false, message: error.message || 'System Error' };
    }
}

// Define exact type for employee with selected fields
type CheckedInEmployee = Prisma.PaydayEmployeeGetPayload<{
    select: { id: true, firstName: true, contractType: true, terminatedAt: true }
}>;

import { getEffectiveSchedule } from './schedule';

async function handleCheckIn(employee: CheckedInEmployee, method: AttendanceMethod, punchTime: Date) {
    // Determine effective schedule for today
    const shift = await getEffectiveSchedule(employee.id, punchTime);

    let scheduledCheckIn: Date | undefined;
    let scheduledCheckOut: Date | undefined;
    let lateMinutes = 0;
    let workShiftId: string | undefined;

    if (shift) {
        workShiftId = shift.id;

        // Parse start time (e.g. "08:00") to Date object on punch day
        const [startH, startM] = shift.startTime.split(':').map(Number);
        scheduledCheckIn = new Date(punchTime);
        scheduledCheckIn.setHours(startH, startM, 0, 0);

        const [endH, endM] = shift.endTime.split(':').map(Number);
        scheduledCheckOut = new Date(punchTime);
        scheduledCheckOut.setHours(endH, endM, 0, 0);

        // Handle overnight shifts (end time < start time) if necessary, 
        // strictly distinct logical days might need better handling in future, 
        // assuming same day or handled by 'shiftDate'.

        // Calculate Lateness
        const graceLimit = new Date(scheduledCheckIn.getTime() + shift.gracePeriodMinutes * 60000);
        if (punchTime > graceLimit) {
            const diffMs = punchTime.getTime() - scheduledCheckIn.getTime();
            lateMinutes = Math.floor(diffMs / 60000);
        }
    }

    // Use transaction to ensure atomic check-in
    return prisma.$transaction(async (tx) => {
        // Check if already checked in within transaction
        const lastRecord = await tx.attendanceRecord.findFirst({
            where: {
                employeeId: employee.id,
                status: 'OPEN'
            }
        });

        if (lastRecord) {
            // Already checked in
            return {
                success: false,
                message: `Ya tienes entrada registrada desde ${lastRecord.checkIn.toLocaleTimeString()}`
            };
        }

        // Validate Contract (Simulated)
        if (employee.contractType === 'OBRA_DETERMINADA' && employee.terminatedAt) {
            return { success: false, message: 'Contrato expirado.' };
        }

        // Create Record atomically
        const newRecord = await tx.attendanceRecord.create({
            data: {
                employeeId: employee.id,
                checkIn: punchTime,
                entryMethod: method,
                status: 'OPEN',
                shiftDate: punchTime,
                // Compliance Data
                workShiftId,
                scheduledCheckIn,
                scheduledCheckOut,
                lateMinutes,
            } as any
        });

        // Revalidate paths after transaction commits
        revalidatePath('/payday/kiosk');
        revalidatePath('/dashboard/payday');

        return {
            success: true,
            message: lateMinutes > 0
                ? `Entrada registrada. Retraso de ${lateMinutes} min.`
                : 'Entrada registrada a tiempo.',
            employeeName: employee.firstName,
            time: newRecord.checkIn
        };
    });
}

async function handleCheckOut(employee: CheckedInEmployee, method: AttendanceMethod, punchTime: Date) {
    // Use transaction to ensure atomic check-out
    return prisma.$transaction(async (tx) => {
        // Find open record within transaction
        const openRecord = await tx.attendanceRecord.findFirst({
            where: {
                employeeId: employee.id,
                status: 'OPEN'
            },
            orderBy: { checkIn: 'desc' }
        });

        if (!openRecord) {
            return { success: false, message: 'No hay turno activo. Registra entrada primero.' };
        }

        const checkOutTime = punchTime;

        // Calculate Hours (Panama Rules)
        const hoursData = calculateShiftHours(openRecord.checkIn, checkOutTime);

        // Update Record atomically
        await tx.attendanceRecord.update({
            where: { id: openRecord.id },
            data: {
                checkOut: checkOutTime,
                status: 'COMPLETED',
                exitMethod: method,
                regularHours: hoursData.regular,
                overtime25: hoursData.shiftType === 'DIURNA' ? hoursData.overtime : 0,
                overtime50: hoursData.shiftType === 'NOCTURNA' ? hoursData.overtime : 0,
                rawDurationMinutes: hoursData.totalHours * 60
            }
        });

        // Revalidate paths after transaction commits
        revalidatePath('/payday/kiosk');
        revalidatePath('/dashboard/payday');

        return {
            success: true,
            message: 'Turno completado. ¡Buen descanso!',
            employeeName: employee.firstName,
            time: checkOutTime
        };
    });
}

async function handleBreakStart(employee: any, punchTime: Date): Promise<CheckInResult> {
    // Find open shift
    const openRecord = await prisma.attendanceRecord.findFirst({
        where: {
            employeeId: employee.id,
            status: 'OPEN'
        },
        orderBy: { checkIn: 'desc' }
    });

    if (!openRecord) {
        return { success: false, message: 'No hay turno activo. Registra entrada primero.' };
    }

    if (openRecord.breakStart) {
        return { success: false, message: 'Ya tienes un almuerzo en progreso.' };
    }

    const breakTime = punchTime;

    await prisma.attendanceRecord.update({
        where: { id: openRecord.id },
        data: { breakStart: breakTime }
    });

    revalidatePath('/payday/kiosk');
    revalidatePath('/dashboard/payday');

    return {
        success: true,
        message: '¡Buen provecho! Disfruta tu almuerzo.',
        employeeName: employee.firstName,
        time: breakTime
    };
}

async function handleBreakEnd(employee: any, punchTime: Date): Promise<CheckInResult> {
    // Find open shift with active break
    const openRecord = await prisma.attendanceRecord.findFirst({
        where: {
            employeeId: employee.id,
            status: 'OPEN',
            breakStart: { not: null },
            breakEnd: null
        },
        orderBy: { checkIn: 'desc' }
    });

    if (!openRecord) {
        return { success: false, message: 'No hay almuerzo activo para registrar entrada.' };
    }

    const breakEndTime = punchTime;

    await prisma.attendanceRecord.update({
        where: { id: openRecord.id },
        data: { breakEnd: breakEndTime }
    });

    revalidatePath('/payday/kiosk');
    revalidatePath('/dashboard/payday');

    return {
        success: true,
        message: '¡Bienvenido de vuelta!',
        employeeName: employee.firstName,
        time: breakEndTime
    };
}
