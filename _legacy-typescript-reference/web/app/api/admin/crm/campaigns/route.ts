import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { after } from "next/server"
import { sendEmail, EMAIL_SENDERS } from "@/lib/mail"

export async function GET(_request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const campaigns = await prisma.emailCampaign.findMany({
            orderBy: { createdAt: "desc" },
            take: 20
        })

        return NextResponse.json({ success: true, data: campaigns })
    } catch (_e) {
        return NextResponse.json({ error: "Error al obtener campañas" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const { subject, content, targetPlans, targetUserIds, targetEmails, fromEmail } = await request.json()

        if (!subject || !content) {
            return NextResponse.json({ error: "Asunto y contenido son requeridos" }, { status: 400 })
        }

        // 1. Crear registro de campaña
        const campaign = await prisma.emailCampaign.create({
            data: {
                subject,
                content,
                targetPlans: targetPlans || [],
                targetUserIds: targetUserIds || [],
                targetEmails: targetEmails || [],
                fromEmail: fromEmail || null,
                status: "SENDING",
                createdBy: session.user.id
            }
        })

        // 2. Recopilar destinatarios únicos
        const recipients = new Map<string, { email: string; name: string; company?: string; plan?: string }>()

        // A. Por Planes
        if (targetPlans && targetPlans.length > 0) {
            const planUsers = await prisma.user.findMany({
                where: {
                    role: "CLIENT",
                    isActive: true,
                    client: { planType: { in: targetPlans } }
                },
                select: { email: true, name: true, client: { select: { name: true, planType: true } } }
            })
            planUsers.forEach(u => recipients.set(u.email.toLowerCase(), { 
                email: u.email, 
                name: u.name, 
                company: u.client?.name, 
                plan: u.client?.planType 
            }))
        }

        // B. Por IDs de Usuario específicos
        if (targetUserIds && targetUserIds.length > 0) {
            const specificUsers = await prisma.user.findMany({
                where: { id: { in: targetUserIds } },
                select: { email: true, name: true, client: { select: { name: true, planType: true } } }
            })
            specificUsers.forEach(u => recipients.set(u.email.toLowerCase(), { 
                email: u.email, 
                name: u.name, 
                company: u.client?.name, 
                plan: u.client?.planType 
            }))
        }

        // C. Por Correos arbitrarios
        if (targetEmails && targetEmails.length > 0) {
            targetEmails.forEach((email: string) => {
                const cleanEmail = email.trim().toLowerCase()
                if (cleanEmail && !recipients.has(cleanEmail)) {
                    recipients.set(cleanEmail, { email: cleanEmail, name: "Cliente" })
                }
            })
        }

        if (recipients.size === 0) {
            await prisma.emailCampaign.update({
                where: { id: campaign.id },
                data: { status: "SENT", totalSent: 0 }
            })
            return NextResponse.json({ success: true, message: "No hay destinatarios válidos" })
        }

        // 3. Enviar en segundo plano nativamente (Vercel)

        after(async () => {
            const BATCH_SIZE = 5;
            const emails = Array.from(recipients.values());
            let sentCount = 0;
            const emailErrors: any[] = [];

            for (let i = 0; i < emails.length; i += BATCH_SIZE) {
                const batch = emails.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (recipient) => {
                    const result = await sendEmail({
                        to: recipient.email,
                        subject: campaign.subject,
                        html: campaign.content,
                        from: campaign.fromEmail || EMAIL_SENDERS.marketing
                    });
                    if (result.success) sentCount++;
                    else emailErrors.push(result.error);
                }));

                // Break de 1 segundo para apaciguar el RateLimit de Resend (máx ~10r/s)
                if (i + BATCH_SIZE < emails.length) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            await prisma.emailCampaign.update({
                where: { id: campaign.id },
                data: {
                    status: emailErrors.length > 0 && sentCount === 0 ? "FAILED" : "SENT",
                    totalSent: sentCount,
                    sentAt: new Date()
                }
            });
        });
        
        console.log(`[CRM_API] Campaña ${campaign.id} despachada internamente para ${recipients.size} destinatarios.`);

        return NextResponse.json({ 
            success: true, 
            message: "Campaña procesándose en segundo plano",
            data: campaign 
        })
    } catch (error: unknown) {
        console.error("[CRM_API_ERROR]", error)
        return NextResponse.json({ error: "Error al procesar la campaña" }, { status: 500 })
    }
}
