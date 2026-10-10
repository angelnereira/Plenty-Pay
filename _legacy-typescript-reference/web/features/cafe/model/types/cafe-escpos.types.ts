/** Emission mode determines which DGI legal text is printed */
export type EmisionMode = 'SINCRONO' | 'ASINCRONO' | 'CONTINGENCIA';

export interface CAFEEscposItem {
  descripcion: string;
  cantidad: number;
  unidad: string;       // e.g. "UND", "KG", "M2"
  precioUnitario: number;
  itbms: number;
  total: number;
}

export interface CAFEEscposPago {
  metodo: string;       // e.g. "Efectivo", "Tarjeta Débito"
  monto: number;
}

export interface CAFEEscposInput {
  modo: EmisionMode;
  paperWidth: 58 | 80;  // mm — 58 → 32 cols, 80 → 48 cols
  printerDpi?: number;  // default 203

  // Document identity
  numeroDocumento: string;     // "0001-001-0000000001"
  tipoDocumentoLabel: string;  // "FACTURA DE OPERACIÓN INTERNA"
  fechaEmision: Date;
  moneda: string;              // "PAB" | "USD"

  // Parties
  emisorNombre: string;
  emisorRucDv: string;         // "RUC: 123456-1-123456 DV: 28"
  emisorDireccion?: string;
  emisorTelefono?: string;
  receptorNombre: string;
  receptorRucDv?: string;

  // Amounts
  subtotal: number;
  totalITBMS: number;
  descuento?: number;
  totalFactura: number;

  // Line items
  items: CAFEEscposItem[];

  // Payment
  formaPago: CAFEEscposPago[];
  cambio?: number;

  // QR — full DGI verification URL
  qrContent: string;

  // CUFE (64 characters)
  cufe?: string;

  // Mode-specific
  hkaProtocol?: string;               // SINCRONO
  hkaProtocolDate?: Date;             // SINCRONO
  fechaLimiteTransmision?: Date;      // ASINCRONO | CONTINGENCIA

  // Optional sections
  mensajePromocional?: string;        // Section 5
  requiereFirma?: boolean;            // Section 6 acceptance block
}

export interface PrintResult {
  success: boolean;
  error?: string;
}