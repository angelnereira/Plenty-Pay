/**
 * POST /api/auth/setup-password
 *
 * Handles the account setup flow for new B2B users.
 * Consumes the setup token and allows password creation.
 *
 * Flow:
 * 1. Verify and consume the ACCOUNT_SETUP token
 * 2. Set the user's password
 * 3. Update user status to PENDING_ONBOARDING
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@core/database'
import { verifyAndConsumeToken } from '@/lib/services/security-token.service'

const schema = z.object({
    token: z.string().min(1, 'Token es requerido'),
    password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres'),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validation = schema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 },
            )
        }

        const { token, password, name } = validation.data
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const userAgent = request.headers.get('user-agent') || 'unknown'

        // Verify and consume token
        const result = await verifyAndConsumeToken(token, 'ACCOUNT_SETUP', ip, userAgent)

        if (!result.valid) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        // Update user with password and advance status
        const updateData: Record<string, unknown> = {
            password: hashedPassword,
            passwordChangedAt: new Date(),
            status: 'PENDING_ONBOARDING',
            emailVerified: new Date(),
        }

        if (name) {
            updateData.name = name
        }

        const user = await prisma.user.update({
            where: { email: result.email },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                status: true,
                client: {
                    select: { id: true, name: true },
                },
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Contraseña configurada. Continúa con la selección de módulos.',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                status: user.status,
                clientName: user.client?.name,
            },
        })
    } catch (error) {
        console.error('[SetupPassword] Error:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 },
        )
    }
}
