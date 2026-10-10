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

    // Solo SUPER_ADMIN y ADMIN pueden actualizar configuración
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
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
      invoicePrefix,
      invoiceStartNumber,
      folioAlertThreshold,
      autoAssignFolios,
      requireClientEmail,
      defaultTaxRate,
      defaultPaymentTerms,
    } = body

    // Crear o actualizar cada configuración individualmente
    const configKeys = [
      { key: "INVOICE_PREFIX", value: invoicePrefix, description: "Prefijo de facturas" },
      { key: "INVOICE_START_NUMBER", value: invoiceStartNumber, description: "Número inicial de facturas" },
      { key: "FOLIO_ALERT_THRESHOLD", value: folioAlertThreshold, description: "Umbral de alerta de folios (%)" },
      { key: "AUTO_ASSIGN_FOLIOS", value: autoAssignFolios.toString(), description: "Asignar folios automáticamente" },
      { key: "REQUIRE_CLIENT_EMAIL", value: requireClientEmail.toString(), description: "Requiere email del cliente" },
      { key: "DEFAULT_TAX_RATE", value: defaultTaxRate, description: "Tasa de impuesto por defecto (%)" },
      { key: "DEFAULT_PAYMENT_TERMS", value: defaultPaymentTerms, description: "Plazo de pago por defecto (días)" },
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
        action: "INVOICE_SETTINGS_UPDATE",
        entity: "SystemConfig",
        entityId: clientId,
        changes: JSON.stringify(body),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Configuración actualizada correctamente",
    })
  } catch (error) {
    console.error("[API] Error al actualizar configuración de facturación:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}

