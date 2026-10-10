/**
 * HKA Web Service - Tipos TypeScript
 * 
 * Definiciones estrictas basadas en HKA_Documentacion_Completa.md
 * Todos los tipos siguen exactamente los formatos especificados por HKA
 */

import { z } from 'zod';

// ============================================
// CONFIGURACIÓN Y CREDENCIALES
// ============================================

/**
 * Configuración completa para conexión con HKA
 * Se obtiene de la tabla Client en Prisma
 */
export interface HKAConfig {
  /** Token de autenticación de la empresa (proporcionado por HKA) */
  tokenEmpresa: string;
  /** Contraseña del token (debe estar desencriptada) */
  tokenPassword: string;
  /** Ambiente: demo o prod */
  environment: 'demo' | 'prod';
  /** Código de sucursal AN|4 (ej: "0000" para casa matriz) */
  branchCode: string;
  /** Tipo de sucursal: 1=Retail, 2=Por mayor */
  tipoSucursal: '1' | '2';
  /** Punto de facturación N|3 (nunca "000", mínimo "001") */
  puntoFacturacionFiscal: string;
  /** Código de ubicación formato: provincia-distrito-corregimiento (ej: "1-1-1") */
  locationCode: string;
  /** Provincia del emisor */
  provincia: string;
  /** Distrito del emisor */
  distrito: string;
  /** Corregimiento del emisor */
  corregimiento: string;
  /** Tipo de emisión: 01-04 según catálogo */
  tipoEmision: TipoEmision;
  /** Destino de operación: 1=Panamá, 2=Extranjero */
  destinoOperacion: '1' | '2';
  /** Formato CAFE: 1=Sin CAFE, 2=Cinta papel, 3=Carta */
  formatoCAFE: '1' | '2' | '3';
  /** Entrega CAFE: 1=Sin CAFE, 2=Papel, 3=Electrónico */
  entregaCAFE: '1' | '2' | '3';
  /** Envío contenedor: 1=Normal, 2=Receptor exceptúa envío */
  envioContenedor: '1' | '2';
  /** Proceso generación: 1=Sistema propio del contribuyente */
  procesoGeneracion: '1';
  // --- Contingencia (leído de SystemConfig, inyectado cuando tipoEmision=02/04) ---
  /** Si el sistema está en modo contingencia actualmente */
  contingenciaActiva?: boolean;
  /** Fecha/hora ISO en que inició la contingencia (B04) */
  contingenciaInicio?: string;
  /** Motivo de la contingencia AN|15..250 (B05) */
  contingenciaMotivo?: string;
  /** Tipo de contingencia: '02'=Internet contribuyente, '04'=Fallas DGI */
  contingenciaTipo?: '02' | '04';
  // --- Datos del emisor (para generación local de CUFE en tipoEmision 02/03/04) ---
  /** RUC del emisor (leído de Client.ruc) */
  emisorRuc?: string;
  /** Dígito verificador del RUC del emisor (leído de Client.dv) */
  emisorDv?: string;
  /** Tipo contribuyente del emisor: '1'=Natural, '2'=Jurídico (leído de Client.rucType) */
  emisorTipoContribuyente?: TipoContribuyente;
}

// ============================================
// CATÁLOGOS DE REFERENCIA
// ============================================

/** Tipos de documento fiscal */
export type TipoDocumento = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10';

/** Tipos de emisión */
export type TipoEmision = '01' | '02' | '03' | '04';

/** Tipos de cliente para factura electrónica */
export type TipoClienteFE = '01' | '02' | '03' | '04';

/** Naturaleza de operación */
export type NaturalezaOperacion = '01' | '02' | '03' | '04' | '10' | '11' | '12' | '13' | '14' | '20' | '21';

/** Formas de pago */
export type FormaPago = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '99';

/** Tasas de ITBMS */
export type TasaITBMS = '00' | '01' | '02' | '03';

/** Códigos OTI - Otros Tributos e Impuestos */
export type CodigoOTI = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11';

/** Tipo de contribuyente */
export type TipoContribuyente = '1' | '2';

/** Tipo de identificación para extranjeros */
export type TipoIdentificacion = '01' | '02' | '99';

