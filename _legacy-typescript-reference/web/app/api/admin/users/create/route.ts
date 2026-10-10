import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { assertWithinUserLimit, LimitExceededError } from "@/lib/limits/enforcement"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Verificar que el usuario esté autenticado y sea Super Admin
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, password, clientId, isActive } = body

    // Forzar rol CLIENT - no permitir creación de SUPER_ADMIN vía API
    const role = "CLIENT"

    // Validar campos requeridos
    if (!name || !email || !password || !clientId) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      )
    }

    // Validar largo mínimo de contraseña (consistente con login)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    // Verificar que el email no esté en uso
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está en uso" },
        { status: 400 }
      )
    }

    // Verificar que la organización existe
    const organization = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      )
    }

    // Enforce user limit del plan/extras antes de crear.
    try {
      await assertWithinUserLimit(clientId)
    } catch (e) {
      if (e instanceof LimitExceededError) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear el usuario y registrar audit log en transacción
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          clientId,
          isActive: isActive ?? true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              name: true,
              ruc: true,
            },
          },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userEmail: session.user.email || undefined,
          action: "USER_CREATE",
          entity: "User",
          entityId: newUser.id,
          changes: JSON.stringify({
            name: newUser.name,
            email: newUser.email,
            clientId,
            role,
          }),
          ip: request.headers.get("x-forwarded-for") || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        },
      })

      return newUser
    })

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error("Error al crear usuario:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

