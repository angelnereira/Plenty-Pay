/**
 * Account Setup Email Template
 *
 * Sent when a new user is invited/registered and needs to set up their password.
 * Includes QR code for mobile access.
 */

interface AccountSetupTemplateParams {
    userName: string
    companyName: string
    setupUrl: string
    qrCodeDataUri: string
    expiresInHours: number
}

export function accountSetupTemplate({
    userName,
    companyName,
    setupUrl,
    qrCodeDataUri,
    expiresInHours,
}: AccountSetupTemplateParams): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configura tu Cuenta - PlentyPay</title>
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
                            <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 14px;">Configura tu cuenta</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 20px;">Bienvenido ${userName},</h2>
                            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                                Tu cuenta para <strong>${companyName}</strong> ha sido creada en PlentyPay.
                            </p>
                            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                                Para comenzar, necesitas configurar tu contraseña. Haz clic en el botón de abajo:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px;">
                                <tr>
                                    <td align="center">
                                        <a href="${setupUrl}"
                                           style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                            Configurar mi Contraseña
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- QR Code Section -->
                            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
                                <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px;">
                                    Escanea desde tu celular para configurar desde ahí:
                                </p>
                                <img src="${qrCodeDataUri}"
                                     alt="Código QR para configurar cuenta"
                                     width="180" height="180"
                                     style="display: inline-block; border: 4px solid #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
                            </div>

                            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                                Este enlace es de un solo uso y expira en <strong>${expiresInHours} horas</strong>.<br/>
                                Si no reconoces esta invitación, puedes ignorar este correo de forma segura.
                            </p>
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
