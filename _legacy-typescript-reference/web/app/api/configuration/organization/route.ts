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

    // Solo SUPER_ADMIN o CLIENT_ADMIN pueden modificar la organización
    const allowedRoles = ['SUPER_ADMIN', 'CLIENT_ADMIN'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para modificar la organización" },
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
    const { name, ruc, dv, rucType, address, phone, email, website } = body

    // Validaciones
    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    if (!ruc || ruc.trim() === "") {
      return NextResponse.json(
        { error: "El RUC es requerido" },
        { status: 400 }
      )
    }

    if (rucType && !['1', '2'].includes(rucType)) {
      return NextResponse.json(
        { error: "Tipo de contribuyente inválido. Debe ser '1' (Natural) o '2' (Jurídica)" },
        { status: 400 }
      )
    }

    // Actualizar organización
    const updatedOrganization = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: name.trim(),
        ruc: ruc.trim(),
        dv: dv?.trim() || null,
        rucType: rucType || '2',
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        website: website?.trim() || null,
        updatedAt: new Date(),
      },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "ORGANIZATION_UPDATE",
        entity: "Organization",
        entityId: clientId,
        changes: JSON.stringify({
          name,
          ruc,
          dv,
          rucType,
          address,
          phone,
          email,
          website,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedOrganization,
    })
  } catch (error) {
    console.error("[API] Error al actualizar organización:", error)
    return NextResponse.json(
      { error: "Error al actualizar organización" },
      { status: 500 }
    )
  }
}

