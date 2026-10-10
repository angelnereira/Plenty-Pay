'use server';

import { prisma } from '@core/database/prisma';
import { revalidatePath } from 'next/cache';
import { generateEmployeeCredentials } from '../lib/credential-generator';
import type { PaydayContractType, PaydayPaymentMode } from '@prisma/client';

export async function registerFace(employeeId: string, descriptorString: string) {
    try {
        const descriptor = JSON.parse(descriptorString);

        if (!Array.isArray(descriptor) || descriptor.length !== 128) {
            return { success: false, message: 'Descriptor facial inválido' };
        }

        await prisma.paydayEmployee.update({
            where: { id: employeeId },
            data: {
                faceDescriptor: descriptor,
                faceIdHash: 'REGISTERED_V1', // Legacy flag or fallback
            }
        });

        revalidatePath('/dashboard/payday/employees');
        revalidatePath(`/dashboard/payday/employees/${employeeId}`);

        return { success: true, message: 'Rostro registrado exitosamente' };
    } catch (error) {
        console.error('Register Face Error:', error);
        return { success: false, message: 'Error interno al guardar biometría' };
    }
}

export interface CreateEmployeeData {
    clientId: string;
    firstName: string;
    lastName: string;
    cedula: string;
    email?: string;
    phone?: string;
    contractType: PaydayContractType;
    paymentMode: PaydayPaymentMode;
    baseSalary: number;
    hourlyRate?: number;
}

export async function createEmployee(data: CreateEmployeeData) {
    try {
        // Generate credentials automatically
        const credentials = await generateEmployeeCredentials(data.clientId);

        const employee = await prisma.paydayEmployee.create({
            data: {
                ...data,
                ...credentials,
                baseSalary: data.baseSalary,
                hourlyRate: data.hourlyRate || null,
            }
        });

        revalidatePath('/dashboard/payday');
        revalidatePath('/dashboard/payday/employees');

        return {
            success: true,
            message: `Empleado ${employee.firstName} registrado exitosamente`,
            employee: {
                id: employee.id,
                employeeCode: employee.employeeCode,
                pinCode: employee.pinCode,
                qrSecret: employee.qrSecret,
            }
        };
    } catch (error: any) {
        console.error('Create Employee Error:', error);

        if (error.code === 'P2002') {
            return { success: false, message: 'Ya existe un empleado con esa cédula' };
        }

        return { success: false, message: 'Error al crear empleado' };
    }
}

export async function getEmployees(clientId: string) {
    try {
        const employees = await prisma.paydayEmployee.findMany({
            where: { clientId },
            orderBy: { employeeCode: 'asc' },
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                cedula: true,
                email: true,
                phone: true,
                contractType: true,
                baseSalary: true,
                isActive: true,
                joinedAt: true,
                pinCode: true,
                qrSecret: true,
                faceIdHash: true,
                nfcTagId: true,
            }
        });

        return { success: true, employees };
    } catch (error) {
        console.error('Get Employees Error:', error);
        return { success: false, message: 'Error al obtener empleados', employees: [] };
    }
}
