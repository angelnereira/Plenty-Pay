import { z } from 'zod';
import {
  baseItemSchema,
  baseClientSchema,
  basePaymentSchema,
  incotermSchema,
} from './base.schema';

// ─── Schema base del formulario ────────────────────────────────────────────────

const baseInvoiceSchema = z.object({
  client: baseClientSchema,
  items: z.array(baseItemSchema).min(1, 'Al menos 1 ítem requerido'),
  payment: basePaymentSchema,
});

// ─── Tipo 01: Factura Interna ──────────────────────────────────────────────────

export const facturaInternaSchema = baseInvoiceSchema.extend({
  documentType: z.literal('FACTURA'),
}).superRefine((data, ctx) => {
  // Si el cliente es Contribuyente (01) o Gobierno (03), RUC y Razón Social son obligatorios
  if (data.client.tipoClienteFE === '01' || data.client.tipoClienteFE === '03') {
    if (!data.client.numeroRUC || data.client.numeroRUC.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['client', 'numeroRUC'],
        message: 'RUC es obligatorio para Contribuyente/Gobierno',
      });
    }
    if (!data.client.razonSocial || data.client.razonSocial.trim().length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['client', 'razonSocial'],
        message: 'Razón Social debe tener al menos 2 caracteres',
      });
    }
    if (!data.client.direccion || data.client.direccion.trim().length < 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['client', 'direccion'],
        message: 'Dirección debe tener al menos 5 caracteres',
      });
    }
  }
  // Si el cliente es Gobierno (03), CPBS es obligatorio en todos los items
  if (data.client.tipoClienteFE === '03') {
    data.items.forEach((item, i) => {
      if (!item.cpbsCode || item.cpbsCode.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'cpbsCode'],
          message: 'Código CPBS obligatorio para facturas al Gobierno',
        });
      }
    });
  }
  // Si forma de pago es '99', descripción obligatoria
  if (
    data.payment.formaPagoFact === '99' &&
    (!data.payment.descFormaPago || data.payment.descFormaPago.trim() === '')
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['payment', 'descFormaPago'],
      message: 'Descripción de pago requerida cuando es "Otro"',
    });
  }
});

// ─── Tipo 02: Importación ─────────────────────────────────────────────────────

export const facturaImportacionSchema = baseInvoiceSchema.extend({
  documentType: z.literal('FACTURA_IMPORTACION'),
  importData: z
    .object({
      paisOrigen: z.string().optional(),
    })
    .optional(),
});

// ─── Tipo 03: Exportación ─────────────────────────────────────────────────────

export const facturaExportacionSchema = baseInvoiceSchema
  .extend({
    documentType: z.literal('FACTURA_EXPORTACION'),
    exportData: z.object({
      incoterm: incotermSchema,
      currency: z.string().length(3).optional(),
      currencyDesc: z.string().optional(),
      exchangeRate: z.string().optional(),
      foreignAmount: z.string().optional(),
      port: z.string().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    // Todos los items deben tener ITBMS exento
    data.items.forEach((item, i) => {
      if (item.tasaITBMS !== '00') {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'tasaITBMS'],
          message: 'Exportación: todos los ítems deben ser exentos de ITBMS (00)',
        });
      }
    });
  });

// ─── Tipo 04: NC Referenciada ─────────────────────────────────────────────────

