import { NextRequest, NextResponse } from "next/server"
export const runtime = 'nodejs';
import { auth } from "@core/auth"
import { sendPushNotification } from "@/lib/notifications/push-notifier"


export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const { title, body, url } = await request.json()

        const result = await sendPushNotification(session.user.id, {
            title: title || "Test Push",
            body: body || "Esta es una notificación de prueba desde PlentyPay Admin",
            url: url || "/dashboard"
        })

        if (result.success) {
            const data = result as any;
            return NextResponse.json({
                success: true,
                message: data.queued 
                    ? "Notificación encolada para envío (Vercel after)." 
                    : `Notificación enviada a ${data.count} dispositivos.`
            })
        } else {
            return NextResponse.json({
                success: false,
                error: (result as any).message || (result as any).error || "Error al enviar notificación"
            })
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
