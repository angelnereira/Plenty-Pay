import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import bcrypt from "bcryptjs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, email, password, role, clientId, isActive, planType, status } = body

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { client: true }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    // No permitir cambiar el rol de un Super Admin
    if (existingUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No se puede cambiar el rol de un Super Admin" },
        { status: 400 }
      )
    }

    // Verificar si el email ya está en uso por otro usuario
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "El email ya está en uso" },
          { status: 400 }
        )
      }
    }

    // Track changes for audit log
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (name !== existingUser.name) changes.name = { from: existingUser.name, to: name }
    if (email !== existingUser.email) changes.email = { from: existingUser.email, to: email }
    if (role !== existingUser.role) changes.role = { from: existingUser.role, to: role }
    if (clientId !== existingUser.clientId) changes.clientId = { from: existingUser.clientId, to: clientId }
    if (isActive !== existingUser.isActive) changes.isActive = { from: existingUser.isActive, to: isActive }
    if (password) changes.password = { from: "[redacted]", to: "[changed]" }
    if (planType && planType !== existingUser.client?.planType) changes.planType = { from: existingUser.client?.planType, to: planType }
    if (status && status !== existingUser.status) changes.status = { from: existingUser.status, to: status }

    const updateData: Record<string, unknown> = {
      name,
      email,
      role,
      clientId,
      isActive,
    }

    // Update status if provided
    if (status) {
      updateData.status = status
    }

    // Solo actualizar contraseña si se proporciona (mínimo 8 caracteres, consistente con login)
    if (password && password.length >= 8) {
      updateData.password = await bcrypt.hash(password, 10)
      updateData.passwordChangedAt = new Date()
    } else if (password && password.length > 0 && password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    const passwordChanged = !!updateData.password
    const deactivated = isActive === false && existingUser.isActive === true

    // Actualizar usuario y cliente en transacción
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          status: true,
          clientId: true,
          updatedAt: true,
        },
      })

      // Si se proporciona planType, actualizar el cliente
      if (planType && clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: { planType }
        })
      }

      // Invalidar sesiones si se cambió contraseña o se desactivó el usuario
      if (passwordChanged || deactivated) {
        await tx.session.deleteMany({
          where: { userId: id },
        })
      }

      // Audit log
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            userId: session.user!.id,
            userEmail: session.user!.email!,
            action: "UPDATE_USER",
            entity: "User",
            entityId: id,
            changes: JSON.stringify(changes),
            ip: request.headers.get("x-forwarded-for") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
          },
        })
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error) {
    console.error("Error al actualizar usuario:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
