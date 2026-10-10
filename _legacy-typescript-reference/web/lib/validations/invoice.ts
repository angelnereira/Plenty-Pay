import { z } from "zod"

/**
 * Schema de validación para items de factura
 */
export const invoiceItemSchema = z.object({
  // ID del producto en inventario (opcional — solo para ítems vinculados al inventario)
  productId: z.string().optional(),
  description: z.string().min(1, "Descripción requerida").max(500),
  quantity: z.number().min(0.01, "Cantidad debe ser mayor a 0"),
  unitPrice: z.number().min(0, "Precio unitario debe ser mayor o igual a 0"),
  taxRate: z.number().min(0).max(100).default(7), // IVA en Panamá es 7%
  discount: z.number().min(0).max(100).default(0),
})

/**
 * Schema de validación para datos del cliente
 */
export const clientSchema = z.object({
  name: z.string().min(1, "Nombre del cliente requerido"),
  taxId: z.string().min(1, "RUC/Cédula requerido"), // RUC o Cédula en Panamá
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().min(1, "Dirección requerida"),
  city: z.string().default("Panamá"),
  country: z.string().default("PA"),
})

/**
 * Schema de validación para crear una factura
 */
export const createInvoiceSchema = z.object({
  // Datos del cliente
  client: clientSchema,

  // Items de la factura
  items: z.array(invoiceItemSchema).min(1, "Debe incluir al menos un item"),

  // Información adicional
  notes: z.string().max(1000).optional(),
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "TRANSFER",
    "CHECK",
    "OTHER"
  ]).default("CASH"),

  // Fechas
  issueDate: z.date().optional(), // Si no se proporciona, se usa la fecha actual
  dueDate: z.date().optional(),
})

/**
 * Type inference para TypeScript
 */
export type InvoiceItem = z.infer<typeof invoiceItemSchema>
export type Client = z.infer<typeof clientSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

/**
 * Helper para calcular totales de un item
 */
export function calculateItemTotals(item: InvoiceItem) {
  const subtotal = item.quantity * item.unitPrice
  const discountAmount = subtotal * (item.discount / 100)
  const subtotalAfterDiscount = subtotal - discountAmount
  const taxAmount = subtotalAfterDiscount * (item.taxRate / 100)
  const total = subtotalAfterDiscount + taxAmount

  return {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    taxAmount,
    total,
  }
}

/**
 * Helper para calcular totales de la factura
 */
export function calculateInvoiceTotals(items: InvoiceItem[]) {
  let subtotal = 0
  let totalDiscount = 0
  let totalTax = 0
  let total = 0

  items.forEach(item => {
    const itemTotals = calculateItemTotals(item)
    subtotal += itemTotals.subtotal
    totalDiscount += itemTotals.discountAmount
    totalTax += itemTotals.taxAmount
    total += itemTotals.total
  })

  return {
    subtotal,
    totalDiscount,
    subtotalAfterDiscount: subtotal - totalDiscount,
    totalTax,
    total,
  }
}

// Re-exportaciones del nuevo sistema de schemas por tipo
export * from './invoice-schemas';
export { selectInvoiceSchema } from './invoice-schemas';

