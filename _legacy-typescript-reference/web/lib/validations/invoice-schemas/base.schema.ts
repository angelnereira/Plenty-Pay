import { z } from 'zod';
import { INCOTERMS_DGI } from '@/lib/constants/incoterms';

// ─── Schemas primitivos ────────────────────────────────────────────────────────

export const tipoClienteFESchema = z.enum(['01', '02', '03', '04']);

export const tasaITBMSSchema = z.enum(['00', '01', '02', '03']);

export const baseItemSchema = z.object({
  id: z.string(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  code: z.string().optional(),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.number().min(0, 'Precio no puede ser negativo'),
  precioUnitarioDescuento: z.number().min(0),
  tasaITBMS: tasaITBMSSchema,
  valorITBMS: z.number().min(0),
  precioItem: z.number().min(0),
  valorTotal: z.number().min(0),
  productId: z.string().optional(),
  cpbsCode: z.string().optional(),
  cpbsUnit: z.string().optional(),
  rucTercero: z.string().optional(),
  numeroDocumentoTercero: z.string().optional(),
});

export const baseClientSchema = z.object({
  tipoClienteFE: tipoClienteFESchema,
  tipoContribuyente: z.string(),
  numeroRUC: z.string(),
  digitoVerificadorRUC: z.string(),
  razonSocial: z.string(),
  direccion: z.string(),
  codigoUbicacion: z.string(),
  provincia: z.string(),
  distrito: z.string(),
  corregimiento: z.string(),
  telefono1: z.string().optional(),
  correoElectronico1: z.string().email().optional().or(z.literal('')),
});

export const basePaymentSchema = z.object({
  formaPagoFact: z.string(),
  descFormaPago: z.string(),
  tiempoPago: z.string(),
  informacionInteres: z.string(),
});

export const incotermSchema = z.enum(
  Object.keys(INCOTERMS_DGI) as [string, ...string[]]
);

export type BaseItem = z.infer<typeof baseItemSchema>;
export type BaseClient = z.infer<typeof baseClientSchema>;