/** Tipo de operación */
export type TipoOperacion = '1' | '2';

/** Tiempo de pago */
export type TiempoPago = '1' | '2' | '3';

/** Tipo de venta */
export type TipoVenta = '1' | '2' | '3' | '4';

// ============================================
// ESTRUCTURA DATODOCUMENTO (COMPARTIDA)
// ============================================

/**
 * Estructura DatosDocumento
 * Usada en: EstadoDocumento, AnulacionDocumento, DescargaXML, EnvioCorreo, DescargaPDF
 */
export interface DatosDocumento {
  /** Código de sucursal AN|4 */
  codigoSucursalEmisor: string;
  /** Número del documento fiscal N|10 con ceros a la izquierda */
  numeroDocumentoFiscal: string;
  /** Punto de facturación N|3, no admite "000" */
  puntoFacturacionFiscal: string;
  /** Tipo de documento N|2 (01-10) */
  tipoDocumento: TipoDocumento;
  /** Tipo de emisión N|2 (01-04) */
  tipoEmision: TipoEmision;
}

// ============================================
// CLIENTE/RECEPTOR
// ============================================

/** Datos base del cliente (campos siempre presentes) */
interface ClienteBase {
  /** Tipo de cliente: 01=Contribuyente, 02=Consumidor final, 03=Gobierno, 04=Extranjero */
  tipoClienteFE: TipoClienteFE;
  /** País: "PA" si destinoOperacion=1, código ISO si =2, "ZZ" si no existe */
  pais: string;
  /** Teléfono (opcional) AN|7..16 */
  telefono1?: string;
  /** Correo electrónico principal (opcional) AN|..50 */
  correoElectronico1?: string;
  /** Correo adicional 2 (opcional) */
  correoElectronico2?: string;
  /** Correo adicional 3 (opcional) */
  correoElectronico3?: string;
  /** País otro - obligatorio si pais="ZZ" */
  paisOtro?: string;
}

/** Cliente contribuyente (tipoClienteFE=01) o Gobierno (tipoClienteFE=03) */
export interface ClienteContribuyente extends ClienteBase {
  tipoClienteFE: '01' | '03';
  /** Tipo de contribuyente: 1=Natural, 2=Jurídico */
  tipoContribuyente: TipoContribuyente;
  /** RUC del receptor AN|20 */
  numeroRUC: string;
  /** Dígito verificador N|2 */
  digitoVerificadorRUC: string;
  /** Razón social AN|2..200 */
  razonSocial: string;
  /** Dirección AN|5..100 */
  direccion: string;
  /** Código ubicación formato provincia-distrito-corregimiento */
  codigoUbicacion: string;
  /** Provincia */
  provincia: string;
  /** Distrito */
  distrito: string;
  /** Corregimiento */
  corregimiento: string;
  /** Código CPBS (obligatorio si tipoClienteFE=03) */
  codigoCPBS?: string;
}

/** Cliente consumidor final (tipoClienteFE=02) */
export interface ClienteConsumidorFinal extends ClienteBase {
  tipoClienteFE: '02';
  /** RUC opcional (cédula si el cliente lo solicita) */
  numeroRUC?: string;
  /** Tipo de contribuyente opcional */
  tipoContribuyente?: TipoContribuyente;
  /** Razón social opcional */
  razonSocial?: string;
  /** Nombre del cliente opcional (para mostrar en el CAFE) */
  nombre?: string;
  /** Dirección opcional (para mostrar en el CAFE) */
  direccion?: string;
  /** Dígito verificador del RUC opcional */
  digitoVerificadorRUC?: string;
}

/** Cliente extranjero (tipoClienteFE=04) */
export interface ClienteExtranjero extends ClienteBase {
  tipoClienteFE: '04';
  /** Tipo de identificación: 01=Pasaporte, 02=NIT, 99=Otro */
  tipoIdentificacion: TipoIdentificacion;
  /** Número de identificación extranjero AN|..50 */
  nroIdentificacionExtranjero: string;
  /** País extranjero (nombre completo si usa pasaporte) */
  paisExtranjero?: string;
}

