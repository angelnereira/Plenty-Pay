import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Solo SUPER_ADMIN puede cambiar estado de clientes
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      )
    }

    const { orgId } = await params
    const body = await request.json()
    const { isActive } = body

    // Verificar que el cliente existe
    const clientToUpdate = await prisma.client.findUnique({
      where: { id: orgId },
    })

    if (!clientToUpdate) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    // Actualizar estado
    const updatedClient = await prisma.client.update({
      where: { id: orgId },
      data: {
        isActive: isActive,
        updatedAt: new Date(),
      },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: isActive ? "CLIENT_ACTIVATE" : "CLIENT_DEACTIVATE",
        entity: "Client",
        entityId: orgId,
        changes: JSON.stringify({
          name: clientToUpdate.name,
          isActive: isActive,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedClient,
    })
  } catch (error) {
    console.error("[API] Error al cambiar estado de cliente:", error)
    return NextResponse.json(
      { error: "Error al cambiar estado de cliente" },
      { status: 500 }
    )
  }
}

