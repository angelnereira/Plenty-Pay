import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { NextResponse } from "next/server"
import { createInvoiceSchema, calculateInvoiceTotals, calculateItemTotals } from "@/lib/validations/invoice"
import { Decimal } from "@prisma/client/runtime/library"
import { Prisma } from "@prisma/client"
import { getPanamaTimestamp } from "@/lib/utils/date-timezone"
import crypto from "crypto"
import { InventoryRepository } from "@/features/inventory/model/repositories/inventory.repository"
import { InsufficientStockError } from "@/shared/errors/inventory-errors"

export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const session = await auth()
    if (!session) {
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

    // Obtener datos del request
    const body = await request.json()
    const { saveAsDraft, ...invoiceData } = body

    // Validar con Zod
    const validationResult = createInvoiceSchema.safeParse(invoiceData)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validationResult.error.format() },
        { status: 400 }
      )
    }

    const { client, items, notes, paymentMethod } = validationResult.data

    // Cargar organización para determinar si requiere folios
    const organization = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        hkaEnvironment: true,
        ruc: true,
        dv: true,
        name: true,
        address: true,
        email: true,
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organización no encontrada" },
        { status: 404 }
      )
    }

    // En modo DEMO no exigimos folios
    const noFolioRequired = organization.hkaEnvironment === 'DEMO'

    // Calcular totales
    const totals = calculateInvoiceTotals(items)

    // Obtener un folio disponible (solo si no es borrador)
    let folioAssignment = null
    let folioNumber = null

    if (!saveAsDraft && !noFolioRequired) {
      // Buscar una asignación de folios con disponibles usando consulta SQL
      const availableAssignments = await prisma.$queryRaw`
        SELECT * FROM "folio_assignments" 
        WHERE "clientId" = ${clientId}
        AND "assignedAmount" > "consumedAmount"
        ORDER BY "assignedAt" DESC
        LIMIT 1
      ` as any[]

      if (!availableAssignments || availableAssignments.length === 0) {
        return NextResponse.json(
          { error: "No hay folios disponibles. Debe comprar folios primero." },
          { status: 400 }
        )
      }

      folioAssignment = availableAssignments[0]
      const disponibles = folioAssignment.assignedAmount - folioAssignment.consumedAmount

      if (disponibles <= 0) {
        return NextResponse.json(
          { error: "No hay folios disponibles. Debe comprar más folios." },
          { status: 400 }
        )
      }

      // Generar número de folio
      const folioPool = await prisma.folioPool.findUnique({
        where: { id: folioAssignment.folioPoolId },
      })

      if (!folioPool || !folioPool.folioStart) {
        return NextResponse.json(
          { error: "Error al obtener información del pool de folios" },
          { status: 500 }
        )
      }

      // Calcular el siguiente número de folio
      const nextFolioIndex = folioAssignment.consumedAmount
      const startNumber = parseInt(folioPool.folioStart)
      folioNumber = `${startNumber + nextFolioIndex}`.padStart(8, "0")
    }

    // Crear la factura en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Extraer RUC y DV del taxId (formato: RUC-DV o RUCDV)
      const taxIdParts = client.taxId.includes('-')
        ? client.taxId.split('-')
        : [client.taxId.substring(0, client.taxId.length - 2), client.taxId.substring(client.taxId.length - 2)];

      const ruc = taxIdParts[0];
      const dv = taxIdParts[1] || "00";

      // Buscar o crear el cliente
      let customer = await tx.customer.findFirst({
        where: {
          clientId,
          ruc,
          dv,
        },
      });

      if (!customer) {
        // Crear cliente si no existe
        customer = await tx.customer.create({
          data: {
            clientId,
            ruc,
            dv,
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            address: client.address,
            clientType: "01", // 01=Contribuyente por defecto
          },
        });
      }

      // organization ya cargada arriba

      // Crear la factura
      const invoice = await tx.invoice.create({
        data: {
          clientId,
          createdBy: session.user.id,
          // Usar relación customerId y un identificador único independiente para idempotencia
          customerId: customer.id,
          clientReferenceId: crypto.randomUUID(),

          // Número de folio (solo si no es borrador)
          invoiceNumber: folioNumber,

          // Datos del emisor desde organización
          issuerRuc: organization.ruc || "0000000000",
          issuerDv: organization.dv || "00",
          issuerName: organization.name,
          issuerAddress: organization.address || "Dirección no especificada",
          issuerEmail: organization.email || "contacto@organizacion.com",

          // Información del receptor (cliente)
          receiverRuc: client.taxId,
          receiverDv: undefined,
          receiverName: client.name,
          receiverEmail: client.email || null,
          receiverPhone: client.phone || null,
          receiverAddress: client.address,

          // Montos
          subtotal: new Decimal(totals.subtotal.toFixed(2)),
          discount: new Decimal(totals.totalDiscount.toFixed(2)),
          subtotalAfterDiscount: new Decimal((totals.subtotal - totals.totalDiscount).toFixed(2)),
          itbms: new Decimal(totals.totalTax.toFixed(2)),
          total: new Decimal(totals.total.toFixed(2)),

          // Información adicional
          notes,

          // Fechas - usar zona horaria de Panamá
          issueDate: getPanamaTimestamp(),
        },
      })

      // Crear los items de la factura (con productId opcional para inventario)
      await tx.invoiceItem.createMany({
        data: items.map((item, index) => {
          const itemTotals = calculateItemTotals(item)
          return {
            invoiceId: invoice.id,
            lineNumber: index + 1,
            code: `ITEM${index + 1}`,
            description: item.description,
            quantity: new Decimal(item.quantity.toFixed(4)),
            unitPrice: new Decimal(item.unitPrice.toFixed(2)),
            discount: new Decimal((item.quantity * item.unitPrice * item.discount / 100).toFixed(2)),
            discountRate: new Decimal(item.discount.toFixed(2)),
            taxRate: new Decimal(item.taxRate.toFixed(2)),
            taxAmount: new Decimal(itemTotals.taxAmount.toFixed(2)),
            subtotal: new Decimal(itemTotals.subtotal.toFixed(2)),
            total: new Decimal(itemTotals.total.toFixed(2)),
            // Guardar referencia al producto del inventario (si aplica)
            productId: item.productId ?? null,
          }
        }),
      })

      // =============================================================
      // DEDUCCIÓN DE INVENTARIO
      // Solo se ejecuta cuando no es borrador y los ítems tienen
      // un productId (están vinculados al módulo de inventario).
      // Usa el mismo mecanismo OCC (Optimistic Concurrency Control)
      // que el módulo de Punto de Venta para garantizar atomicidad.
      // =============================================================
      if (!saveAsDraft) {
        const inventoryRepo = new InventoryRepository()
        const itemsWithProduct = items.filter((item) => item.productId)

        for (const item of itemsWithProduct) {
          try {
            // reserveStockWithOCC corre dentro de su propio tx,
            // pero al estar envuelto en el tx padre, se vuelve parte
            // de la misma transacción ACID gracias a Prisma's txClient sharing.
            // Usamos el producto para validar stock, actualizar currentStock
            // con version-check y crear un StockMovement de auditoría.
            await tx.product.findUniqueOrThrow({
              where: { id: item.productId! },
            }).then(async (product) => {
              const quantityDecimal = new Decimal(item.quantity)
              const newStock = product.currentStock.minus(quantityDecimal)

              if (newStock.lessThan(0)) {
                throw new InsufficientStockError(
                  `Stock insuficiente para "${item.description}". Disponible: ${product.currentStock.toNumber()}, Solicitado: ${item.quantity}`,
                  {
                    productId: item.productId!,
                    requested: item.quantity,
                    available: product.currentStock.toNumber(),
                  }
                )
              }

              // Actualización con version-check (OCC)
              const updateResult = await tx.product.updateMany({
                where: { id: item.productId!, version: product.version },
                data: {
                  currentStock: newStock,
                  version: { increment: 1 },
                },
              })

              if (updateResult.count === 0) {
                throw new Error(
                  `Conflicto de concurrencia al actualizar inventario de "${item.description}". Por favor, intente de nuevo.`
                )
              }

              // Registro de movimiento de stock para auditoría
              await tx.stockMovement.create({
                data: {
                  productId: item.productId!,
                  type: 'SALE',
                  quantity: quantityDecimal.negated(), // negativo = salida
                  previousStock: product.currentStock,
                  newStock,
                  productVersion: product.version,
                  referenceId: invoice.id,
                  referenceType: 'Invoice',
                  createdById: session.user.id,
                },
              })
            })
          } catch (err) {
            // Re-lanzar como error legible; el tx padre hará rollback automático
            if (err instanceof InsufficientStockError) {
              throw err
            }
            throw err
          }
        }
      }

      // Si no es borrador, actualizar el consumo de folios
      if (!saveAsDraft && folioAssignment && !noFolioRequired) {
        await tx.folioAssignment.update({
          where: { id: folioAssignment.id },
          data: {
            consumedAmount: folioAssignment.consumedAmount + 1,
          },
        })
      }

      return invoice
    })

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: saveAsDraft ? "INVOICE_DRAFT_CREATED" : "INVOICE_CREATED",
        entity: "Invoice",
        entityId: result.id,
        changes: JSON.stringify({
          invoiceNumber: folioNumber,
          total: totals.total,
          itemsCount: items.length,
        }),
        ip: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        invoiceNumber: result.invoiceNumber,
        total: result.total,
        status: result.status,
      },
    })
  } catch (error) {
    console.error("[API] Error al crear factura:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: "Conflicto de idempotencia: clientReferenceId duplicado" },
          { status: 409 }
        )
      }
    }
    return NextResponse.json(
      { error: (error as any)?.message || "Error al procesar la factura" },
      { status: 500 }
    )
  }
}

