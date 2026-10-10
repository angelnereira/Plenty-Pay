import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function PUT(request: Request) {
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const clientId = session.user.clientId

    if (!clientId) {
      return NextResponse.json(
        { error: "Usuario sin organización asignada" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      emailNotifications,
      folioAlerts,
      invoiceStatusUpdates,
      weeklyReport,
      systemAnnouncements,
      emailAddress,
      smsNotifications,
      phoneNumber,
      webhookUrl,
      webhookEnabled,
    } = body

    // Crear o actualizar configuraciones de notificaciones
    const configKeys = [
      { key: "EMAIL_NOTIFICATIONS", value: emailNotifications.toString(), description: "Notificaciones por email activadas" },
      { key: "FOLIO_ALERTS", value: folioAlerts.toString(), description: "Alertas de folios bajos" },
      { key: "INVOICE_STATUS_UPDATES", value: invoiceStatusUpdates.toString(), description: "Actualizaciones de estado de facturas" },
      { key: "WEEKLY_REPORT", value: weeklyReport.toString(), description: "Reporte semanal" },
      { key: "SYSTEM_ANNOUNCEMENTS", value: systemAnnouncements.toString(), description: "Anuncios del sistema" },
      { key: "NOTIFICATION_EMAIL", value: emailAddress, description: "Email para notificaciones" },
      { key: "SMS_NOTIFICATIONS", value: smsNotifications.toString(), description: "Notificaciones por SMS activadas" },
      { key: "NOTIFICATION_PHONE", value: phoneNumber, description: "Teléfono para notificaciones" },
      { key: "WEBHOOK_ENABLED", value: webhookEnabled.toString(), description: "Webhooks activados" },
      { key: "WEBHOOK_URL", value: webhookUrl, description: "URL del webhook" },
    ]

    // Actualizar cada configuración
    for (const config of configKeys) {
      await prisma.systemConfig.upsert({
        where: {
          clientId_key: {
            clientId: clientId,
            key: config.key,
          },
        },
        update: {
          value: config.value,
          updatedAt: new Date(),
        },
        create: {
          clientId: clientId,
          key: config.key,
          value: config.value,
          description: config.description,
        },
      })
    }

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "NOTIFICATION_SETTINGS_UPDATE",
        entity: "SystemConfig",
        entityId: clientId,
        changes: JSON.stringify(body),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Configuración de notificaciones actualizada correctamente",
    })
  } catch (error) {
    console.error("[API] Error al actualizar configuración de notificaciones:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}

