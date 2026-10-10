import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { NextResponse } from "next/server"
import { Decimal } from "@prisma/client/runtime/library"
import { getPanamaTimestamp } from "@/lib/utils/date-timezone"
import crypto from "crypto"
import {
  validateNotaCreditoMontos,
  validateFacturaNoAnulada,
  validateNoReferenciaCircular,
  validateCUFEsUnicos,
  checkNotaCreditoAntiguedad,
} from "@/features/hka/model/validators/business-rules.validator"
import { z } from "zod"
import { ReceiverType } from "@prisma/client"

/**
 * Mapea valores de receiverType del frontend al enum Prisma ReceiverType.
 * El frontend usa CONSUMER_FINAL, Prisma define FINAL_CONSUMER.
 */
function mapReceiverType(frontendType: string): ReceiverType {
  const map: Record<string, ReceiverType> = {
    "CONSUMER_FINAL": ReceiverType.FINAL_CONSUMER,
    "CONTRIBUTOR": ReceiverType.CONTRIBUTOR,
    "GOVERNMENT": ReceiverType.GOVERNMENT,
    "FOREIGN": ReceiverType.FOREIGN,
  }
  return map[frontendType] ?? ReceiverType.FINAL_CONSUMER
}

/**
 * Schema de validación para crear Nota de Crédito
 */
