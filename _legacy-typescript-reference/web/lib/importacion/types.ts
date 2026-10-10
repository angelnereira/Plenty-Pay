/**
 * Tipos para el sistema de importación de facturas
 */

export interface FacturaImportada {
  documento: DocumentoInfo;
  emisor: EmisorInfo;
  receptor: ReceptorInfo;
  items: ItemFactura[];
  totales?: TotalesCalculados;
  formatoOriginal: 'excel' | 'csv' | 'json' | 'xml';
  archivoNombre: string;
}

export interface DocumentoInfo {
  tipo: string;
  fecha: Date;
  puntoFacturacion: string;
  sucursal: string;
  moneda: '1' | '2';
}

export interface EmisorInfo {
  ruc: string;
  dv: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface ReceptorInfo {
  tipo: string;
  tipoContribuyente?: string;
  ruc?: string;
  dv?: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  codigoPais?: string;
}

export interface ItemFactura {
  secuencia: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  tasaITBMS: '00' | '01' | '02' | '03';
  valorITBMS?: number;
  total?: number;
}

export interface TotalesCalculados {
  numeroItems: number;
  subtotal: number;
  totalDescuentos: number;
  baseGravada: number;
  totalITBMS: number;
  totalFactura: number;
}

export interface ValidationResult {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

export interface ProcessResult {
  exito: boolean;
  factura?: FacturaImportada;
  xmlGenerado?: string;
  errores?: string[];
  advertencias?: string[];
}
