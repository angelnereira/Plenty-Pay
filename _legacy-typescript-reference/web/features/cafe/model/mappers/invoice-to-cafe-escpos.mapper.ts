import { generarCAFE } from '@/features/hka/model/services/cafe.service';
import type { CAFEEscposInput, EmisionMode } from '../types';

/**
 * Loose invoice shape — avoids coupling to Prisma generated types.
 * Add fields here as needed; all are optional except the core identity fields.
 */
export interface InvoiceForCAFE {
  id: string;
  invoiceNumber?: string | null;
  documentType?: string | null;
  issueDate: Date;
  currency?: string | null;
  issuerName?: string | null;
  issuerRuc?: string | null;
  issuerDv?: string | null;
  issuerAddress?: string | null;
  issuerPhone?: string | null;
  receiverName: string;
  receiverRuc?: string | null;
  receiverDv?: string | null;
  subtotal: number;
  itbms: number;
  discount?: number | null;
  total: number;
  paymentMethod?: string | null;
  qrUrl?: string | null;
  cufeLocal?: string | null;
  cufe?: string | null;
  codigoSucursal?: string | null;
  puntoFacturacion?: string | null;
  numeroDocumentoFiscal?: string | null;
  hkaProtocol?: string | null;
  hkaProtocolDate?: Date | null;
  fechaLimitePosterior?: Date | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxAmount: number;
    unit?: string | null;
  }>;
}

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  '01': 'FACTURA DE OPERACIÓN INTERNA',
  '02': 'FACTURA DE IMPORTACIÓN',
  '03': 'FACTURA DE EXPORTACIÓN',
  '04': 'NOTA DE CRÉDITO',
  '05': 'NOTA DE DÉBITO',
  '06': 'NOTA DE CRÉDITO GENÉRICA',
  '07': 'NOTA DE DÉBITO GENÉRICA',
  '08': 'FACTURA DE ZONA FRANCA',
  '09': 'REEMBOLSO',
  '10': 'FACTURA DE OPERACIÓN EXTRANJERA',
};

function deriveMode(invoice: InvoiceForCAFE): EmisionMode {
  if (invoice.hkaProtocol) return 'SINCRONO';
  if (invoice.fechaLimitePosterior) return 'ASINCRONO';
  return 'CONTINGENCIA';
}

export function invoiceToCAFEEscposInput(
  invoice: InvoiceForCAFE,
  options: { paperWidth: 58 | 80; printerDpi?: number },
): CAFEEscposInput {
  const modo = deriveMode(invoice);
  const cufe = invoice.cufe ?? invoice.cufeLocal ?? 'A'.repeat(64);
  const moneda = invoice.currency ?? 'PAB';

  let qrContent = invoice.qrUrl ?? '';
  let fechaLimiteTransmision: Date | undefined;

  if (modo === 'CONTINGENCIA') {
    const cafeResult = generarCAFE({
      cufe,
      tipoDocumento: (invoice.documentType ?? '01') as any,
      numeroDocumentoFiscal: invoice.numeroDocumentoFiscal ?? '0000000001',
      codigoSucursal: invoice.codigoSucursal ?? '0001',
      puntoFacturacion: invoice.puntoFacturacion ?? '001',
      tipoEmision: '02',
      fechaInicioContingencia: invoice.issueDate,
      motivoContingencia: 'Operación en contingencia por falla de conectividad.',
      fechaEmision: invoice.issueDate,
      moneda,
      totalFactura: invoice.total,
      totalITBMS: invoice.itbms,
      emisor: {
        nombre: invoice.issuerName ?? 'EMISOR',
        ruc: invoice.issuerRuc ?? '000000-0-000000',
        dv: invoice.issuerDv ?? '00',
        direccion: invoice.issuerAddress ?? undefined,
      },
      receptor: {
        nombre: invoice.receiverName,
        ruc: invoice.receiverRuc ?? undefined,
        dv: invoice.receiverDv ?? undefined,
      },
      ambiente: '1',
    });
    qrContent = cafeResult.qrContent;
    fechaLimiteTransmision = cafeResult.fechaLimiteTransmision;
  } else if (modo === 'ASINCRONO' && invoice.fechaLimitePosterior) {
    fechaLimiteTransmision = new Date(invoice.fechaLimitePosterior);
  }

  const items = invoice.items.map((item) => ({
    descripcion: item.description,
    cantidad: item.quantity,
    unidad: item.unit ?? 'UND',
    precioUnitario: item.unitPrice,
    itbms: item.taxAmount,
    total: item.total,
  }));

  const formaPago = invoice.paymentMethod
    ? [{ metodo: invoice.paymentMethod, monto: invoice.total }]
    : [];

  const docLabel = invoice.documentType
    ? (TIPO_DOCUMENTO_LABEL[invoice.documentType] ?? 'FACTURA')
    : 'FACTURA';

  return {
    modo,
    paperWidth: options.paperWidth,
    printerDpi: options.printerDpi ?? 203,
    numeroDocumento:
      invoice.numeroDocumentoFiscal ?? invoice.invoiceNumber ?? invoice.id,
    tipoDocumentoLabel: docLabel,
    fechaEmision: invoice.issueDate,
    moneda,
    emisorNombre: invoice.issuerName ?? 'EMISOR',
    emisorRucDv: `RUC: ${invoice.issuerRuc ?? '---'} DV: ${invoice.issuerDv ?? '--'}`,
    emisorDireccion: invoice.issuerAddress ?? undefined,
    emisorTelefono: invoice.issuerPhone ?? undefined,
    receptorNombre: invoice.receiverName,
    receptorRucDv:
      invoice.receiverRuc && invoice.receiverDv
        ? `RUC: ${invoice.receiverRuc} DV: ${invoice.receiverDv}`
        : undefined,
    subtotal: invoice.subtotal,
    totalITBMS: invoice.itbms,
    descuento: invoice.discount ?? undefined,
    totalFactura: invoice.total,
    items,
    formaPago,
    qrContent,
    cufe,
    hkaProtocol: invoice.hkaProtocol ?? undefined,
    hkaProtocolDate: invoice.hkaProtocolDate ?? undefined,
    fechaLimiteTransmision,
  };
}
