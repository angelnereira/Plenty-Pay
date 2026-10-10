/**
 * Sistema de Notificaciones por Email
 * Integración con Resend
 */

import { prisma } from '@core/database';

interface NotificationConfig {
  enabled: boolean;
  recipients: string[];
  triggers: string[];
}

interface MonitorResult {
  runId: string;
  monitorId: string;
  status: string;
  failedRequests: number;
  totalRequests: number;
  message?: string;
  error?: string;
}

export async function sendMonitorNotification(
  monitorId: string,
  result: MonitorResult
) {
  try {
    // Buscar monitor con configuración de notificaciones
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
    });

    if (!monitor || !monitor.notifications) {
      return;
    }

    const config = monitor.notifications as unknown as NotificationConfig;

    if (!config.enabled || !config.recipients || config.recipients.length === 0) {
      return;
    }

    // Determinar si debemos enviar notificación
    const shouldNotify = shouldSendNotification(result, config);

    if (!shouldNotify) {
      return;
    }

    // Enviar email
    await sendEmailNotification(monitor.name, result, config.recipients);

    // Registrar en base de datos
    await prisma.user.updateMany({
      where: { email: { in: config.recipients } },
      data: {
        // TODO: Crear registro de notificación enviada
      },
    });

  } catch (error) {
    console.error('Error enviando notificación:', error);
  }
}

function shouldSendNotification(
  result: MonitorResult,
  config: NotificationConfig
): boolean {
  for (const trigger of config.triggers) {
    switch (trigger) {
      case 'test_failure':
        if (result.failedRequests > 0) {
          return true;
        }
        break;
      case 'error':
        if (result.status === 'FAILED' || result.error) {
          return true;
        }
        break;
      case 'timeout':
        if (result.status === 'TIMEOUT') {
          return true;
        }
        break;
    }
  }
  return false;
}

import { sendEmail } from '@/lib/mail';

async function sendEmailNotification(
  monitorName: string,
  result: MonitorResult,
  recipients: string[]
) {
  const subject = `[PlentyPay] Monitor: ${monitorName}`;
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2563eb;">Notificación de Monitor: ${monitorName}</h2>
      <p>Se ha detectado un evento que requiere su atención.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Monitor:</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${monitorName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Estado:</td>
          <td style="padding: 10px; border: 1px solid #ddd; color: ${result.status === 'FAILED' ? '#dc2626' : '#x000'};">${result.status}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Peticiones Fallidas:</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${result.failedRequests} / ${result.totalRequests}</td>
        </tr>
        ${result.error ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Error:</td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #dc2626;">${result.error}</td>
        </tr>` : ''}
      </table>
      <p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/monitores" 
           style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
          Ver detalles en el Dashboard
        </a>
      </p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">
        Este es un correo automático de PlentyPay. Por favor no responda a este mensaje.
      </p>
    </div>
  `;

  await sendEmail({
    to: recipients,
    subject,
    html,
  });
}

