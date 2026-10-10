/**
 * send-welcome-blast.ts
 * Envía un correo de bienvenida al canal de mail de PlentyPay
 * a todos los usuarios activos.
 *
 * USO:
 *   npx tsx scripts/send-welcome-blast.ts
 *
 * Variables de entorno requeridas en .env:
 *   RESEND_API_KEY, EMAIL_FROM_MARKETING (o EMAIL_FROM como fallback),
 *   ENABLE_EMAIL_NOTIFICATIONS="true"
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sendEmail, EMAIL_SENDERS } from '../lib/mail';

const prisma = new PrismaClient();

const DELAY_MS = 250; // pausa entre envíos para respetar rate-limit de Resend

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  PlentyPay — Blast de Bienvenida al Canal de Mail   ');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Remitente : ${EMAIL_SENDERS.marketing}`);
    console.log(`  API Key   : ${process.env.RESEND_API_KEY?.substring(0, 12)}...`);
    console.log(`  Notif. ON : ${process.env.ENABLE_EMAIL_NOTIFICATIONS}`);
    console.log('───────────────────────────────────────────────────\n');

    // Obtener todos los usuarios activos con organización activa
    const users = await prisma.user.findMany({
        where: {
            isActive: true,
            role: 'CLIENT',
            client: {
                isActive: true,
                approvalStatus: 'APPROVED',
            },
        },
        select: {
            id: true,
            name: true,
            email: true,
            client: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) {
        console.log('⚠️  No hay usuarios activos aprobados. Abortando.');
        return;
    }

    console.log(`📬 Enviando a ${users.length} usuario(s)...\n`);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
        const firstName = user.name?.split(' ')[0] ?? 'Cliente';
        const orgName = user.client?.name ?? 'tu organización';

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">PlentyPay</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Facturación Electrónica Inteligente</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">¡Hola, ${firstName}! 👋</h2>
              <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6;">
                Te damos la más cálida bienvenida al <strong>canal de comunicación oficial de PlentyPay</strong>.
                A partir de ahora, este será el espacio por donde recibirás:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;font-size:15px;line-height:1.8;">
                <li>Novedades y nuevas funcionalidades de la plataforma</li>
                <li>Alertas importantes sobre tu cuenta o facturación</li>
                <li>Consejos para sacar el máximo provecho de <strong>${orgName}</strong></li>
                <li>Actualizaciones sobre normativas de facturación electrónica</li>
              </ul>
              <p style="margin:0 0 32px;color:#4b5563;font-size:15px;line-height:1.6;">
                Si tienes alguna pregunta o necesitas ayuda, estamos siempre disponibles.
              </p>
              <div style="text-align:center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://plentypay.com'}/dashboard"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                  Ir al Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                PlentyPay · Panamá<br>
                Recibiste este mensaje porque eres usuario activo de la plataforma.<br>
                Para soporte escríbenos a <a href="mailto:soporte@plentypay.com" style="color:#7c3aed;">soporte@plentypay.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const result = await sendEmail({
            to: user.email,
            from: EMAIL_SENDERS.marketing,
            subject: '¡Bienvenido al canal de PlentyPay! 🎉',
            html,
        });

        const status = result.success ? '✅' : '❌';
        const detail = result.success
            ? (result.data as any)?.id ?? 'enviado'
            : JSON.stringify(result.error);

        console.log(`  ${status} ${user.email.padEnd(40)} ${detail}`);

        if (result.success) sent++;
        else failed++;

        if (users.indexOf(user) < users.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    console.log('\n───────────────────────────────────────────────────');
    console.log(`  Resultado: ${sent} enviados, ${failed} fallidos de ${users.length} total`);
    console.log('═══════════════════════════════════════════════════\n');
}

main()
    .catch((e) => {
        console.error('[CRITICAL]', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