export const notaCreditoReferenciadaSchema = baseInvoiceSchema
  .extend({
    documentType: z.literal('NOTA_CREDITO'),
    noteSubtype: z.literal('REFERENCED'),
    referenceData: z.object({
      cufe: z.string().min(64, 'CUFE debe tener al menos 64 caracteres'),
      fechaEmision: z.string(),
      numeroDocumento: z.string().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    const dias = Math.floor(
      (Date.now() - new Date(data.referenceData.fechaEmision).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dias > 180) {
      ctx.addIssue({
        code: 'custom',
        path: ['referenceData', 'fechaEmision'],
        message: `La factura original tiene ${dias} días. El máximo permitido por DGI es 180 días.`,
      });
    }
  });

// ─── Tipo 05: ND Referenciada ─────────────────────────────────────────────────

export const notaDebitoReferenciadaSchema = baseInvoiceSchema
  .extend({
    documentType: z.literal('NOTA_DEBITO'),
    noteSubtype: z.literal('REFERENCED'),
    referenceData: z.object({
      cufe: z.string().min(64, 'CUFE debe tener al menos 64 caracteres'),
      fechaEmision: z.string(),
      numeroDocumento: z.string().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    const dias = Math.floor(
      (Date.now() - new Date(data.referenceData.fechaEmision).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dias > 180) {
      ctx.addIssue({
        code: 'custom',
        path: ['referenceData', 'fechaEmision'],
        message: `La factura original tiene ${dias} días. El máximo permitido por DGI es 180 días.`,
      });
    }
  });

// ─── Tipo 06: NC Genérica ─────────────────────────────────────────────────────

export const notaCreditoGenericaSchema = baseInvoiceSchema.extend({
  documentType: z.literal('NOTA_CREDITO'),
  noteSubtype: z.literal('GENERIC'),
});

// ─── Tipo 07: ND Genérica ─────────────────────────────────────────────────────

export const notaDebitoGenericaSchema = baseInvoiceSchema.extend({
  documentType: z.literal('NOTA_DEBITO'),
  noteSubtype: z.literal('GENERIC'),
});

// ─── Tipo 08: Zona Franca ─────────────────────────────────────────────────────

export const zonaFrancaSchema = baseInvoiceSchema
  .extend({
    documentType: z.literal('FACTURA_ZONA_FRANCA'),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((item, i) => {
      if (item.tasaITBMS !== '00') {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'tasaITBMS'],
          message: 'Zona Franca: todos los ítems deben ser exentos de ITBMS (00)',
        });
      }
    });
  });

// ─── Tipo 09: Reembolso ───────────────────────────────────────────────────────

export const reembolsoSchema = baseInvoiceSchema.extend({
  documentType: z.literal('REEMBOLSO'),
});

// ─── Tipo 10: Extranjera/Compra ───────────────────────────────────────────────

export const extranjeraCompraSchema = baseInvoiceSchema.extend({
  documentType: z.literal('FACTURA_EXTRANJERA'),
  compraData: z
    .object({
      cedulaProveedor: z.string().min(1, 'Cédula del proveedor requerida'),
      nombreProveedor: z.string().min(2, 'Nombre del proveedor requerido'),
    })
    .optional(),
});

// ─── Schema principal (selección manual por documentType) ─────────────────────
// No usamos z.discriminatedUnion porque NC/ND tienen el mismo documentType con
// diferente noteSubtype. En su lugar, exportamos una función selectora.

export const INVOICE_SCHEMAS = {
  FACTURA: facturaInternaSchema,
  FACTURA_IMPORTACION: facturaImportacionSchema,
  FACTURA_EXPORTACION: facturaExportacionSchema,
  NOTA_CREDITO_REFERENCED: notaCreditoReferenciadaSchema,
  NOTA_CREDITO_GENERIC: notaCreditoGenericaSchema,
  NOTA_DEBITO_REFERENCED: notaDebitoReferenciadaSchema,
  NOTA_DEBITO_GENERIC: notaDebitoGenericaSchema,
  FACTURA_ZONA_FRANCA: zonaFrancaSchema,
  REEMBOLSO: reembolsoSchema,
  FACTURA_EXTRANJERA: extranjeraCompraSchema,
} as const;

export type InvoiceSchemaKey = keyof typeof INVOICE_SCHEMAS;

export function selectInvoiceSchema(
  documentType: string,
  noteSubtype?: 'REFERENCED' | 'GENERIC'
) {
  if (documentType === 'NOTA_CREDITO') {
    return noteSubtype === 'REFERENCED'
      ? notaCreditoReferenciadaSchema
      : notaCreditoGenericaSchema;
  }
  if (documentType === 'NOTA_DEBITO') {
    return noteSubtype === 'REFERENCED'
      ? notaDebitoReferenciadaSchema
      : notaDebitoGenericaSchema;
  }
  return (
    INVOICE_SCHEMAS[documentType as InvoiceSchemaKey] ?? facturaInternaSchema
  );
}

export * from './base.schema';