/** Union de todos los tipos de cliente */
export type Cliente = ClienteContribuyente | ClienteConsumidorFinal | ClienteExtranjero;

// ============================================
// ITEMS DE FACTURA
// ============================================

/** Otros tributos e impuestos por ítem */
export interface ItemOTI {
  /** Código OTI 01-11 según catálogo */
  tasaOTI: CodigoOTI;
  /** Valor del tributo N|1..9|2.6 */
  valorTasa: string;
}

/** Ítem de factura */
export interface ItemFactura {
  /** Descripción del producto/servicio AN|2..500 */
  descripcion: string;
  /** Código interno del producto (opcional) AN|1..20 */
  codigo?: string;
  /** Unidad de medida (opcional) AN|1..20 */
  unidadMedida?: string;
  /** Cantidad N|1..9|2.6 */
  cantidad: string;
  /** Fecha de fabricación AAAA-MM-DD (condicional - medicinas/alimentos) */
  fechaFabricacion?: string;
  /** Fecha de caducidad AAAA-MM-DD (condicional) */
  fechaCaducidad?: string;
  /** Código CPBS abreviado (obligatorio si tipoClienteFE=03) AN|2 */
  codigoCPBSAbrev?: string;
  /** Código CPBS completo (obligatorio si tipoClienteFE=03) AN|4 */
  codigoCPBS?: string;
  /** Unidad de medida CPBS (obligatorio si tipoClienteFE=03) AN|1..30 */
  unidadMedidaCPBS?: string;
  /** Información adicional del ítem (opcional) AB|0..5000 */
  infoItem?: string;
  /** Precio unitario N|0..11|2.6 */
  precioUnitario: string;
  /** Valor del descuento en Balboas N|1..9|2.6 */
  precioUnitarioDescuento: string;
  /** Cantidad × (PrecioUnitario - Descuento) N|1..9|2.6 */
  precioItem: string;
  /** Acarreo específico del ítem (opcional) N|1..9|2 */
  precioAcarreo?: string;
  /** Seguro específico del ítem (opcional) N|1..9|2 */
  precioSeguro?: string;
  /** PrecioItem + Acarreo + Seguro + ITBMS + ISC N|1..9|2.6 */
  valorTotal: string;
  /** Código tasa ITBMS: 00=0%, 01=7%, 02=10%, 03=15% */
  tasaITBMS: TasaITBMS;
  /** Valor ITBMS calculado N|1..9|2.6 */
  valorITBMS: string;
  /** Tasa ISC si aplica N|1..11|2.4 */
  tasaISC?: string;
  /** Monto ISC si aplica N|1..9|2.6 */
  valorISC?: string;
  /** Lista de otros tributos por ítem (opcional) */
  listaItemOTI?: ItemOTI[];
}

// ============================================
// TOTALES Y FORMAS DE PAGO
// ============================================

/** Forma de pago individual */
export interface FormaPagoFactura {
  /** Código forma de pago 01-99 */
  formaPagoFact: FormaPago;
  /** Descripción obligatoria si formaPagoFact=99 */
  descFormaPago?: string;
  /** Monto pagado con esta forma N|1..11|1.2 */
  valorCuotaPagada: string;
}

/** Total OTI */
export interface TotalOTI {
  /** Código OTI 01-11 */
  codigoTotalOTI: CodigoOTI;
  /** Sumatoria del OTI N|1..11|1.2 */
  valorTotalOTI: string;
}

/** Pago a plazo (para tiempoPago 2=Plazo o 3=Mixto) */
export interface PagoPlazo {
  /** Fecha de vencimiento de la cuota AAAA-MM-DDThh:mm:ssTZH */
  fechaVenceCuota: string;
  /** Valor de la cuota N|1..11|1.2 */
  valorCuota: string;
}

/** Descuento o bonificación global (obligatorio cuando totalDescuento > 0) */
export interface DescBonificacion {
  /** 01 = Descuento, 02 = Bonificación */
  tipoDescBonif: '01' | '02';
  /** Descripción requerida por HKA XSD AN|1..100 */
  descDescuento: string;
  /** Monto global del descuento/bonificación N|1..11|1.2 */
  montoGlobalDescBonificacion: string;
}

