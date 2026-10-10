/**
 * POST /api/auth/reset-password
 *
 * Consumes a password reset token and sets the new password.
 * Supports both token systems:
 * - SecurityToken (hashed, emitted by /api/auth/forgot-password)
 * - PasswordResetToken (emitted by admin via generate-reset-link)
 *
 * Security:
 * - Token is consumed (one-time use) before password update
 * - Password is hashed with bcrypt (10 rounds)
 * - All existing sessions are invalidated after password change
 * - passwordChangedAt is updated (for JWT invalidation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@core/database'
import { verifyAndConsumeToken } from '@/lib/services/security-token.service'

const schema = z.object({
    token: z.string().min(1, 'Token es requerido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
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

        const { token, password } = validation.data
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const userAgent = request.headers.get('user-agent') || 'unknown'

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10)

        // 1) Try the hashed SecurityToken flow (self-service forgot-password)
        const result = await verifyAndConsumeToken(token, 'PASSWORD_RESET', ip, userAgent)

        if (result.valid) {
            // Update user password and invalidate all sessions
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { email: result.email },
                    data: {
                        password: hashedPassword,
                        passwordChangedAt: new Date(),
                    },
                })

                const user = await tx.user.findUnique({
                    where: { email: result.email },
                    select: { id: true },
                })

                if (user) {
                    await tx.session.deleteMany({
                        where: { userId: user.id },
                    })
                    await tx.account.deleteMany({
                        where: {
                            userId: user.id,
                            provider: 'credentials',
                        },
                    })
                }
            })

            return NextResponse.json({
                success: true,
                message: 'Contraseña actualizada exitosamente. Inicia sesión con tu nueva contraseña.',
            })
        }

        // 2) Fallback: PasswordResetToken flow (admin-generated links)
        const record = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        })

        if (!record) {
            return NextResponse.json({ error: result.error || 'Token inválido' }, { status: 400 })
        }

        if (record.usedAt) {
            return NextResponse.json({ error: 'Este enlace ya fue utilizado' }, { status: 400 })
        }

        if (record.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Este enlace ha expirado' }, { status: 400 })
        }

        if (!record.user.isActive) {
            return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 })
        }

        await prisma.$transaction(async (tx) => {
            // Update password
            await tx.user.update({
                where: { id: record.userId },
                data: {
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                },
            })

            // Mark token as used
            await tx.passwordResetToken.update({
                where: { id: record.id },
                data: { usedAt: new Date() },
            })

            // Revoke all active sessions
            await tx.session.deleteMany({
                where: { userId: record.userId },
            })
        })

        return NextResponse.json({
            success: true,
            message: 'Contraseña actualizada exitosamente. Inicia sesión con tu nueva contraseña.',
        })
    } catch (error) {
        console.error('[ResetPassword] Error:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 },
        )
    }
}
