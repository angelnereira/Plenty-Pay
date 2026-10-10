import { baseEmailLayout, ctaButton, infoBanner } from './base';

/**
 * Plantillas predefinidas para campañas de Marketing/CRM
 * Enfoque premium, sin emojis, estilo corporativo PlentyPay.
 */

export const CRM_PRESETS = [
    {
        id: "MODULOS_PROMO",
        label: "Promoción de Módulos (Nuevos)",
        subject: "Potencia tu empresa con los nuevos módulos de PlentyPay",
        content: `
            <h1>Nuevas Herramientas para tu Negocio</h1>
            <p>Hola {name},</p>
            <p>En PlentyPay seguimos evolucionando para ofrecerte una gestión empresarial completa. Hemos habilitado nuevas funcionalidades diseñadas para optimizar tu operación diaria.</p>
            
            <p>A partir de hoy, tienes acceso a herramientas avanzadas de:</p>
            <ul style="color: #94A3B8; font-size: 14px; line-height: 1.8;">
                <li>Control de Inventario por Lotes</li>
                <li>Gestión Logística y Órdenes de Entrega</li>
                <li>Reportes Inteligentes de Rentabilidad</li>
            </ul>

            ${ctaButton('Descubrir Módulos', 'https://plentypay.com/modulos')}
            
            <p>Mantén tu empresa a la vanguardia con tecnología diseñada en Panamá.</p>
        `
    },
    {
        id: "RECORDATORIO_PAGO",
        label: "Recordatorio de Pago (Próximo vencimiento)",
        subject: "Recordatorio de vencimiento de suscripción - PlentyPay",
        content: `
            <h1>Estado de suscripción</h1>
            <p>Estimado/a {name},</p>
            <p>Este es un aviso automático para informarte que tu suscripción al plan <span class="accent-text">{plan}</span> está próxima a su fecha de renovación.</p>
            
            ${infoBanner(
                'Fecha Límite', 
                'Tu suscripción vence el próximo {date}. Para evitar interrupciones en tu facturación electrónica, te recomendamos realizar el pago a tiempo.',
                'warning'
            )}

            <p>Puedes gestionar tus métodos de pago y descargar tus comprobantes anteriores desde el portal de facturación.</p>

            ${ctaButton('Gestionar Pagos', 'https://plentypay.vercel.app/dashboard/configuracion/suscripcion')}
        `
    },
    {
        id: "SISTEMA_UPGRADE",
        label: "Actualización de Sistema (Mantenimiento)",
        subject: "Actualización de Infraestructura PlentyPay",
        content: `
            <h1>Mejora en los Servicios</h1>
            <p>En PlentyPay estamos realizando mejoras críticas en nuestra base de datos para ofrecerte mayor rapidez en la emisión de documentos.</p>
            
            ${infoBanner(
                'Mantenimiento Programado',
                'El sistema podría presentar intermitencias breves el día domingo entre las 02:00 AM y 04:00 AM.',
                'info'
            )}

            <p>Estas mejoras son parte de nuestro compromiso con la excelencia y la estabilidad de tu facturación electrónica.</p>
            <p>Atentamente,<br>Equipo Técnico de PlentyPay</p>
        `
    },
    {
        id: "AVISO_FINAL",
        label: "Aviso al Usuario Final",
        subject: "Comunicado importante de {company}",
        content: `
            <h1>Información Importante</h1>
            <p>Hola {name},</p>
            <p>Te escribimos de parte de <strong style="color: #FFFFFF;">{company}</strong> para notificarte sobre una actualización en tu cuenta o servicio.</p>
            
            <p style="padding: 24px; background-color: #111827; border: 1px dashed #1E293B; border-radius: 12px; color: #F8FAFC; text-align: center;">
                <em>[Inserta el mensaje personalizado aquí]</em>
            </p>

            <p>Si tienes alguna consulta, puedes contactar directamente a {company} respondiendo a este mensaje.</p>
        `
    }
];