/** Totales y subtotales de la factura */
export interface TotalesSubTotales {
  /** Suma de todos los PrecioItem N|1..11|1.2 */
  totalPrecioNeto: string;
  /** Suma de todos los ValorITBMS N|1..11|2 */
  totalITBMS: string;
  /** Suma de todos los ValorISC N|1..11|2 */
  totalISC?: string;
  /** TotalITBMS + TotalISC + valorTotalOTI N|1..11|1.2 */
  totalMontoGravado: string;
  /** Suma de todos los descuentos (opcional) N|1..11|1.2 */
  totalDescuento?: string;
  /** Acarreo total (no usar si se usó precioAcarreo en items) */
  totalAcarreoCobrado?: string;
  /** Seguro total (no usar si se usó precioSeguro en items) */
  valorSeguroCobrado?: string;
  /** Total final de la factura N|1..11|1.2 */
  totalFactura: string;
  /** Suma de valorCuotaPagada N|1..11|1.2 */
  totalValorRecibido: string;
  /** TotalValorRecibido - TotalFactura (solo si hay vuelto) */
  vuelto?: string;
  /** 1=Inmediato, 2=Plazo, 3=Mixto */
  tiempoPago: TiempoPago;
  /** Cantidad total de ítems N|1..11 */
  nroItems: string;
  /** Suma de ValorTotal de todos los ítems N|1..11|1.2 */
  totalTodosItems: string;
  /** Otros gastos cobrados (opcional) */
  totalOtrosGastos?: string;
  /** Descuentos/bonificaciones globales (obligatorio si totalDescuento > 0) */
  listaDescBonificacion?: DescBonificacion[];
  /** Lista de formas de pago (obligatorio) */
  listaFormaPago: FormaPagoFactura[];
  /** Lista de pagos a plazo (condicional: tiempoPago 2 o 3) */
  listaPagoPlazo?: PagoPlazo[];
  /** Lista de totales OTI (condicional) */
  listaTotalOTI?: TotalOTI[];
}

// ============================================
// DATOS DE TRANSACCIÓN
// ============================================

/** Datos de la transacción */
export interface DatosTransaccion {
  /** Tipo de emisión 01-04 */
  tipoEmision: TipoEmision;
  /** Fecha inicio contingencia - obligatorio si tipoEmision=02/04 */
  fechaInicioContingencia?: string;
  /** Motivo contingencia AN|15..250 - obligatorio si tipoEmision=02/04 */
  motivoContingencia?: string;
  /** Tipo de documento 01-10 */
  tipoDocumento: TipoDocumento;
  /** Número del documento fiscal N|10 con padding de ceros */
  numeroDocumentoFiscal: string;
  /** Punto de facturación N|3, no admite "000" */
  puntoFacturacionFiscal: string;
  /** Fecha emisión AAAA-MM-DDThh:mm:ssTZH */
  fechaEmision: string;
  /** Fecha salida (opcional) */
  fechaSalida?: string;
  /** Naturaleza de operación 01-21 */
  naturalezaOperacion: NaturalezaOperacion;
  /** Tipo operación: 1=Salida/venta, 2=Entrada/compra */
  tipoOperacion: TipoOperacion;
  /** Destino operación: 1=Panamá, 2=Extranjero */
  destinoOperacion: '1' | '2';
  /** Formato CAFE: 1=Sin CAFE, 2=Cinta papel, 3=Carta */
  formatoCAFE: '1' | '2' | '3';
  /** Entrega CAFE: 1=Sin CAFE, 2=Papel, 3=Electrónico */
  entregaCAFE: '1' | '2' | '3';
  /** Envío contenedor: 1=Normal, 2=Receptor exceptúa envío */
  envioContenedor: '1' | '2';
  /** Proceso generación: 1=Sistema propio */
  procesoGeneracion: '1';
  /** Tipo venta: 1=Giro negocio, 2=Activo fijo, 3=Bienes raíces, 4=Servicio */
  tipoVenta?: TipoVenta;
  /** Información adicional de interés (opcional) AN|..5000 */
  informacionInteres?: string;
  /** Datos del cliente */
  cliente: Cliente;
  /** Identificador para firma electrónica (FE + CUFE de 64 chars = 66 chars) */
  dId?: string;
}

