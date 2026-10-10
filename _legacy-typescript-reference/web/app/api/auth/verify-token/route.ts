/**
 * POST /api/auth/verify-token
 *
 * Verifies a security token without consuming it.
 * Used by the frontend to check if a token is valid before showing the form.
 * The actual consumption happens when the password is set.
 *
 * Note: This does NOT consume the token - it only validates it exists and isn't expired.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { prisma } from '@core/database'

const schema = z.object({
    token: z.string().min(1),
    type: z.enum(['reset', 'setup', 'verify']),
})

const TOKEN_TYPE_MAP = {
    reset: 'PASSWORD_RESET',
    setup: 'ACCOUNT_SETUP',
    verify: 'EMAIL_VERIFICATION',
} as const

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validation = schema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ valid: false, error: 'Parámetros inválidos' }, { status: 400 })
        }

        const { token, type } = validation.data
        const tokenHash = createHash('sha256').update(token).digest('hex')
        const dbType = TOKEN_TYPE_MAP[type]

        const securityToken = await prisma.securityToken.findFirst({
            where: {
                tokenHash,
                type: dbType,
            },
            select: {
                usedAt: true,
                expiresAt: true,
                email: true,
            },
        })

        if (!securityToken) {
            // Fallback: tokens del modelo PasswordResetToken (enlaces generados por admin)
            const legacyType = type === 'reset' ? 'PASSWORD_RESET' : type === 'verify' ? 'ACCOUNT_VERIFICATION' : null
            if (legacyType) {
                const legacyToken = await prisma.passwordResetToken.findUnique({
                    where: { token },
                    select: { type: true, usedAt: true, expiresAt: true, user: { select: { email: true } } },
                })
                if (legacyToken && legacyToken.type === legacyType) {
                    if (legacyToken.usedAt) {
                        return NextResponse.json({ valid: false, error: 'Este enlace ya fue utilizado.' })
                    }
                    if (new Date() > legacyToken.expiresAt) {
                        return NextResponse.json({ valid: false, error: 'Este enlace ha expirado.' })
                    }
                    return NextResponse.json({ valid: true, email: legacyToken.user.email })
                }
            }
            return NextResponse.json({ valid: false, error: 'Token inválido o no encontrado.' })
        }

        if (securityToken.usedAt) {
            return NextResponse.json({ valid: false, error: 'Este enlace ya fue utilizado.' })
        }

        if (new Date() > securityToken.expiresAt) {
            return NextResponse.json({ valid: false, error: 'Este enlace ha expirado.' })
        }

        return NextResponse.json({
            valid: true,
            email: securityToken.email,
        })
    } catch (error) {
        console.error('[VerifyToken] Error:', error)
        return NextResponse.json({ valid: false, error: 'Error verificando token.' }, { status: 500 })
    }
}
