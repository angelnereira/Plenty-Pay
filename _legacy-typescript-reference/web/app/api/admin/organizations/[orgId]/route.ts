import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { sendEmail } from "@/lib/mail"
import { MOTOR_TIERS, assertCanChangeTier } from "@/lib/motor/pricing"
import type { MotorCreditTier } from "@prisma/client"

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

    // Solo SUPER_ADMIN puede actualizar clientes
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      )
    }

    const { orgId } = await params
    const body = await request.json()
    const {
      name, ruc, dv, address, phone, email, website, logo, isActive,
      facturacionEnabled, inventoryEnabled, posEnabled, paydayEnabled, logisticsEnabled, creditosEnabled,
      apiAccessEnabled, whatsappEnabled, premiumSupportEnabled, biEnabled, biProEnabled, extraBranches,
      motorCreditTier,
      planType, maxUsers, maxPosStations
    } = body

    // Validar motorCreditTier si llega en el payload (null|TIER_1|TIER_2|TIER_3)
    if (motorCreditTier !== undefined && motorCreditTier !== null) {
      if (!(motorCreditTier in MOTOR_TIERS)) {
        return NextResponse.json(
          { error: `Tier inválido: ${motorCreditTier}. Valores permitidos: TIER_1, TIER_2, TIER_3` },
          { status: 400 }
        )
      }
    }

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

    // Verificar si el nuevo nombre ya existe (solo si cambió)
    if (name && name.trim() !== "" && name.trim() !== clientToUpdate.name) {
      const existingName = await prisma.client.findFirst({
        where: {
          name: name.trim(),
          id: { not: orgId },
        },
      })

      if (existingName) {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese nombre" },
          { status: 400 }
        )
      }
    }

    // Verificar si el nuevo RUC ya existe (solo si cambió y no es vacío)
    if (ruc && ruc.trim() !== "" && ruc.trim() !== clientToUpdate.ruc) {
      const existingRuc = await prisma.client.findFirst({
        where: {
          ruc: ruc.trim(),
          id: { not: orgId },
        },
      })

      if (existingRuc) {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese RUC" },
          { status: 400 }
        )
      }
    }

    // Preparar datos de actualización
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (ruc !== undefined) updateData.ruc = ruc?.trim() || null
    if (dv !== undefined) updateData.dv = dv?.trim() || null
    if (address !== undefined) updateData.address = address?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (email !== undefined) updateData.email = email?.trim() || null
    if (website !== undefined) updateData.website = website?.trim() || null
    if (logo !== undefined) updateData.logo = logo?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (facturacionEnabled !== undefined) updateData.facturacionEnabled = facturacionEnabled
    if (inventoryEnabled !== undefined) updateData.inventoryEnabled = inventoryEnabled
    if (posEnabled !== undefined) updateData.posEnabled = posEnabled
    if (paydayEnabled !== undefined) updateData.paydayEnabled = paydayEnabled
    if (logisticsEnabled !== undefined) updateData.logisticsEnabled = logisticsEnabled
    if (creditosEnabled !== undefined) updateData.creditosEnabled = creditosEnabled
    if (apiAccessEnabled !== undefined) updateData.apiAccessEnabled = apiAccessEnabled
    if (whatsappEnabled !== undefined) updateData.whatsappEnabled = whatsappEnabled
    if (premiumSupportEnabled !== undefined) updateData.premiumSupportEnabled = premiumSupportEnabled
    // BI: biPro requiere bi. Si llega biPro=true sin bi=true ya activo,
    // forzamos bi=true. Si llega bi=false, forzamos biPro=false.
    let resolvedBiEnabled = biEnabled
    let resolvedBiProEnabled = biProEnabled
    if (resolvedBiProEnabled === true && !(resolvedBiEnabled === true || (resolvedBiEnabled === undefined && clientToUpdate.biEnabled))) {
      resolvedBiEnabled = true
    }
    if (resolvedBiEnabled === false) {
      resolvedBiProEnabled = false
    }
    if (resolvedBiEnabled !== undefined) updateData.biEnabled = resolvedBiEnabled
    if (resolvedBiProEnabled !== undefined) updateData.biProEnabled = resolvedBiProEnabled
    if (extraBranches !== undefined && Number.isInteger(extraBranches) && extraBranches >= 0) {
      updateData.extraBranches = extraBranches
    }
    if (motorCreditTier !== undefined) {
      // Validar que el downgrade no exceda el uso actual
      if (motorCreditTier !== null && motorCreditTier !== clientToUpdate.motorCreditTier) {
        try {
          await assertCanChangeTier(orgId, motorCreditTier as MotorCreditTier)
        } catch (e: unknown) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "No se puede cambiar de tier" },
            { status: 400 }
          )
        }
      }
      updateData.motorCreditTier = motorCreditTier
    }
    if (planType !== undefined) updateData.planType = planType
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers
    if (maxPosStations !== undefined) updateData.maxPosStations = maxPosStations

    // CRITICAL FIX: When admin explicitly enables any module or sets a plan,
    // automatically approve the client so modules appear in the user's sidebar.
    // Without this, approvalStatus stays "PENDING" and the sidebar hides all module items
    // even though inventoryEnabled/posEnabled/etc. are true in the DB.
    // When admin enables any module, automatically mark the account as active/approved
    // so the user can see their modules immediately in the sidebar.
    const adminEnablingModules =
      (facturacionEnabled === true && !clientToUpdate.facturacionEnabled) ||
      (inventoryEnabled === true && !clientToUpdate.inventoryEnabled) ||
      (posEnabled === true && !clientToUpdate.posEnabled) ||
      (paydayEnabled === true && !clientToUpdate.paydayEnabled) ||
      (logisticsEnabled === true && !clientToUpdate.logisticsEnabled) ||
      (creditosEnabled === true && !clientToUpdate.creditosEnabled) ||
      (resolvedBiEnabled === true && !clientToUpdate.biEnabled) ||
      (resolvedBiProEnabled === true && !clientToUpdate.biProEnabled)
    if (adminEnablingModules && clientToUpdate.approvalStatus !== "APPROVED") {
      updateData.approvalStatus = "APPROVED"
    }

    // Actualizar cliente
    const updatedClient = await prisma.client.update({
      where: { id: orgId },
      data: updateData,
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "CLIENT_UPDATE",
        entity: "Client",
        entityId: orgId,
        changes: JSON.stringify({
          before: {
            name: clientToUpdate.name,
            ruc: clientToUpdate.ruc,
            isActive: clientToUpdate.isActive,
          },
          after: updateData,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    // Notify tenant if modules or plan changed
    const moduleOrPlanChanged =
      (facturacionEnabled !== undefined && facturacionEnabled !== clientToUpdate.facturacionEnabled) ||
      (inventoryEnabled !== undefined && inventoryEnabled !== clientToUpdate.inventoryEnabled) ||
      (posEnabled !== undefined && posEnabled !== clientToUpdate.posEnabled) ||
      (paydayEnabled !== undefined && paydayEnabled !== clientToUpdate.paydayEnabled) ||
      (logisticsEnabled !== undefined && logisticsEnabled !== clientToUpdate.logisticsEnabled)

    if (moduleOrPlanChanged) {
      try {
        const firstUser = await prisma.user.findFirst({
          where: { clientId: orgId, isActive: true, role: "CLIENT" },
          select: { email: true, name: true },
          orderBy: { createdAt: "asc" },
        })
        if (firstUser?.email) {
          const moduleList = [
            (facturacionEnabled ?? clientToUpdate.facturacionEnabled) && "Facturación",
            (inventoryEnabled ?? clientToUpdate.inventoryEnabled) && "Inventario",
            (posEnabled ?? clientToUpdate.posEnabled) && "Punto de Venta",
            (paydayEnabled ?? clientToUpdate.paydayEnabled) && "Nómina",
            (logisticsEnabled ?? clientToUpdate.logisticsEnabled) && "Logística",
          ].filter(Boolean).join(", ") || "Sin módulos activos"

          await sendEmail({
            to: firstUser.email,
            subject: "Tu suscripción en PlentyPay ha sido actualizada",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #1e40af;">Actualización de suscripción</h2>
                <p>Hola ${firstUser.name},</p>
                <p>Un administrador ha actualizado los módulos y/o el plan de tu cuenta.</p>
                <p><strong>Plan actual:</strong> ${planType ?? clientToUpdate.planType}</p>
                <p><strong>Módulos activos:</strong> ${moduleList}</p>
                <p>Los cambios están disponibles de inmediato. Si tienes alguna pregunta, contacta a soporte.</p>
              </div>
            `,
          })
        }
      } catch (e) {
        // Non-critical: don't fail the request if notification fails
        console.error("[ORG_UPDATE] Failed to send module change notification:", e)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cliente actualizado correctamente",
      client: updatedClient,
    })
  } catch (error) {
    console.error("[API] Error al actualizar cliente:", error)
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Solo SUPER_ADMIN puede eliminar clientes
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      )
    }

    const { orgId } = await params

    // Verificar que el cliente existe
    const clientToDelete = await prisma.client.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            invoices: true,
          },
        },
      },
    })

    if (!clientToDelete) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    // Eliminar en cascada dentro de una transacción
    await prisma.$transaction(async (tx) => {
      if (clientToDelete._count.users > 0 || clientToDelete._count.invoices > 0) {
        const clientUsers = await tx.user.findMany({
          where: { clientId: orgId },
          select: { id: true },
        })
        const userIds = clientUsers.map(u => u.id)

        if (userIds.length > 0) {
          await tx.notification.deleteMany({
            where: { userId: { in: userIds } },
          })
          await tx.session.deleteMany({
            where: { userId: { in: userIds } },
          })
        }

        await tx.invoiceItem.deleteMany({
          where: { invoice: { clientId: orgId } },
        })
        await tx.invoiceLog.deleteMany({
          where: { invoice: { clientId: orgId } },
        })
        await tx.invoice.deleteMany({
          where: { clientId: orgId },
        })
        await tx.folioAssignment.deleteMany({
          where: { clientId: orgId },
        })
        await tx.apiKey.deleteMany({
          where: { clientId: orgId },
        })
        await tx.systemConfig.deleteMany({
          where: { clientId: orgId },
        })
        await tx.user.deleteMany({
          where: { clientId: orgId },
        })
      }

      await tx.client.delete({
        where: { id: orgId },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userEmail: session.user.email || undefined,
          action: "CLIENT_DELETE",
          entity: "Client",
          entityId: orgId,
          changes: JSON.stringify({
            deletedClient: clientToDelete.name,
            usersDeleted: clientToDelete._count.users,
            invoicesDeleted: clientToDelete._count.invoices,
          }),
          ip: request.headers.get("x-forwarded-for") || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: "Cliente eliminado correctamente",
    })
  } catch (error) {
    console.error("[API] Error al eliminar cliente:", error)
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    )
  }
}