// ============================================
// DOCUMENTO FISCAL REFERENCIADO (gDFRef / B60)
// ============================================

/**
 * Grupo Documento Fiscal Referenciado (gDFRef / B60)
 * Obligatorio para NC/ND tipo 04/05. PROHIBIDO para tipo 06/07.
 * Hasta 99 ocurrencias permitidas por documento.
 */
export interface DocumentoFiscalReferenciado {
  /** Fecha exacta del documento original AAAA-MM-DDThh:mm:ssTZH */
  fechaEmisionDocFiscalReferenciado: string;
  /** CUFE del documento original (66 posiciones) - para FE */
  cufeFEReferenciada?: string;
  /** Número de factura si es papel */
  nroFacturaPapel?: string;
  /** Número de factura si es fiscal */
  nroFacturaImpFiscal?: string;
}

// ============================================
// GRUPO DE EXPORTACIÓN (gFExp)
// ============================================

/**
 * Grupo Factura de Exportación (gFExp)
 * Obligatorio cuando destinoOperacion='2' (Extranjero).
 * Se ubica dentro del grupo gDGen del XML.
 *
 * Regla B14a: Si tipoDocumento='03' (Exportación), destinoOperacion DEBE ser '2'.
 * Campos opcionales que no apliquen deben OMITIRSE del XML (nunca enviar vacíos).
 */
export interface GrupoExportacion {
  /** Condición de entrega INCOTERMS (Tabla 32 DGI) A|3 — Obligatorio */
  cCondEntr: string;
  /** Moneda ISO 4217 A|3 — Opcional. Default: PAB/USD */
  cMoneda?: string;
  /** Descripción de moneda A|5..50 — Obligatorio si cMoneda='ZZZ' */
  cMonedaDesc?: string;
  /** Tasa de cambio N|1-11p2-4 — Obligatorio si cMoneda ≠ USD */
  dCambio?: string;
  /** Monto total en moneda extranjera N|1-20p0-4 — Obligatorio si cMoneda presente */
  dVTotEst?: string;
  /** Puerto de embarque A|5..50 — Opcional */
  dPuertoEmbarq?: string;
}

// ============================================
// DOCUMENTO ELECTRÓNICO COMPLETO
// ============================================

/** Documento electrónico completo para método Enviar */
export interface DocumentoElectronico {
  /** Código sucursal emisor AN|4 */
  codigoSucursalEmisor: string;
  /** Tipo sucursal: 1=Retail, 2=Por mayor */
  tipoSucursal?: '1' | '2';
  /** Datos de la transacción */
  datosTransaccion: DatosTransaccion;
  /** gDFRef - Lista de documentos fiscales referenciados (hasta 99). Obligatorio para tipo 04/05, PROHIBIDO para 06/07 */
  listaDocsFiscalReferenciados?: DocumentoFiscalReferenciado[];
  /** gFExp - Grupo de exportación. Obligatorio cuando destinoOperacion='2' */
  grupoExportacion?: GrupoExportacion;
  /** Lista de ítems */
  listaItems: ItemFactura[];
  /** Totales y subtotales */
  totalesSubTotales: TotalesSubTotales;
  /**
   * CUFE generado localmente para tipoEmision 02/03/04.
   * Inyectado por el mapper; el XML builder lo usa en <usoPosterior><cufe>.
   * never sent to HKA directly — only travels within the memory object.
   */
  contingenciaCufe?: string;
  /** Identificador para firma electrónica (FE + CUFE de 64 chars = 66 chars) */
  dId?: string;
}

// ============================================
// RESPUESTAS HKA
// ============================================

/** Respuesta genérica de HKA */
export interface HKAResponse<T = void> {
  /** true si código === "200" */
  success: boolean;
  /** Código de respuesta HKA */
  code: string;
  /** Mensaje descriptivo */
  message: string;
  /** Resultado: "procesado" si exitoso */
  resultado?: string;
  /** Datos específicos del método */
  data?: T;
}

