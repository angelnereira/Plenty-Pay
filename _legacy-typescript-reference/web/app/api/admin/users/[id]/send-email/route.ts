import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@core/auth'
import { prisma } from '@core/database'
import { createSecurityToken } from '@/lib/services/security-token.service'
import { generateQRDataURI } from '@/lib/services/qr-code.service'
import { passwordResetTemplate } from '@/lib/email-templates/password-reset'
import { accountSetupTemplate } from '@/lib/email-templates/account-setup'
import { sendEmail } from '@/lib/mail'

const sendEmailSchema = z.object({
    type: z.enum(['activation', 'reset-password', 'verification', 'custom']),
    subject: z.string().optional(),
    message: z.string().optional(),
}).refine(
    (data) => {
        if (data.type === 'custom') {
            return !!data.subject && !!data.message
        }
        return true
    },
    { message: 'Subject and message are required for custom emails' }
)

function customEmailTemplate(subject: string, message: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject} - PlentyPay</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">PlentyPay</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <div style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                                ${message}
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                &copy; ${new Date().getFullYear()} PlentyPay. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 403 }
            )
        }

        const { id } = await params
        const body = await request.json()

        const validation = sendEmailSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            )
        }

        const { type, subject, message } = validation.data

        // Look up the target user
        const user = await prisma.user.findUnique({
            where: { id },
            include: { client: true },
        })

        if (!user) {
            return NextResponse.json(
                { error: 'Usuario no encontrado' },
                { status: 404 }
            )
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plentypay.com'

        let emailResult: { success: boolean; error?: string; data?: any }

        switch (type) {
            case 'activation': {
                const { rawToken, expiresAt } = await createSecurityToken({
                    type: 'ACCOUNT_SETUP',
                    email: user.email,
                    userId: user.id,
                })

                const setupUrl = `${baseUrl}/auth/setup-password?token=${rawToken}&type=setup`
                const qrCodeDataUri = await generateQRDataURI(setupUrl)
                const expiresInHours = Math.round((expiresAt.getTime() - Date.now()) / 3600000)

                const html = accountSetupTemplate({
                    userName: user.name || 'Usuario',
                    companyName: user.client?.name || 'PlentyPay',
                    setupUrl,
                    qrCodeDataUri,
                    expiresInHours,
                })

                emailResult = await sendEmail({
                    to: user.email,
                    subject: 'Configura tu Cuenta - PlentyPay',
                    html,
                })
                break
            }

            case 'reset-password': {
                const { rawToken, expiresAt } = await createSecurityToken({
                    type: 'PASSWORD_RESET',
                    email: user.email,
                    userId: user.id,
                })

                const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}&type=reset`
                const qrCodeDataUri = await generateQRDataURI(resetUrl)
                const expiresInMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000)

                const html = passwordResetTemplate({
                    userName: user.name || 'Usuario',
                    resetUrl,
                    qrCodeDataUri,
                    expiresInMinutes,
                })

                emailResult = await sendEmail({
                    to: user.email,
                    subject: 'Restablecer Contraseña - PlentyPay',
                    html,
                })
                break
            }

            case 'verification': {
                const { rawToken, expiresAt } = await createSecurityToken({
                    type: 'EMAIL_VERIFICATION',
                    email: user.email,
                    userId: user.id,
                })

                const verifyUrl = `${baseUrl}/auth/verify-email?token=${rawToken}&type=verify`
                const expiresInHours = Math.round((expiresAt.getTime() - Date.now()) / 3600000)

                const html = customEmailTemplate(
                    'Verifica tu Email',
                    `
                    <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 20px;">Hola ${user.name || 'Usuario'},</h2>
                    <p>Por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo:</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                        <tr>
                            <td align="center">
                                <a href="${verifyUrl}"
                                   style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                    Verificar Email
                                </a>
                            </td>
                        </tr>
                    </table>
                    <p style="color: #9ca3af; font-size: 12px;">
                        Este enlace es de un solo uso y expira en <strong>${expiresInHours} horas</strong>.<br/>
                        Si no solicitaste esta verificación, puedes ignorar este correo.
                    </p>
                    `
                )

                emailResult = await sendEmail({
                    to: user.email,
                    subject: 'Verifica tu Email - PlentyPay',
                    html,
                })
                break
            }

            case 'custom': {
                const html = customEmailTemplate(subject!, message!)

                emailResult = await sendEmail({
                    to: user.email,
                    subject: subject!,
                    html,
                })
                break
            }
        }

        // Check if email was actually sent
        if (!emailResult.success) {
            return NextResponse.json(
                { error: emailResult.error || 'Error al enviar el correo electrónico' },
                { status: 502 }
            )
        }

        // Create audit log entry
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                userEmail: session.user.email!,
                action: `SEND_EMAIL_${type.toUpperCase()}`,
                entity: 'User',
                entityId: id,
                changes: JSON.stringify({ type, to: user.email }),
                ip: request.headers.get('x-forwarded-for') || 'unknown',
                userAgent: request.headers.get('user-agent') || 'unknown',
            },
        })

        return NextResponse.json({
            success: true,
            message: `Email de tipo "${type}" enviado exitosamente a ${user.email}`,
        })
    } catch (error) {
        console.error('[SendEmail] Error:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
