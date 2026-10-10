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

    // Solo SUPER_ADMIN y ADMIN pueden actualizar configuración de seguridad
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
      enforcePasswordPolicy,
      minPasswordLength,
      requireSpecialChars,
      requireNumbers,
      requireUppercase,
      passwordExpiration,
      sessionTimeout,
      maxLoginAttempts,
      twoFactorAuth,
      ipWhitelist,
      auditLogging,
      encryptSensitiveData,
    } = body

    // Validaciones
    if (parseInt(minPasswordLength) < 6) {
      return NextResponse.json(
        { error: "La longitud mínima de contraseña debe ser al menos 6" },
        { status: 400 }
      )
    }

    if (parseInt(sessionTimeout) < 5) {
      return NextResponse.json(
        { error: "El timeout de sesión debe ser al menos 5 minutos" },
        { status: 400 }
      )
    }

    // Crear o actualizar configuraciones de seguridad
    const configKeys = [
      { key: "ENFORCE_PASSWORD_POLICY", value: enforcePasswordPolicy.toString(), description: "Aplicar política de contraseñas" },
      { key: "MIN_PASSWORD_LENGTH", value: minPasswordLength, description: "Longitud mínima de contraseña" },
      { key: "REQUIRE_SPECIAL_CHARS", value: requireSpecialChars.toString(), description: "Requiere caracteres especiales" },
      { key: "REQUIRE_NUMBERS", value: requireNumbers.toString(), description: "Requiere números" },
      { key: "REQUIRE_UPPERCASE", value: requireUppercase.toString(), description: "Requiere mayúsculas" },
      { key: "PASSWORD_EXPIRATION", value: passwordExpiration, description: "Expiración de contraseña (días)" },
      { key: "SESSION_TIMEOUT", value: sessionTimeout, description: "Timeout de sesión (minutos)" },
      { key: "MAX_LOGIN_ATTEMPTS", value: maxLoginAttempts, description: "Máximo de intentos de inicio de sesión" },
      { key: "TWO_FACTOR_AUTH", value: twoFactorAuth.toString(), description: "Autenticación de dos factores" },
      { key: "IP_WHITELIST", value: ipWhitelist, description: "Whitelist de IPs" },
      { key: "AUDIT_LOGGING", value: auditLogging.toString(), description: "Registro de auditoría" },
      { key: "ENCRYPT_SENSITIVE_DATA", value: encryptSensitiveData.toString(), description: "Encriptar datos sensibles" },
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
        action: "SECURITY_SETTINGS_UPDATE",
        entity: "SystemConfig",
        entityId: clientId,
        changes: JSON.stringify(body),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Configuración de seguridad actualizada correctamente",
    })
  } catch (error) {
    console.error("[API] Error al actualizar configuración de seguridad:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}