/** Respuesta del método Enviar */
export interface EnviarResponse {
  /** CUFE - Código Único de Factura Electrónica (66 caracteres) */
  cufe: string;
  /** URL completa del código QR */
  qr: string;
  /** Fecha y hora de autorización por la DGI */
  fechaRecepcionDGI: string;
  /** Número de protocolo asignado por la DGI */
  nroProtocoloAutorizacion: string;
}

/** Respuesta del método EstadoDocumento */
export interface EstadoDocumentoResponse {
  /** Estado actual: Autorizada, Pendiente, Rechazada, Anulada */
  estatusDocumento: string;
  /** CUFE del documento */
  cufe: string;
  /** Fecha de emisión del documento */
  fechaEmisionDocumento: string;
  /** Fecha de recepción por HKA */
  fechaRecepcionDocumento: string;
  /** Mensaje adicional sobre el estado */
  mensajeDocumento: string;
}

/** Respuesta del método FoliosRestantes */
export interface FoliosRestantesResponse {
  /** Código de la licencia */
  licencia: string;
  /** Rango de fechas de la licencia */
  fechaLicencia: string;
  /** Número del ciclo actual */
  ciclo: string;
  /** Rango de fechas del ciclo actual */
  fechaCiclo: string;
  /** Folios totales del ciclo */
  foliosTotalesCiclo: number;
  /** Folios utilizados en el ciclo */
  foliosUtilizadosCiclo: number;
  /** Folios disponibles en el ciclo */
  foliosDisponiblesCiclo: number;
  /** Folios totales de toda la licencia */
  foliosTotales: number;
}

/** Respuesta del método ConsultarRucDV */
export interface ConsultarRucDVResponse {
  /** Tipo de RUC: 1=Natural, 2=Jurídico */
  tipoRuc: string;
  /** RUC consultado */
  ruc: string;
  /** Dígito verificador */
  dv: string;
  /** Razón social o nombre */
  razonSocial: string;
  /** Indica si está afiliado a FE */
  afiliadoFE: string;
}

/** Respuesta de descarga (PDF/XML) */
export interface DescargaResponse {
  /** Contenido codificado en Base64 */
  documento: string;
}

/** Elemento de rastreo de correo */
export interface RastreoCorreoItem {
  /** Dirección de correo */
  correo: string;
  /** Fecha y hora de envío */
  creado_en: string;
  /** Estado: delivered, opened, bounced, etc. */
  estado: string;
  /** ID único del mensaje */
  messageId: string;
}

/** Respuesta del método RastreoCorreo */
export interface RastreoCorreoResponse {
  /** Lista de estados de correos enviados */
  listaRastreo: RastreoCorreoItem[];
}

// ============================================
// SCHEMAS ZOD PARA VALIDACIÓN
// ============================================

