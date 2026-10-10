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
      hkaMode,
      hkaUsername,
      hkaPassword,
      hkaWsdlUrl,
      hkaApiKey,
      autoRetry,
      maxRetryAttempts,
      timeoutSeconds,
    } = body

    // Validaciones
    if (!hkaWsdlUrl || !hkaUsername || !hkaPassword) {
      return NextResponse.json(
        { error: "URL del WSDL, usuario y contraseña son requeridos" },
        { status: 400 }
      )
    }

    // Crear o actualizar configuraciones de HKA
    const configKeys = [
      { key: "HKA_MODE", value: hkaMode, description: "Modo de operación HKA (demo/production)" },
      { key: "HKA_USERNAME", value: hkaUsername, description: "Usuario de HKA" },
      { key: "HKA_PASSWORD", value: hkaPassword, description: "Contraseña de HKA", sensitive: true },
      { key: "HKA_WSDL_URL", value: hkaWsdlUrl, description: "URL del WSDL de HKA" },
      { key: "HKA_API_KEY", value: hkaApiKey || "", description: "API Key de HKA (opcional)", sensitive: true },
      { key: "HKA_AUTO_RETRY", value: autoRetry.toString(), description: "Reintento automático" },
      { key: "HKA_MAX_RETRY_ATTEMPTS", value: maxRetryAttempts, description: "Máximo de reintentos" },
      { key: "HKA_TIMEOUT_SECONDS", value: timeoutSeconds, description: "Timeout en segundos" },
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

    // Registrar en audit log (sin incluir credenciales)
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "HKA_INTEGRATION_UPDATE",
        entity: "SystemConfig",
        entityId: clientId,
        changes: JSON.stringify({
          hkaMode,
          hkaWsdlUrl,
          hkaUsername: "***",
          hkaPassword: "***",
          autoRetry,
          maxRetryAttempts,
          timeoutSeconds,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Configuración de integración actualizada correctamente",
    })
  } catch (error) {
    console.error("[API] Error al actualizar configuración de integración:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}

