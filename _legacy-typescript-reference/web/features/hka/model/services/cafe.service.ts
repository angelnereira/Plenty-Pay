/**
 * CAFE Service - Comprobante Auxiliar de Factura Electrónica
 *
 * Genera los datos necesarios para emitir un CAFE (Comprobante Auxiliar de
 * Factura Electrónica) durante operaciones en contingencia (modo offline).
 *
 * Responsabilidades:
 *   1. Construir el contenido del código QR con el CUFE local
 *   2. Generar el texto legal de contingencia requerido por la DGI
 *   3. Calcular la fecha límite de transmisión (72 horas)
 *   4. Preparar los datos de cabecera para la impresión del CAFE
 *
 * Al recuperar la conexión, las facturas en contingencia deben transmitirse
 * dentro de las 72 horas siguientes a la fecha de emisión usando el mismo
 * número de documento fiscal asignado localmente.
 *
 * Referencias:
 *   - DGI Panamá - Resolución CAFE en contingencia
 *   - Artículo sobre tipoEmision '02' y '04'
 */

import type { TipoDocumento, TipoEmision } from '../types/types';

// ============================================
// TIPOS
// ============================================

/** Datos del emisor para el CAFE */
export interface CAFEEmisor {
  /** Nombre o razón social */
  nombre: string;
  /** RUC del emisor */
  ruc: string;
  /** Dígito verificador */
  dv: string;
  /** Dirección del establecimiento */
  direccion?: string;
  /** Teléfono de contacto */
  telefono?: string;
}

/** Datos del receptor para el CAFE */
export interface CAFEReceptor {
  /** Nombre o razón social del receptor */
  nombre: string;
  /** RUC del receptor (si aplica) */
  ruc?: string;
  /** DV del RUC del receptor */
  dv?: string;
}

/** Datos de entrada para generar el CAFE */
export interface CAFEInput {
  // --- Identificación del documento ---
  /** CUFE de 64 caracteres generado localmente */
  cufe: string;
  /** Tipo de documento: '01'=Factura, '04'=NC, etc. */
  tipoDocumento: TipoDocumento;
  /** Número secuencial del documento (10 dígitos) */
  numeroDocumentoFiscal: string;
  /** Código de sucursal (4 chars) */
  codigoSucursal: string;
  /** Punto de facturación (3 chars) */
  puntoFacturacion: string;

  // --- Contingencia ---
  /**
   * Tipo de emisión en contingencia:
   *   '02' = Autorización previa (falla de internet del contribuyente)
   *   '04' = Autorización posterior (falla de la DGI)
   */
  tipoEmision: '02' | '04';
  /** Fecha y hora en que inició la contingencia */
  fechaInicioContingencia: Date;
  /** Motivo de la contingencia (15–250 caracteres) */
  motivoContingencia: string;

  // --- Documento ---
  /** Fecha y hora de emisión del documento */
  fechaEmision: Date;
  /** Moneda (ej: "PAB", "USD") */
  moneda: string;
  /** Total de la factura */
  totalFactura: number;
  /** ITBMS total */
  totalITBMS: number;

  // --- Partes ---
  /** Datos del emisor */
  emisor: CAFEEmisor;
  /** Datos del receptor */
  receptor: CAFEReceptor;

  // --- Configuración ---
  /**
   * Ambiente:
   *   '1' = Producción
   *   '2' = Pruebas / Demo
   */
  ambiente: '1' | '2';
  /**
   * URL base del portal de verificación DGI.
   * Default: 'https://efact.mef.gob.pa/receiverfe/servlet/qr'
   */
  urlVerificacionDGI?: string;
}

/** Resultado de la generación del CAFE */
export interface CAFEResult {
  /** Contenido del código QR para imprimir */
  qrContent: string;
  /** Texto legal de contingencia para imprimir en el documento */
  textoContingencia: string;
  /** Fecha límite para transmitir a la DGI (72 horas desde emisión) */
  fechaLimiteTransmision: Date;
  /** Fecha límite formateada para impresión (DD/MM/YYYY HH:mm) */
  fechaLimiteTexto: string;
  /** Datos de cabecera para el layout del CAFE */
  cabecera: CAFECabecera;
  /** Indica si el plazo de 72 horas ya fue excedido */
  plazoExcedido: boolean;
  /** Horas restantes para transmitir (negativo si ya excedió) */
  horasRestantes: number;
}

