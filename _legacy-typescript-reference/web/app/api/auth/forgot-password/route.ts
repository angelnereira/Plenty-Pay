/**
 * POST /api/auth/forgot-password
 *
 * Initiates the password recovery flow:
 * 1. Generates a secure token
 * 2. Creates a QR code of the reset URL
 * 3. Sends the email with both button and QR via Resend
 *
 * Security:
 * - Rate limited (3 requests per 15 min per IP)
 * - User enumeration prevention: always returns success message
 * - Token is hashed before storage (SHA-256)
 * - Token expires in 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, rateLimiters, RateLimitError } from '@core/middleware/rate-limit'
import { prisma } from '@core/database'
import { createSecurityToken } from '@/lib/services/security-token.service'
import { generateQRDataURI } from '@/lib/services/qr-code.service'
import { passwordResetTemplate } from '@/lib/email-templates/password-reset'
import { sendEmail, EMAIL_SENDERS } from '@/lib/mail'

const schema = z.object({
    email: z.string().email('Email inválido'),
})

// Generic success message (prevents user enumeration)
const SUCCESS_MSG = 'Si el correo está registrado, hemos enviado las instrucciones para restablecer tu contraseña.'

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

        // Rate limiting: 3 password reset requests per 15 min per IP
        try {
            await checkRateLimit(rateLimiters.passwordReset, ip)
        } catch (err) {
            if (err instanceof RateLimitError) {
                return NextResponse.json(
                    { message: SUCCESS_MSG },
                    { status: 200, headers: err.toHeaders() },
                )
            }
            // Fail open for infrastructure errors
        }

        const body = await request.json()
        const validation = schema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
        }

        const { email } = validation.data

        // Look up user - but ALWAYS return the same success message
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, isActive: true },
        })

        if (user && user.isActive) {
            // Generate token
            const { rawToken, expiresAt } = await createSecurityToken({
                type: 'PASSWORD_RESET',
                email: user.email,
                userId: user.id,
            })

            // Build reset URL — usar el origin del request para que el enlace
            // apunte al deployment exacto donde está el usuario (evita relay
            // por NEXTAUTH_URL hacia otro environment con Vercel SSO).
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
            const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}&type=reset`

            // Generate QR code
            const qrCodeDataUri = await generateQRDataURI(resetUrl)

            // Calculate expiration in minutes
            const expiresInMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000)

            // Send email via Resend
            const html = passwordResetTemplate({
                userName: user.name || 'Usuario',
                resetUrl,
                qrCodeDataUri,
                expiresInMinutes,
            })

            await sendEmail({
                to: user.email,
                from: EMAIL_SENDERS.recovery,
                subject: 'Restablecer Contraseña - PlentyPay',
                html,
            })
        }

        // Always return success (user enumeration prevention)
        return NextResponse.json({ message: SUCCESS_MSG })

    } catch (error) {
        console.error('[ForgotPassword] Error:', error)
        // Still return success message to prevent information leakage
        return NextResponse.json({ message: SUCCESS_MSG })
    }
}
