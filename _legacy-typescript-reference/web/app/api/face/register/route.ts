import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database/prisma';

/**
 * POST /api/face/register
 * Registers a face descriptor for an employee
 * 
 * Body: { employeeId: string, faceDescriptor: number[] }
 */
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { employeeId, faceDescriptor } = body;

        // Validate input
        if (!employeeId || typeof employeeId !== 'string') {
            return NextResponse.json(
                { error: 'Employee ID is required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
            return NextResponse.json(
                { error: 'Invalid face descriptor format. Expected 128-float array.' },
                { status: 400 }
            );
        }

        // Validate all elements are numbers
        if (!faceDescriptor.every(val => typeof val === 'number' && !isNaN(val))) {
            return NextResponse.json(
                { error: 'Face descriptor must contain only valid numbers' },
                { status: 400 }
            );
        }

        // Verify employee exists and user has access
        const employee = await prisma.paydayEmployee.findUnique({
            where: { id: employeeId },
            select: { id: true, clientId: true, firstName: true, lastName: true }
        });

        if (!employee) {
            return NextResponse.json(
                { error: 'Employee not found' },
                { status: 404 }
            );
        }

        // Authorization: Check if user belongs to same client (unless super admin)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { clientId: true, role: true }
        });

        if (user?.role !== 'SUPER_ADMIN' && user?.clientId !== employee.clientId) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Update employee with face descriptor
        await prisma.paydayEmployee.update({
            where: { id: employeeId },
            data: {
                faceDescriptor: faceDescriptor,
                faceIdHash: 'REGISTERED_V1' // Legacy compatibility flag
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Face registered successfully',
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`
            }
        });

    } catch (error) {
        console.error('[API] Face registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
