import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import crypto from "crypto"

/**
 * Generate a random 4-digit PIN
 */
function generatePIN(): string {
    return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * Generate a unique qrSecret for QR-based authentication
 */
function generateQRSecret(): string {
    return crypto.randomBytes(32).toString('hex')
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session || !session.user || !session.user.clientId) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            )
        }

        const body = await request.json()
        const {
            firstName,
            lastName,
            email,
            phone,
            cedula,
            position,
            department,
            hourlyRate,
            weeklyHours,
            startDate
        } = body

        console.log('[CREATE_EMPLOYEE] Request from client:', session.user.clientId)

        // Validate required fields
        if (!firstName || !lastName || !cedula || !position || !hourlyRate) {
            return NextResponse.json(
                { error: "Faltan campos requeridos" },
                { status: 400 }
            )
        }

        // Check if cedula already exists for this client
        const existingEmployee = await prisma.paydayEmployee.findFirst({
            where: {
                clientId: session.user.clientId,
                cedula
            }
        })

        if (existingEmployee) {
            return NextResponse.json(
                { error: "Ya existe un empleado con esta cédula" },
                { status: 400 }
            )
        }

        // Generate PIN and QR Secret
        const pinCode = generatePIN()
        const qrSecret = generateQRSecret()

        console.log('[CREATE_EMPLOYEE] Generated PIN:', pinCode.substring(0, 2) + '**')

        // Create employee with correct schema field names
        const employee = await prisma.paydayEmployee.create({
            data: {
                clientId: session.user.clientId,
                firstName,
                lastName,
                email: email || null,
                phone: phone || null,
                cedula,
                hourlyRate: parseFloat(hourlyRate),
                pinCode: pinCode,
                qrSecret: qrSecret,
                isActive: true,
                joinedAt: startDate ? new Date(startDate) : new Date()
            }
        })

        console.log('[CREATE_EMPLOYEE] Success:', employee.id)

        // Create notification for admin
        await prisma.notification.create({
            data: {
                userId: session.user.id,
                type: "SYSTEM_ALERT",
                title: "Nuevo Empleado Registrado",
                message: `${firstName} ${lastName} ha sido agregado al sistema de nómina`,
                link: `/dashboard/payday/employees/${employee.id}`
            }
        })

        return NextResponse.json({
            success: true,
            employee: {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                pinCode: employee.pinCode,
                hasQRAccess: !!employee.qrSecret
            },
            message: "Empleado creado exitosamente"
        })

    } catch (error) {
        console.error("[CREATE_EMPLOYEE] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al crear empleado" },
            { status: 500 }
        )
    }
}
