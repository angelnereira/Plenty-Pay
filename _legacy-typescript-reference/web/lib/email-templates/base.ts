/**
 * PlentyPay: Base Email Design System (Premium Dark Mode)
 * Este archivo define el layout global y los componentes compartidos para correos.
 * Diseñado para imitar la interfaz oscura y profesional de plentypay.com.
 */

// URL base para imágenes (logo, activos)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://plentypay.vercel.app';
const LOGO_URL = `${APP_URL}/plentypay-logo-light.png`;

/** Layout envolvente principal con estética de tarjeta oscura */
export const baseEmailLayout = (content: string, options: { title?: string; preheader?: string } = {}) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title || 'Notificación de PlentyPay'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        body { font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #020617; color: #F8FAFC; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #020617; padding-bottom: 40px; }
        .main { width: 100%; max-width: 600px; margin: 0 auto; background-color: #0F172A; border: 1px solid #1E293B; border-radius: 24px; margin-top: 40px; overflow: hidden; }
        .content { padding: 40px; }
        .header { padding: 40px 40px 0 40px; text-align: left; }
        .footer { padding: 20px 40px; text-align: center; color: #64748B; font-size: 12px; }
        h1 { font-size: 24px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.02em; }
        p { font-size: 15px; line-height: 1.6; color: #94A3B8; margin-top: 0; margin-bottom: 16px; }
        .divider { height: 1px; background-color: #1E293B; margin: 32px 0; }
        .accent-text { color: #8B5CF6; font-weight: 600; }
        @media only screen and (max-width: 600px) {
            .main { border-radius: 0; margin-top: 0; border: none; }
            .content { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        ${options.preheader ? `<span style="display: none !important; font-size: 1px; color: transparent;">${options.preheader}</span>` : ''}
        <table class="main" role="presentation" cellspacing="0" cellpadding="0">
            <tr>
                <td class="header">
                    <img src="${LOGO_URL}" alt="PlentyPay" width="160" style="display: block;">
                </td>
            </tr>
            <tr>
                <td class="content">
                    ${content}
                </td>
            </tr>
            <tr>
                <td class="footer">
                    <div style="margin-bottom: 20px; border-bottom: 1px solid #1E293B; height: 1px;"></div>
                    <p style="font-size: 11px; margin-bottom: 8px;">© ${new Date().getFullYear()} PlentyPay. Plataforma de Facturación Electrónica en la Nube.</p>
                    <p style="font-size: 11px; margin-bottom: 0;">Ciudad de Panamá, República de Panamá.</p>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
`;

/** Componente de botón con estilo Nav/Submit de PlentyPay (Violeta vibrante) */
export const ctaButton = (text: string, url: string) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 24px; margin-bottom: 24px;">
    <tr>
        <td align="center" bgcolor="#7C3AED" style="border-radius: 12px;">
            <a href="${url}" target="_blank" style="font-size: 14px; font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif; font-weight: 700; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; border: 1px solid #7C3AED; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em;">
                ${text}
            </a>
        </td>
    </tr>
</table>
`;

/** Banner informativo secundario tipo tarjeta alert (Sin emojis) */
export const infoBanner = (title: string, message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const colors = {
        info: { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', text: '#60A5FA' },
        warning: { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', text: '#FBBF24' },
        success: { border: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', text: '#34D399' }
    };
    const c = colors[type];
    
    return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; border: 1px solid ${c.border}; background-color: #111827; border-radius: 16px; margin: 24px 0;">
        <tr>
            <td style="padding: 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                        <td valign="top" style="padding-right: 12px;">
                            <div style="width: 8px; height: 8px; background-color: ${c.border}; border-radius: 50%; margin-top: 4px;"></div>
                        </td>
                        <td>
                            <div style="font-size: 13px; font-weight: 700; color: ${c.text}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">${title}</div>
                            <div style="font-size: 14px; color: #94A3B8; line-height: 1.4;">${message}</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    `;
};
