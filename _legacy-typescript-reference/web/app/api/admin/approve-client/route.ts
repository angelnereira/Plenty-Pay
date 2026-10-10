/**
 * POST /api/admin/approve-client
 *
 * Super Admin endpoint to approve a pending client registration.
 *
 * Flow:
 * 1. Validates admin session (SUPER_ADMIN only)
 * 2. Updates client approvalStatus to APPROVED
 * 3. Activates client and requested modules
 * 4. Updates user status to ACTIVE
 * 5. Sends welcome email with cross-selling for non-selected modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@core/auth'
import { prisma } from '@core/database'
import { sendEmail } from '@/lib/mail'
import { welcomeTemplate, getCrossSellModules } from '@/lib/email-templates/welcome'

const schema = z.object({
    clientId: z.string().min(1, 'Client ID es requerido'),
})

export async function POST(request: NextRequest) {
    try {
        // Auth check: SUPER_ADMIN only
        const session = await auth()
        if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const body = await request.json()
        const validation = schema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 },
            )
        }

        const { clientId } = validation.data

        // Get client with its users
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                users: {
                    select: { id: true, name: true, email: true, status: true },
                },
            },
        })

        if (!client) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }

        if (client.approvalStatus === 'APPROVED') {
            return NextResponse.json({ error: 'Este cliente ya está aprobado' }, { status: 400 })
        }

        // Build module activation data from pendingModules
        const moduleData: Record<string, boolean> = {}
        const activeModules: string[] = []

        for (const mod of client.pendingModules) {
            const key = `${mod}Enabled` as string
            moduleData[key] = true
            activeModules.push(mod)
        }

        // Approve client and activate modules in a transaction
        const updatedClient = await prisma.$transaction(async (tx) => {
            // Update client
            const updated = await tx.client.update({
                where: { id: clientId },
                data: {
                    approvalStatus: 'APPROVED',
                    isActive: true,
                    ...moduleData,
                },
            })

            // Update all users of this client to ACTIVE
            await tx.user.updateMany({
                where: {
                    clientId,
                    status: { in: ['PENDING_APPROVAL', 'PENDING_ONBOARDING', 'UNVERIFIED'] },
                },
                data: {
                    status: 'ACTIVE',
                    isActive: true,
                },
            })

            return updated
        })

        // Send welcome email to all users
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plentypay.com'
        const crossSellModules = getCrossSellModules(activeModules)

        const emailErrors: string[] = []
        for (const user of client.users) {
            const html = welcomeTemplate({
                userName: user.name || 'Usuario',
                companyName: client.name,
                loginUrl: `${baseUrl}/auth/signin`,
                activeModules,
                availableModules: crossSellModules,
            })

            const emailResult = await sendEmail({
                to: user.email,
                subject: 'Tu cuenta ha sido aprobada - PlentyPay',
                html,
            })

            if (!emailResult.success) {
                console.error(`[ApproveClient] Failed to send welcome email to ${user.email}:`, emailResult.error)
                emailErrors.push(user.email)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Cliente "${updatedClient.name}" aprobado exitosamente.`,
            client: {
                id: updatedClient.id,
                name: updatedClient.name,
                approvalStatus: updatedClient.approvalStatus,
            },
            ...(emailErrors.length > 0 && {
                warning: `No se pudo enviar el correo a: ${emailErrors.join(', ')}. Verifique la configuración de correos.`,
            }),
        })
    } catch (error) {
        console.error('[ApproveClient] Error:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 },
        )
    }
}
