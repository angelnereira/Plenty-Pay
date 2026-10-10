/**
 * Soft-cap de facturas mensuales: avisos al 80% / 100% del cap del plan.
 *
 * Política: NO bloquea emisión. Si el tenant pasa el cap se permite seguir
 * emitiendo y el sobreconsumo se factura aparte (lib/constants/plans.ts:
 * PLAN_CONFIG[plan].overageBlock). Aquí solo enviamos avisos:
 *   - 80% → email al admin del tenant (1ª vez en el mes)
 *   - 100% → email al admin del tenant + email a SUPER_ADMIN (1ª vez en el mes)
 *
 * Tracking persistente vive en Client.lastInvoiceCapWarning80At /
 * lastInvoiceCapWarning100At. Comparamos contra el primer día del mes en
 * curso para no spammear y para que el reset sea natural al cambiar de mes.
 *
 * Llamar después de crear cada factura (en el handler que persiste Invoice
 * en BD), pasando el clientId. Falla en silencio si algo va mal — el envío
 * de email no debe romper el flujo de emisión.
 */

import { prismaServer } from "@core/database/prisma-server";
import { PLAN_CONFIG, type PlanType } from "@/lib/constants/plans";
import { sendEmail } from "@/lib/mail";

function startOfCurrentMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function notifyIfApproachingCap(clientId: string): Promise<void> {
    try {
        const client = await prismaServer.client.findUnique({
            where: { id: clientId },
            select: {
                id: true,
                name: true,
                planType: true,
                lastInvoiceCapWarning80At: true,
                lastInvoiceCapWarning100At: true,
            },
        });
        if (!client) return;

        const planType = (PLAN_CONFIG[client.planType as PlanType] ? client.planType : "START") as PlanType;
        const cap = PLAN_CONFIG[planType].monthlyInvoiceCap;
        if (cap <= 0) return;

        const monthStart = startOfCurrentMonth();
        const currentCount = await prismaServer.invoice.count({
            where: {
                clientId,
                createdAt: { gte: monthStart },
            },
        });

        const ratio = currentCount / cap;
        const last80 = client.lastInvoiceCapWarning80At;
        const last100 = client.lastInvoiceCapWarning100At;

        // Aviso 80%
        if (ratio >= 0.8 && ratio < 1 && (!last80 || last80 < monthStart)) {
            const adminUser = await prismaServer.user.findFirst({
                where: { clientId, role: "CLIENT", isActive: true },
                orderBy: { createdAt: "asc" },
                select: { email: true, name: true },
            });
            if (adminUser?.email) {
                await sendEmail({
                    to: adminUser.email,
                    subject: `Estás cerca del límite mensual de facturas — ${client.name}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                            <h2>Cerca del límite mensual</h2>
                            <p>Hola ${adminUser.name ?? "Cliente"},</p>
                            <p>Has emitido <strong>${currentCount}</strong> de las <strong>${cap}</strong> facturas incluidas en tu plan ${PLAN_CONFIG[planType].label}.</p>
                            <p>Sigues pudiendo emitir; al pasar el 100% el sobreconsumo se factura aparte. Si esperas seguir creciendo, considera subir de plan en <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/configuracion/suscripcion">tu suscripción</a>.</p>
                        </div>
                    `,
                });
            }
            await prismaServer.client.update({
                where: { id: clientId },
                data: { lastInvoiceCapWarning80At: new Date() },
            });
        }

        // Aviso 100%
        if (ratio >= 1 && (!last100 || last100 < monthStart)) {
            const adminUser = await prismaServer.user.findFirst({
                where: { clientId, role: "CLIENT", isActive: true },
                orderBy: { createdAt: "asc" },
                select: { email: true, name: true },
            });
            if (adminUser?.email) {
                await sendEmail({
                    to: adminUser.email,
                    subject: `Superaste el límite mensual de facturas — ${client.name}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                            <h2>Superaste el límite mensual</h2>
                            <p>Hola ${adminUser.name ?? "Cliente"},</p>
                            <p>Llevas <strong>${currentCount}</strong> de <strong>${cap}</strong> facturas incluidas en tu plan ${PLAN_CONFIG[planType].label}. El sobreconsumo se factura aparte.</p>
                            <p>Considera subir de plan para mejor margen unitario en <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/configuracion/suscripcion">tu suscripción</a>.</p>
                        </div>
                    `,
                });
            }
            // Aviso a SUPER_ADMIN
            const superAdmins = await prismaServer.user.findMany({
                where: { role: "SUPER_ADMIN", isActive: true },
                select: { email: true },
                take: 5,
            });
            for (const sa of superAdmins) {
                if (!sa.email) continue;
                await sendEmail({
                    to: sa.email,
                    subject: `Tenant ${client.name} superó el cap mensual de facturas`,
                    html: `<p>El tenant <strong>${client.name}</strong> (${client.id}) llegó a ${currentCount}/${cap} facturas en su plan ${PLAN_CONFIG[planType].label}. Sobreconsumo activo.</p>`,
                });
            }
            await prismaServer.client.update({
                where: { id: clientId },
                data: { lastInvoiceCapWarning100At: new Date() },
            });
        }
    } catch (err) {
        console.error("[invoice-cap] Failed to notify cap warning", err);
        // No relanzar — esto es un side-effect; no debe romper la emisión.
    }
}
