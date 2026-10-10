import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { sendEmail, EMAIL_SENDERS } from "@/lib/mail"
import { sendPushNotification } from "@/lib/notifications/push-notifier"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { content } = await request.json()
        if (!content) {
            return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 })
        }

        const { id: ticketId } = await params
        const isAdmin = session.user.role === "SUPER_ADMIN"

        // 1. Crear el mensaje
        const message = await prisma.supportMessage.create({
            data: {
                ticketId,
                userId: session.user.id,
                content,
                isAdmin
            },
            include: {
                user: { select: { name: true } },
                ticket: {
                    include: {
                        user: { select: { email: true, id: true, name: true } }
                    }
                }
            }
        })

        // 2. Actualizar estado del ticket si es admin respondiendo
        if (isAdmin) {
            await prisma.supportTicket.update({
                where: { id: ticketId },
                data: { status: "IN_PROGRESS" }
            })

            // 3. Notificar al usuario (Email + Push)
            const ticketOwner = message.ticket.user

            // Email notification
            await sendEmail({
                to: ticketOwner.email,
                from: EMAIL_SENDERS.support,
                subject: `Re: Soporte PlentyPay - ${message.ticket.subject}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Hola ${ticketOwner.name},</h2>
                        <p>Un administrador ha respondido a tu ticket de soporte <strong>#${ticketId.substring(ticketId.length - 6).toUpperCase()}</strong>.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-left: 4px solid #000; margin: 20px 0;">
                            ${content}
                        </div>
                        <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver conversación</a>
                    </div>
                `
            })

            // Push notification
            await sendPushNotification(ticketOwner.id, {
                title: "Nueva respuesta de soporte",
                body: content.substring(0, 100) + "...",
                url: "/dashboard"
            })
        }

        return NextResponse.json({ success: true, data: message })
    } catch (error: any) {
        console.error("[TICKET_MESSAGE_ERROR]", error)
        return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 })
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { id: ticketId } = await params
        const messages = await prisma.supportMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            include: {
                user: { select: { name: true } }
            }
        })

        return NextResponse.json({ success: true, data: messages })
    } catch (e) {
        return NextResponse.json({ error: "Error al obtener mensajes" }, { status: 500 })
    }
}
