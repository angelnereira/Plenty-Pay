import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Solo SUPER_ADMIN y ORG_ADMIN pueden actualizar usuarios
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isOrgAdmin = session.user.role === "CLIENT"

    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      )
    }

    const { userId } = await params
    const body = await request.json()
    const { name, email, role, clientId, isActive } = body

    // Verificar que el usuario existe
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    // ORG_ADMIN solo puede actualizar usuarios de su organización
    if (isOrgAdmin && userToUpdate.clientId !== session.user.clientId) {
      return NextResponse.json(
        { error: "No puedes actualizar usuarios de otra organización" },
        { status: 403 }
      )
    }

    // ORG_ADMIN no puede cambiar roles
    if (isOrgAdmin && role && role !== userToUpdate.role) {
      return NextResponse.json(
        { error: "No tienes permisos para cambiar roles de usuario" },
        { status: 403 }
      )
    }

    // ORG_ADMIN no puede cambiar organización
    if (isOrgAdmin && clientId && clientId !== userToUpdate.clientId) {
      return NextResponse.json(
        { error: "No tienes permisos para cambiar la organización de un usuario" },
        { status: 403 }
      )
    }

    // Preparar datos de actualización
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (isActive !== undefined) updateData.isActive = isActive
    
    // Solo SUPER_ADMIN puede cambiar rol y organización
    if (isSuperAdmin) {
      if (role !== undefined) updateData.role = role
      if (clientId !== undefined) updateData.clientId = clientId
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            ruc: true,
          },
        },
      },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "USER_UPDATE",
        entity: "User",
        entityId: userId,
        changes: JSON.stringify({
          before: {
            name: userToUpdate.name,
            email: userToUpdate.email,
            role: userToUpdate.role,
            clientId: userToUpdate.clientId,
            isActive: userToUpdate.isActive,
          },
          after: updateData,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Usuario actualizado correctamente",
      user: updatedUser,
    })
  } catch (error) {
    console.error("[API] Error al actualizar usuario:", error)
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Solo SUPER_ADMIN y ORG_ADMIN pueden eliminar usuarios
    const isSuperAdmin = session.user.role === "SUPER_ADMIN"
    const isOrgAdmin = session.user.role === "CLIENT"

    if (!isSuperAdmin && !isOrgAdmin) {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      )
    }

    const { userId } = await params

    // No permitir eliminar al propio usuario
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario" },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    // ORG_ADMIN solo puede eliminar usuarios de su organización
    if (isOrgAdmin && userToDelete.clientId !== session.user.clientId) {
      return NextResponse.json(
        { error: "No puedes eliminar usuarios de otra organización" },
        { status: 403 }
      )
    }

    // Eliminar usuario
    await prisma.user.delete({
      where: { id: userId },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "USER_DELETE",
        entity: "User",
        entityId: userId,
        changes: JSON.stringify({
          deletedUser: userToDelete.email,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
    })
  } catch (error) {
    console.error("[API] Error al eliminar usuario:", error)
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    )
  }
}