const createCreditNoteSchema = z.object({
  /** ID de la factura original (requerido para tipo REFERENCED) */
  originalInvoiceId: z.string().optional(),
  /** Subtipo: REFERENCED (04) o GENERIC (06) */
  noteSubtype: z.enum(["REFERENCED", "GENERIC"]),
  /** Items de la nota de crédito */
  items: z.array(z.object({
    description: z.string().min(1, "Descripción es requerida"),
    quantity: z.number().positive("Cantidad debe ser mayor a 0"),
    unitPrice: z.number().min(0, "Precio debe ser mayor o igual a 0"),
    taxRate: z.number().min(0).max(100).default(7),
    discount: z.number().min(0).default(0),
  })).min(1, "Debe tener al menos un ítem"),
  /** Razón/motivo de la nota */
  reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres").max(500),
  /** Método de pago */
  paymentMethod: z.string().default("CASH"),
  /** Datos del receptor (requerido para GENERIC, ignorado para REFERENCED) */
  receiver: z.object({
    name: z.string().min(1, "Nombre del receptor es requerido"),
    ruc: z.string().optional(),
    dv: z.string().optional(),
    type: z.enum(["CONTRIBUTOR", "CONSUMER_FINAL", "GOVERNMENT", "FOREIGN"]).default("CONSUMER_FINAL"),
  }).optional(),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const clientId = session.user.clientId
    if (!clientId) {
      return NextResponse.json({ error: "Usuario sin organización asignada" }, { status: 400 })
    }

    const body = await request.json()
    const validationResult = createCreditNoteSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validationResult.error.format() },
        { status: 400 }
      )
    }

    const { originalInvoiceId, noteSubtype, items, reason, paymentMethod, receiver } = validationResult.data

    // --- Validaciones para tipo REFERENCED (04) ---
    type OriginalInvoiceWithNotes = Awaited<ReturnType<typeof prisma.invoice.findFirst>> & {
      creditDebitNotes: { documentType: string; total: import('@prisma/client').Prisma.Decimal }[]
      items: { code: string; description: string; quantity: import('@prisma/client').Prisma.Decimal; unitPrice: import('@prisma/client').Prisma.Decimal; taxRate: import('@prisma/client').Prisma.Decimal; discountRate: import('@prisma/client').Prisma.Decimal }[]
    }
    let originalInvoice: OriginalInvoiceWithNotes | null = null
    let antiquityWarning: string | undefined

    if (noteSubtype === "REFERENCED") {
      if (!originalInvoiceId) {
        return NextResponse.json(
          { error: "originalInvoiceId es requerido para Notas de Crédito referenciadas (tipo 04)" },
          { status: 400 }
        )
      }

      // Buscar factura original con sus NC/ND existentes Y sus ítems
      originalInvoice = await prisma.invoice.findFirst({
        where: { id: originalInvoiceId, clientId },
        include: {
          creditDebitNotes: {
            where: {
              status: { in: ["EMITTED", "CERTIFIED"] },
              deletedAt: null,
            },
            select: {
              documentType: true,
              total: true,
            },
          },
          items: {
            select: {
              code: true,
              description: true,
              quantity: true,
              unitPrice: true,
              taxRate: true,
              discountRate: true,
            },
          },
        },
      })

      if (!originalInvoice) {
        return NextResponse.json({ error: "Factura original no encontrada" }, { status: 404 })
      }

      // 1. Verificar que no esté anulada
      const anulacionResult = validateFacturaNoAnulada(originalInvoice)
      if (!anulacionResult.valid) {
        return NextResponse.json({ error: anulacionResult.error }, { status: 400 })
      }

      // 2. Verificar que no sea otra NC/ND
      const circularResult = validateNoReferenciaCircular(originalInvoice.documentType)
      if (!circularResult.valid) {
        return NextResponse.json({ error: circularResult.error }, { status: 400 })
      }

      // 3. Verificar que la factura esté emitida
      if (originalInvoice.status !== "EMITTED" && originalInvoice.status !== "CERTIFIED") {
        return NextResponse.json(
          { error: "Solo se pueden emitir notas de crédito contra facturas emitidas o certificadas." },
          { status: 400 }
        )
      }

      // 3b. Guard DGI: NC referenciada (tipo 04) exige CUFE de la factura original.
      // Sin CUFE, HKA rechaza con "El campo cufe es requerido".
      if (!originalInvoice.cufe) {
        return NextResponse.json(
          { error: "La factura original no tiene un CUFE registrado. No se puede emitir una Nota de Crédito referenciada hasta que la factura original sea autorizada por la DGI y tenga CUFE asignado." },
          { status: 400 }
        )
      }

      // 4. Calcular totales de la nota
      // Round to 2 decimal places to avoid floating point imprecision
      // (e.g. 127.9 * 0.07 = 8.953000000000001 would cause a spurious "exceeds original" error)
      const notaTotal = Math.round(
        items.reduce((sum, item) => {
          const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
          const tax = subtotal * (item.taxRate / 100)
          return sum + subtotal + tax
        }, 0) * 100
      ) / 100

      // 5. Calcular NC/ND existentes
      const existingCreditNotesTotal = originalInvoice.creditDebitNotes
        .filter((n) => n.documentType === "NOTA_CREDITO")
        .reduce((sum, n) => sum + Number(n.total), 0)

      const existingDebitNotesTotal = originalInvoice.creditDebitNotes
        .filter((n) => n.documentType === "NOTA_DEBITO")
        .reduce((sum, n) => sum + Number(n.total), 0)

      // 6. Validar montos
      const montosResult = validateNotaCreditoMontos(
        notaTotal,
        Number(originalInvoice.total),
        existingCreditNotesTotal,
        existingDebitNotesTotal
      )
      if (!montosResult.valid) {
        return NextResponse.json({ error: montosResult.error }, { status: 400 })
      }

      // 7. Validar CUFE único (solo 1 referencia, pero validamos por consistencia)
      if (originalInvoice.cufe) {
        const cufeResult = validateCUFEsUnicos([originalInvoice.cufe])
        if (!cufeResult.valid) {
          return NextResponse.json({ error: cufeResult.error }, { status: 400 })
        }
      }

      // 8. Verificar antigüedad (warning, no bloqueo)
      if (originalInvoice.emittedAt || originalInvoice.issueDate) {
        const antiguedad = checkNotaCreditoAntiguedad(
          originalInvoice.emittedAt || originalInvoice.issueDate
        )
        if (antiguedad.isOld) {
          antiquityWarning = antiguedad.warning
        }
      }

      // 9. DEFENSA: Validar que los ítems de la NC pertenezcan a la FE original
      // y que sus cantidades/precios no excedan los originales.
      // Esta validación server-side previene bypass del frontend.
      if (originalInvoice.items && originalInvoice.items.length > 0) {
        const originalItemMap = new Map(
          originalInvoice.items.map(oi => [
            oi.description.trim().toLowerCase(),
            {
              maxQuantity: Number(oi.quantity),
              maxUnitPrice: Number(oi.unitPrice),
              code: oi.code,
            }
          ])
        )

        for (const [idx, ncItem] of items.entries()) {
          const key = ncItem.description.trim().toLowerCase()
          const originalItem = originalItemMap.get(key)

          if (!originalItem) {
            return NextResponse.json(
              {
                error: `El ítem "${ncItem.description}" no existe en la factura original. ` +
                  `Las Notas de Crédito referenciadas (tipo 04) solo pueden incluir ítems de la factura original.`,
                details: { field: `items[${idx}].description`, code: "NC_ITEM_NOT_IN_ORIGINAL" }
              },
              { status: 422 }
            )
          }

          if (ncItem.quantity > originalItem.maxQuantity) {
            return NextResponse.json(
              {
                error: `La cantidad del ítem "${ncItem.description}" (${ncItem.quantity}) excede la cantidad original (${originalItem.maxQuantity}). ` +
                  `Solo puede reducir cantidades, no aumentarlas.`,
                details: { field: `items[${idx}].quantity`, code: "NC_QUANTITY_EXCEEDS_ORIGINAL" }
              },
              { status: 422 }
            )
          }

          if (ncItem.unitPrice > originalItem.maxUnitPrice) {
            return NextResponse.json(
              {
                error: `El precio del ítem "${ncItem.description}" (${ncItem.unitPrice.toFixed(2)}) excede el precio original (${originalItem.maxUnitPrice.toFixed(2)}). ` +
                  `Solo puede reducir precios, no aumentarlos.`,
                details: { field: `items[${idx}].unitPrice`, code: "NC_PRICE_EXCEEDS_ORIGINAL" }
              },
              { status: 422 }
            )
          }
        }
      }
    }

    // --- Cargar organización ---
    const organization = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, ruc: true, dv: true, name: true,
        address: true, email: true, hkaEnvironment: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 })
    }

    // --- Calcular totales ---
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice
      const itemDiscount = itemSubtotal * (item.discount / 100)
      const itemAfterDiscount = itemSubtotal - itemDiscount
      const itemTax = itemAfterDiscount * (item.taxRate / 100)

      subtotal += itemSubtotal
      totalDiscount += itemDiscount
      totalTax += itemTax
    }

    const total = subtotal - totalDiscount + totalTax

    // --- Crear la Nota de Crédito ---
    const result = await prisma.$transaction(async (tx) => {
      const creditNote = await tx.invoice.create({
        data: {
          clientId,
          createdBy: session.user.id,
          clientReferenceId: crypto.randomUUID(),
          documentType: "NOTA_CREDITO",
          noteSubtype,

          // Datos del emisor (siempre desde la organización actual)
          issuerRuc: organization.ruc || "0000000000",
          issuerDv: organization.dv || "00",
          issuerName: organization.name,
          issuerAddress: organization.address || "Dirección no especificada",
          issuerEmail: organization.email || "contacto@organizacion.com",

          // Datos del receptor
          // REFERENCED: copiar de factura original
          // GENERIC: usar datos del formulario
          receiverType: noteSubtype === "REFERENCED"
            ? (originalInvoice?.receiverType || "CONTRIBUTOR")
            : mapReceiverType(receiver?.type || "CONSUMER_FINAL"),
          receiverRuc: noteSubtype === "REFERENCED"
            ? (originalInvoice?.receiverRuc || undefined)
            : (receiver?.ruc || undefined),
          receiverDv: noteSubtype === "REFERENCED"
            ? (originalInvoice?.receiverDv || undefined)
            : (receiver?.dv || undefined),
          receiverName: noteSubtype === "REFERENCED"
            ? (originalInvoice?.receiverName || "Consumidor")
            : (receiver?.name || "Consumidor"),
          receiverEmail: originalInvoice?.receiverEmail || undefined,
          receiverPhone: originalInvoice?.receiverPhone || undefined,
          receiverAddress: originalInvoice?.receiverAddress || undefined,
          customerId: originalInvoice?.customerId || undefined,

          // Referencia al documento original
          referencedInvoiceId: noteSubtype === "REFERENCED" ? originalInvoiceId : undefined,
          refEmitterType: originalInvoice ? (organization.ruc?.startsWith("8-NT") ? "2" : "2") : undefined,
          refEmitterRuc: noteSubtype === "REFERENCED" ? (originalInvoice?.issuerRuc || organization.ruc) : undefined,
          refEmitterDv: noteSubtype === "REFERENCED" ? (originalInvoice?.issuerDv || organization.dv) : undefined,
          refEmitterName: noteSubtype === "REFERENCED" ? (originalInvoice?.issuerName || organization.name) : undefined,
          refDocumentDate: noteSubtype === "REFERENCED" ? (originalInvoice?.emittedAt || originalInvoice?.issueDate) : undefined,
          refDocumentType: noteSubtype === "REFERENCED" ? "01" : undefined, // Siempre referencia a Factura
          refCufe: noteSubtype === "REFERENCED" ? originalInvoice?.cufe : undefined,

          // Montos
          subtotal: new Decimal(subtotal.toFixed(2)),
          discount: new Decimal(totalDiscount.toFixed(2)),
          subtotalAfterDiscount: new Decimal((subtotal - totalDiscount).toFixed(2)),
          itbms: new Decimal(totalTax.toFixed(2)),
          total: new Decimal(total.toFixed(2)),

          // Info
          notes: reason,
          paymentMethod,
          issueDate: getPanamaTimestamp(),

          // Warning de antigüedad
          dgiNotificationCode: antiquityWarning ? "ANTIQUITY_WARNING" : undefined,
        },
      })

      // Crear items
      await tx.invoiceItem.createMany({
        data: items.map((item, index) => {
          const itemSubtotal = item.quantity * item.unitPrice
          const itemDiscount = itemSubtotal * (item.discount / 100)
          const itemAfterDiscount = itemSubtotal - itemDiscount
          const itemTax = itemAfterDiscount * (item.taxRate / 100)

          return {
            invoiceId: creditNote.id,
            lineNumber: index + 1,
            code: `NC-ITEM${index + 1}`,
            description: item.description,
            quantity: new Decimal(item.quantity.toFixed(4)),
            unitPrice: new Decimal(item.unitPrice.toFixed(2)),
            discount: new Decimal(itemDiscount.toFixed(2)),
            discountRate: new Decimal(item.discount.toFixed(2)),
            taxRate: new Decimal(item.taxRate.toFixed(2)),
            taxAmount: new Decimal(itemTax.toFixed(2)),
            subtotal: new Decimal(itemAfterDiscount.toFixed(2)),
            total: new Decimal((itemAfterDiscount + itemTax).toFixed(2)),
          }
        }),
      })

      return creditNote
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        action: "CREDIT_NOTE_CREATED",
        entity: "Invoice",
        entityId: result.id,
        changes: JSON.stringify({
          noteSubtype,
          originalInvoiceId: originalInvoiceId || null,
          total,
          reason,
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
        documentType: "NOTA_CREDITO",
        noteSubtype,
        total: result.total,
        status: result.status,
        originalInvoiceId: originalInvoiceId || null,
      },
      ...(antiquityWarning ? { warning: antiquityWarning } : {}),
    })
  } catch (error) {
    console.error("[API] Error al crear nota de crédito:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear la nota de crédito" },
      { status: 500 }
    )
  }
}