/** Datos de cabecera del CAFE para el layout de impresión */
export interface CAFECabecera {
  tituloDocumento: string;
  subtituloContingencia: string;
  emisorNombre: string;
  emisorRucDv: string;
  emisorDireccion?: string;
  emisorTelefono?: string;
  receptorNombre: string;
  receptorRucDv?: string;
  numeroDocumento: string;
  fechaEmisionTexto: string;
  moneda: string;
  totalTexto: string;
  itbmsTexto: string;
  cufe: string;
  ambiente: 'PRODUCCIÓN' | 'PRUEBAS';
}

// ============================================
// CONSTANTES
// ============================================

/** Horas máximas para transmitir facturas en contingencia */
const HORAS_LIMITE_TRANSMISION = 72;

/** URL base del portal de verificación DGI por defecto */
const URL_VERIFICACION_DGI_DEFAULT =
  'https://efact.mef.gob.pa/receiverfe/servlet/qr';

/** Descripciones de tipo de documento para impresión */
const TITULO_DOCUMENTO: Record<TipoDocumento, string> = {
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

/** Descripción del tipo de contingencia para el texto legal */
const DESCRIPCION_CONTINGENCIA: Record<'02' | '04', string> = {
  '02': 'por falla en la conexión a internet del contribuyente',
  '04': 'por fallas en el sistema de la DGI',
};

// ============================================
// HELPERS INTERNOS
// ============================================

/**
 * Formatea una fecha como DD/MM/YYYY HH:mm
 */
function formatearFechaLarga(fecha: Date): string {
  const dd = fecha.getDate().toString().padStart(2, '0');
  const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = fecha.getFullYear();
  const hh = fecha.getHours().toString().padStart(2, '0');
  const min = fecha.getMinutes().toString().padStart(2, '0');
  const ss = fecha.getSeconds().toString().padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

/**
 * Formatea un número como moneda (ej: 1234.5 → "B/. 1,234.50")
 */
function formatearMonto(monto: number, moneda: string): string {
  const simbolo = moneda === 'PAB' || moneda === 'USD' ? 'B/.' : moneda;
  return `${simbolo} ${monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Calcula la fecha límite de transmisión sumando N horas a la fecha de emisión.
 */
function calcularFechaLimite(fechaEmision: Date, horas: number): Date {
  return new Date(fechaEmision.getTime() + horas * 60 * 60 * 1000);
}

/**
 * Construye el contenido del QR para el CAFE en contingencia.
 *
 * El QR incluye el CUFE como identificador primario y los datos clave
 * del documento para verificación posterior en el portal DGI.
 *
 * Formato: URL de verificación con parámetros CUFE + datos del emisor
 */
function construirQRContent(input: CAFEInput): string {
  const urlBase = input.urlVerificacionDGI ?? URL_VERIFICACION_DGI_DEFAULT;

  // Parámetros del QR según estructura DGI para documentos en contingencia
  const params = new URLSearchParams({
    chFE: `FE${input.cufe}`,
    ruc: input.emisor.ruc,
    dv: input.emisor.dv,
    fe: formatearFechaISO(input.fechaEmision),
    tipo: input.tipoDocumento,
    num: input.numeroDocumentoFiscal,
    suc: input.codigoSucursal,
    pf: input.puntoFacturacion,
    te: input.tipoEmision,
    amb: input.ambiente,
  });

  return `${urlBase}?${params.toString()}`;
}

/**
 * Formatea una fecha en formato ISO 8601 compacto (YYYYMMDDTHHMMSS)
 * para incluir en el QR sin caracteres especiales problemáticos.
 */
function formatearFechaISO(fecha: Date): string {
  const yyyy = fecha.getFullYear();
  const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const dd = fecha.getDate().toString().padStart(2, '0');
  const hh = fecha.getHours().toString().padStart(2, '0');
  const min = fecha.getMinutes().toString().padStart(2, '0');
  const ss = fecha.getSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
}

/**
 * Construye el texto legal de contingencia requerido por la DGI
 * para imprimir en el CAFE entregado al cliente.
 */
function construirTextoContingencia(
  _tipoEmision: '02' | '04',
  fechaLimite: Date
): string {
  const fechaLimiteStr = formatearFechaLarga(fechaLimite);
  return (
    `CAFE emitido durante operación en contingencia, ` +
    `transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta ${fechaLimiteStr}`
  );
}

/**
 * Construye el número de documento formateado para impresión.
 * Formato: SUCURSAL-PUNTO-NUMERO (ej: "0001-001-0000000001")
 */
function formatearNumeroDocumento(
  codigoSucursal: string,
  puntoFacturacion: string,
  numeroDocumentoFiscal: string
): string {
  return `${codigoSucursal}-${puntoFacturacion}-${numeroDocumentoFiscal}`;
}

// ============================================
// API PÚBLICA
// ============================================

/**
 * Genera todos los datos necesarios para emitir un CAFE en contingencia.
 *
 * Retorna el contenido del QR, el texto legal, la fecha límite de
 * transmisión y los datos de cabecera para el layout de impresión.
 *
 * @example
 * ```typescript
 * const cafe = generarCAFE({
 *   cufe: '01211234567890000000000-280001202604020000000001001021123456789X',
 *   tipoDocumento: '01',
 *   numeroDocumentoFiscal: '0000000001',
 *   codigoSucursal: '0001',
 *   puntoFacturacion: '001',
 *   tipoEmision: '02',
 *   fechaInicioContingencia: new Date('2026-04-02T10:00:00'),
 *   motivoContingencia: 'Falla en el servicio de internet del proveedor ISP.',
 *   fechaEmision: new Date('2026-04-02T10:30:00'),
 *   moneda: 'PAB',
 *   totalFactura: 107.00,
 *   totalITBMS: 7.00,
 *   emisor: { nombre: 'EMPRESA S.A.', ruc: '1234567-1-123456', dv: '28' },
 *   receptor: { nombre: 'JUAN PÉREZ', ruc: '8-123-456', dv: '7' },
 *   ambiente: '1',
 * });
 *
 * // cafe.qrContent → string para generar el código QR
 * // cafe.textoContingencia → texto para imprimir en el documento
 * // cafe.fechaLimiteTexto → "04/04/2026 10:30" (72h después)
 * ```
 */
export function generarCAFE(input: CAFEInput): CAFEResult {
  validarInputCAFE(input);

  // 1. Calcular fecha límite de transmisión (72 horas desde emisión)
  const fechaLimiteTransmision = calcularFechaLimite(
    input.fechaEmision,
    HORAS_LIMITE_TRANSMISION
  );
  const fechaLimiteTexto = formatearFechaLarga(fechaLimiteTransmision);

  // 2. Determinar si el plazo ya fue excedido
  const ahora = new Date();
  const msRestantes = fechaLimiteTransmision.getTime() - ahora.getTime();
  const horasRestantes = msRestantes / (1000 * 60 * 60);
  const plazoExcedido = horasRestantes < 0;

  // 3. Construir contenido del QR
  const qrContent = construirQRContent(input);

  // 4. Construir texto legal de contingencia
  const textoContingencia = construirTextoContingencia(
    input.tipoEmision,
    fechaLimiteTransmision
  );

  // 5. Construir datos de cabecera para el layout de impresión
  const cabecera: CAFECabecera = {
    tituloDocumento: TITULO_DOCUMENTO[input.tipoDocumento],
    subtituloContingencia: 'COMPROBANTE AUXILIAR DE FACTURA ELECTRÓNICA (CAFE)',
    emisorNombre: input.emisor.nombre.toUpperCase(),
    emisorRucDv: `RUC: ${input.emisor.ruc} DV: ${input.emisor.dv}`,
    emisorDireccion: input.emisor.direccion,
    emisorTelefono: input.emisor.telefono,
    receptorNombre: input.receptor.nombre.toUpperCase(),
    receptorRucDv:
      input.receptor.ruc && input.receptor.dv
        ? `RUC: ${input.receptor.ruc} DV: ${input.receptor.dv}`
        : undefined,
    numeroDocumento: formatearNumeroDocumento(
      input.codigoSucursal,
      input.puntoFacturacion,
      input.numeroDocumentoFiscal
    ),
    fechaEmisionTexto: formatearFechaLarga(input.fechaEmision),
    moneda: input.moneda,
    totalTexto: formatearMonto(input.totalFactura, input.moneda),
    itbmsTexto: formatearMonto(input.totalITBMS, input.moneda),
    cufe: input.cufe,
    ambiente: input.ambiente === '1' ? 'PRODUCCIÓN' : 'PRUEBAS',
  };

  return {
    qrContent,
    textoContingencia,
    fechaLimiteTransmision,
    fechaLimiteTexto,
    cabecera,
    plazoExcedido,
    horasRestantes: Math.round(horasRestantes * 10) / 10,
  };
}

/**
 * Verifica si una factura en contingencia aún puede transmitirse a la DGI.
 *
 * @param fechaEmision - Fecha de emisión original de la factura
 * @returns Objeto con el estado del plazo de transmisión
 */
export function verificarPlazoTransmision(fechaEmision: Date): {
  puedeTransmitir: boolean;
  horasRestantes: number;
  fechaLimite: Date;
  fechaLimiteTexto: string;
  requiereJustificacion: boolean;
} {
  const fechaLimite = calcularFechaLimite(fechaEmision, HORAS_LIMITE_TRANSMISION);
  const ahora = new Date();
  const msRestantes = fechaLimite.getTime() - ahora.getTime();
  const horasRestantes = msRestantes / (1000 * 60 * 60);

  return {
    puedeTransmitir: horasRestantes > 0,
    horasRestantes: Math.round(horasRestantes * 10) / 10,
    fechaLimite,
    fechaLimiteTexto: formatearFechaLarga(fechaLimite),
    // Si excedió las 72h, requiere justificación dentro del XML (dMotCont)
    requiereJustificacion: horasRestantes < 0,
  };
}

/**
 * Construye el motivo de contingencia para incluir en el XML de transmisión.
 *
 * Cuando se transmite después del plazo de 72 horas, la DGI exige que
 * la justificación del retraso se incluya en el campo dMotCont del XML.
 *
 * @param motivoOriginal - Motivo de la contingencia (15–250 chars)
 * @param fechaEmision - Fecha de emisión del documento
 * @param justificacionRetraso - Justificación si se excedieron las 72 horas (opcional)
 */
export function construirMotivoContingenciaXML(
  motivoOriginal: string,
  fechaEmision: Date,
  justificacionRetraso?: string
): string {
  const plazo = verificarPlazoTransmision(fechaEmision);

  let motivo = motivoOriginal.trim();

  if (plazo.requiereJustificacion && justificacionRetraso) {
    const justif = justificacionRetraso.trim();
    const separador = '. Justificación del retraso en transmisión: ';
    const candidato = `${motivo}${separador}${justif}`;

    // El campo dMotCont tiene límite de 250 caracteres según DGI
    motivo = candidato.slice(0, 250);
  }

  // Asegurar longitud mínima de 15 caracteres requerida por DGI
  if (motivo.length < 15) {
    motivo = motivo.padEnd(15, ' ');
  }

  return motivo;
}

// ============================================
// VALIDACIÓN DE INPUT
// ============================================

function validarInputCAFE(input: CAFEInput): void {
  const errores: string[] = [];

  if (!input.cufe || input.cufe.length !== 64) {
    errores.push('cufe debe tener exactamente 64 caracteres');
  }

  if (!input.tipoDocumento) errores.push('tipoDocumento es requerido');
  if (!input.numeroDocumentoFiscal) errores.push('numeroDocumentoFiscal es requerido');
  if (!input.codigoSucursal) errores.push('codigoSucursal es requerido');
  if (!input.puntoFacturacion || input.puntoFacturacion === '000') {
    errores.push('puntoFacturacion es requerido y no puede ser "000"');
  }

  if (!['02', '04'].includes(input.tipoEmision)) {
    errores.push('tipoEmision debe ser "02" o "04" para CAFE en contingencia');
  }

  if (!input.fechaInicioContingencia || !(input.fechaInicioContingencia instanceof Date)) {
    errores.push('fechaInicioContingencia debe ser un Date válido');
  }

  if (!input.motivoContingencia || input.motivoContingencia.length < 15) {
    errores.push('motivoContingencia debe tener al menos 15 caracteres');
  }

  if (input.motivoContingencia && input.motivoContingencia.length > 250) {
    errores.push('motivoContingencia no puede exceder 250 caracteres');
  }

  if (!input.fechaEmision || !(input.fechaEmision instanceof Date)) {
    errores.push('fechaEmision debe ser un Date válido');
  }

  if (!input.emisor?.nombre) errores.push('emisor.nombre es requerido');
  if (!input.emisor?.ruc) errores.push('emisor.ruc es requerido');
  if (!input.emisor?.dv) errores.push('emisor.dv es requerido');
  if (!input.receptor?.nombre) errores.push('receptor.nombre es requerido');

  if (!['1', '2'].includes(input.ambiente)) {
    errores.push('ambiente debe ser "1" (producción) o "2" (pruebas)');
  }

  if (errores.length > 0) {
    throw new Error(`[CAFEService] Input inválido:\n  - ${errores.join('\n  - ')}`);
  }
}