/** Schema para validar DatosDocumento */
export const DatosDocumentoSchema = z.object({
  codigoSucursalEmisor: z.string().length(4, 'Debe tener exactamente 4 caracteres'),
  numeroDocumentoFiscal: z.string().length(10, 'Debe tener exactamente 10 dígitos'),
  puntoFacturacionFiscal: z.string().length(3, 'Debe tener exactamente 3 dígitos')
    .refine(val => val !== '000', 'No puede ser "000"'),
  tipoDocumento: z.enum(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']),
  tipoEmision: z.enum(['01', '02', '03', '04']),
});

/** Schema para validar CUFE */
export const CUFESchema = z.string().length(66, 'CUFE debe tener exactamente 66 caracteres');

/** Schema para validar configuración HKA */
export const HKAConfigSchema = z.object({
  tokenEmpresa: z.string().min(1, 'Token de empresa es requerido'),
  tokenPassword: z.string().min(1, 'Token password es requerido'),
  environment: z.enum(['demo', 'prod']),
  branchCode: z.string().length(4, 'Código de sucursal debe tener 4 caracteres'),
  tipoSucursal: z.enum(['1', '2']).default('1'),
  puntoFacturacionFiscal: z.string().length(3)
    .refine(val => val !== '000', 'No puede ser "000"'),
  locationCode: z.string().min(5, 'Código de ubicación inválido'),
  provincia: z.string().min(1),
  distrito: z.string().min(1),
  corregimiento: z.string().min(1),
  tipoEmision: z.enum(['01', '02', '03', '04']).default('01'),
  destinoOperacion: z.enum(['1', '2']).default('1'),
  formatoCAFE: z.enum(['1', '2', '3']).default('1'),
  entregaCAFE: z.enum(['1', '2', '3']).default('1'),
  envioContenedor: z.enum(['1', '2']).default('1'),
  procesoGeneracion: z.literal('1').default('1'),
  contingenciaActiva: z.boolean().optional(),
  contingenciaInicio: z.string().optional(),
  contingenciaMotivo: z.string().optional(),
  contingenciaTipo: z.enum(['02', '04']).optional(),
  emisorRuc: z.string().optional(),
  emisorDv: z.string().optional(),
  emisorTipoContribuyente: z.enum(['1', '2']).optional(),
});

/** Schema para validar RUC (para consulta) */
export const ConsultarRucInputSchema = z.object({
  tipoRuc: z.enum(['1', '2']),
  ruc: z.string().min(1, 'RUC es requerido'),
});

/** Schema para anulación */
export const AnulacionInputSchema = z.object({
  datosDocumento: DatosDocumentoSchema,
  motivoAnulacion: z.string().min(15, 'El motivo debe tener al menos 15 caracteres')
    .max(250, 'El motivo no puede exceder 250 caracteres'),
});

/** Schema para envío de correo */
export const EnvioCorreoInputSchema = z.object({
  datosDocumento: DatosDocumentoSchema,
  correo: z.string().email('Correo electrónico inválido'),
});

/** Schema para rastreo de correo */
export const RastreoCorreoInputSchema = z.object({
  cufe: CUFESchema,
});

// ============================================
// CONSTANTES
// ============================================

/** URLs de los endpoints HKA */
export const HKA_ENDPOINTS = {
  demo: 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc',
  prod: 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc',
} as const;

/**
 * Namespaces SOAP requeridos por HKA
 * Según documentación oficial HKA 2026 (línea 37)
 * CRÍTICO: El namespace 'ser' DEBE ser exactamente Services.ObjComprobante
 */
export const HKA_NAMESPACES = {
  soapenv: 'http://schemas.xmlsoap.org/soap/envelope/',
  tem: 'http://tempuri.org/',
  ser: 'http://schemas.datacontract.org/2004/07/Services.ObjComprobante.v1_0', // ✅ CORREGIDO: v1_0 según ejemplo oficial Postman
} as const;

/** Códigos de respuesta HKA */
export const HKA_RESPONSE_CODES = {
  SUCCESS: '200',
  NO_DATA: '100',
  INVALID_TOKEN: '101',
  DOCUMENT_ERROR: '102',
  VALIDATION_ERROR: '109',
  PROCESSING_ERROR: '201',
  DGI_ERROR: '202',
  RESEND_REQUIRED: '300',
} as const;

/** Mapeo de códigos ITBMS a porcentajes */
export const ITBMS_RATES: Record<TasaITBMS, number> = {
  '00': 0,
  '01': 7,
  '02': 10,
  '03': 15,
} as const;

/** Descripciones de tipos de documento */
export const TIPO_DOCUMENTO_DESC: Record<TipoDocumento, string> = {
  '01': 'Factura de operación interna',
  '02': 'Factura de importación',
  '03': 'Factura de exportación',
  '04': 'Nota de Crédito referente a FE',
  '05': 'Nota de Débito referente a FE',
  '06': 'Nota de Crédito genérica',
  '07': 'Nota de Débito genérica',
  '08': 'Factura de Zona Franca',
  '09': 'Reembolso',
  '10': 'Factura de operación extranjera',
} as const;

/** Descripciones de formas de pago */
export const FORMA_PAGO_DESC: Record<FormaPago, string> = {
  '01': 'Crédito',
  '02': 'Efectivo',
  '03': 'Tarjeta Crédito',
  '04': 'Tarjeta Débito',
  '05': 'Tarjeta Fidelización',
  '06': 'Vale',
  '07': 'Tarjeta de Regalo',
  '08': 'Transferencia/Depósito',
  '09': 'Cheque',
  '99': 'Otro',
} as const;

