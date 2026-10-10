/**
 * Welcome Email Template
 *
 * Sent after Super Admin approves a new client/account.
 * Includes dynamic cross-selling based on modules NOT selected during onboarding.
 */

interface WelcomeTemplateParams {
    userName: string
    companyName: string
    loginUrl: string
    activeModules: string[]
    availableModules: { name: string; description: string; icon: string }[]
}

const ALL_MODULES: Record<string, { name: string; description: string; icon: string }> = {
    inventory: {
        name: 'Inventario',
        description: 'Control total de stock, lotes, valoración FIFO/promedio ponderado y alertas de reorden automáticas.',
        icon: '📦',
    },
    pos: {
        name: 'Punto de Venta',
        description: 'Sistema POS multi-estación con facturación electrónica integrada y soporte offline.',
        icon: '🛒',
    },
    payday: {
        name: 'Planilla (Payday)',
        description: 'Gestión de nómina, turnos, asistencia biométrica y cálculos de CSS/ISR automáticos.',
        icon: '💰',
    },
    logistics: {
        name: 'Logística',
        description: 'Órdenes de entrega, seguimiento en tiempo real, gestión de flotas y firmas digitales.',
        icon: '🚛',
    },
}

export function welcomeTemplate({
    userName,
    companyName,
    loginUrl,
    activeModules,
    availableModules,
}: WelcomeTemplateParams): string {
    // Build cross-selling section for modules not selected
    const crossSellModules = availableModules.length > 0
        ? availableModules.map(mod => `
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td width="40" style="font-size: 24px; vertical-align: top;">${mod.icon}</td>
                            <td style="padding-left: 12px;">
                                <strong style="color: #1f2937; font-size: 14px;">${mod.name}</strong>
                                <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0; line-height: 1.4;">${mod.description}</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        `).join('')
        : ''

    const activeModulesList = activeModules
        .map(m => ALL_MODULES[m]?.name ?? m)
        .join(', ')

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a PlentyPay</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Bienvenido a PlentyPay</h1>
                            <p style="color: #d1fae5; margin: 8px 0 0; font-size: 16px;">Tu cuenta ha sido aprobada</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 20px;">Hola ${userName},</h2>
                            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                                Tu cuenta para <strong>${companyName}</strong> ha sido aprobada y está lista para usar.
                                ${activeModulesList ? `Tus módulos activos son: <strong>${activeModulesList}</strong>.` : ''}
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px;">
                                <tr>
                                    <td align="center">
                                        <a href="${loginUrl}"
                                           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                            Iniciar Sesión
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            ${crossSellModules ? `
                            <!-- Cross-Selling Section -->
                            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 0 0 24px;">
                                <div style="background-color: #f9fafb; padding: 16px; border-bottom: 1px solid #e5e7eb;">
                                    <h3 style="color: #1f2937; font-size: 15px; margin: 0;">Potencia tu negocio con más módulos</h3>
                                    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Descubre lo que puedes agregar a tu plan:</p>
                                </div>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    ${crossSellModules}
                                </table>
                                <div style="padding: 16px; text-align: center;">
                                    <a href="${loginUrl}/settings" style="color: #4f46e5; font-size: 13px; font-weight: 600; text-decoration: none;">
                                        Solicitar módulos adicionales &rarr;
                                    </a>
                                </div>
                            </div>
                            ` : ''}
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

/**
 * Get available (non-selected) modules for cross-selling
 */
export function getCrossSellModules(activeModules: string[]): { name: string; description: string; icon: string }[] {
    const allKeys = Object.keys(ALL_MODULES)
    return allKeys
        .filter(key => !activeModules.includes(key))
        .map(key => ALL_MODULES[key])
}
