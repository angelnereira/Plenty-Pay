/**
 * CUFE Service - Generación local de Código Único de Factura Electrónica
 *
 * Genera el CUFE de 64 caracteres localmente según especificaciones DGI Panamá,
 * para uso en modo offline/contingencia cuando no hay conexión con HKA o la DGI.
 *
 * Estructura del CUFE (64 posiciones):
 *   - Cadena base (63 chars): tipoDoc + tipoContrib + ruc(20) + dv(3) +
 *                              sucursal(4) + fecha(8) + numDoc(10) +
 *                              punto(3) + tipoEmision(2) + ambiente(1) + secuencia(9)
 *   - Dígito verificador (1 char): Módulo 10 (Luhn)
 *
 * Referencias:
 *   - DGI Panamá - Especificación CUFE para contingencia
 *   - Algoritmo Luhn / Módulo 10
 */

import type { TipoDocumento, TipoContribuyente, TipoEmision } from '../types/types';

// ============================================
// TIPOS
// ============================================

/** Datos necesarios para generar un CUFE local */
export interface CUFEInput {
  /** Tipo de documento fiscal: '01'=Factura, '04'=NC, '05'=ND, etc. */
  tipoDocumento: TipoDocumento;
  /** Tipo de contribuyente del EMISOR: '1'=Natural, '2'=Jurídico */
  tipoContribuyente: TipoContribuyente;
  /** RUC del emisor (puede contener letras, ej: "PE1-NT-1234567-8") */
  rucEmisor: string;
  /** Dígito verificador del RUC (solo dígitos, sin guion, ej: "28") */
  digitoVerificadorRuc: string;
  /** Código de sucursal AN|4 (ej: "0001") */
  codigoSucursal: string;
  /** Fecha de emisión del documento */
  fechaEmision: Date;
  /** Número secuencial del documento fiscal (se normaliza a 10 dígitos) */
  numeroDocumentoFiscal: string;
  /** Punto de facturación N|3 (ej: "001") */
  puntoFacturacion: string;
  /**
   * Tipo de emisión:
   *   '01' = Normal (online)
   *   '02' = Contingencia por falla de internet del contribuyente
   *   '03' = Diferida (autorización posterior)
   *   '04' = Contingencia por fallas de la DGI
   */
  tipoEmision: TipoEmision;
  /**
   * Ambiente de destino:
   *   '1' = Producción
   *   '2' = Pruebas / Demo
   */
  ambiente: '1' | '2';
  /**
   * Secuencia de seguridad de 9 dígitos (opcional).
   * Si no se provee, se genera aleatoriamente entre 000000001 y 999999999.
   * Útil para retransmisión (reusar la secuencia original).
   */
  secuenciaSeguridad?: string;
}

/** Resultado de la generación del CUFE */
export interface CUFEResult {
  /** CUFE completo de 64 caracteres */
  cufe: string;
  /** Cadena base de 63 caracteres (antes de agregar el DV) — para auditoría */
  cadenaBase: string;
  /** Cadena numérica procesada (sin guiones, letras convertidas) — para auditoría */
  cadenaNumerica: string;
  /** Secuencia de seguridad de 9 dígitos usada */
  secuenciaSeguridad: string;
  /** Dígito verificador calculado (posición 64) */
  digitoVerificador: string;
}

// ============================================
// HELPERS INTERNOS
// ============================================

/**
 * Formatea una fecha como AAAAMMDD (8 caracteres)
 */
function formatearFechaYYYYMMDD(fecha: Date): string {
  const yyyy = fecha.getFullYear().toString();
  const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const dd = fecha.getDate().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Genera una secuencia de seguridad aleatoria de 9 dígitos.
 *
 * Restricciones DGI:
 *   - Rango: 000000001 a 999999999 (nunca solo ceros)
 *   - No puede ser igual al número de documento fiscal
 */
function generarSecuenciaSeguridad(numeroDocumento: string): string {
  // Normalizar el número de documento a 9 dígitos para la comparación
  const numDocNormalizado = numeroDocumento
    .replace(/\D/g, '')
    .padStart(9, '0')
    .slice(0, 9);

  let secuencia: string;
  let intentos = 0;

  do {
    // Generar número entre 1 y 999999999
    const num = Math.floor(Math.random() * 999_999_999) + 1;
    secuencia = num.toString().padStart(9, '0');
    intentos++;

    // Salvaguarda contra bucle infinito (prácticamente imposible)
    if (intentos > 100) break;
  } while (secuencia === numDocNormalizado || secuencia === '000000000');

  return secuencia;
}

/**
 * Construye la cadena base de 63 caracteres del CUFE.
 *
 * Composición:
 *   [tipoDoc(2)][tipoContrib(1)][ruc(20)][dv(3)][sucursal(4)][fecha(8)]
 *   [numDoc(10)][punto(3)][tipoEmision(2)][ambiente(1)][secuencia(9)]
 *   = 63 caracteres en total
 */
function construirCadenaBase(input: CUFEInput, secuencia: string): string {
  // 1. Tipo de Documento (2 chars) — ya viene como '01', '04', etc.
  const tipoDoc = input.tipoDocumento.padStart(2, '0');

  // 2. Tipo Contribuyente (1 char)
  const tipoContrib = input.tipoContribuyente;

  // 3. RUC del emisor (20 chars, relleno con ceros a la izquierda)
  const ruc = input.rucEmisor.padStart(20, '0');

  // 4. DV del RUC (3 chars: guion + 2 dígitos, ej: "-28")
  const dvRuc = '-' + input.digitoVerificadorRuc.padStart(2, '0');

  // 5. Código de sucursal (4 chars)
  const sucursal = input.codigoSucursal.padStart(4, '0').slice(0, 4);

  // 6. Fecha de emisión (8 chars: AAAAMMDD)
  const fecha = formatearFechaYYYYMMDD(input.fechaEmision);

  // 7. Número de factura (10 chars, solo dígitos, relleno a la izquierda)
  const numDoc = input.numeroDocumentoFiscal
    .replace(/\D/g, '')
    .padStart(10, '0')
    .slice(0, 10);

  // 8. Punto de facturación (3 chars)
  const punto = input.puntoFacturacion.padStart(3, '0').slice(0, 3);

  // 9. Tipo de emisión (2 chars)
  const tipoEmision = input.tipoEmision;

  // 10. Ambiente (1 char)
  const ambiente = input.ambiente;

  // 11. Secuencia de seguridad (9 chars)
  const seg = secuencia.padStart(9, '0').slice(0, 9);

  const cadena = `${tipoDoc}${tipoContrib}${ruc}${dvRuc}${sucursal}${fecha}${numDoc}${punto}${tipoEmision}${ambiente}${seg}`;

  // Validar longitud (debe ser exactamente 63)
  if (cadena.length !== 63) {
    throw new Error(
      `[CUFEService] Cadena base inválida: longitud ${cadena.length} ≠ 63. ` +
      `Cadena: "${cadena}"`
    );
  }

  return cadena;
}

/**
 * Convierte la cadena base a su representación numérica para el algoritmo Luhn.
 *
 * Reglas según spec DGI Panamá (Fase 2):
 *   1. Guiones ('-') → se ELIMINAN (omitir, no aportan carácter al cálculo)
 *   2. Letras        → código ASCII de 2 dígitos → conservar solo el ÚLTIMO dígito (ASCII % 10)
 *      Ej: 'P' = ASCII 80 → '0', 'E' = ASCII 69 → '9', 'A' = ASCII 65 → '5'
 *   3. Dígitos (0-9) → se mantienen tal cual
 */
function normalizarParaLuhn(cadena: string): string {
  let resultado = '';

  for (const char of cadena) {
    if (char >= '0' && char <= '9') {
      resultado += char;
    } else if (char === '-') {
      // Guiones se eliminan per spec DGI — no agregar nada
    } else {
      // Letras y otros: último dígito del código ASCII
      const ascii = char.charCodeAt(0);
      resultado += (ascii % 10).toString();
    }
  }

  return resultado;
}

/**
 * Calcula el dígito verificador usando Módulo 10 (variante Luhn DGI).
 *
 * Proceso (de derecha a izquierda):
 *   1. Posición 1 (más a la derecha) × 2
 *   2. Posición 2 × 1
 *   3. Posición 3 × 2
 *   4. ... alternando 2 y 1
 *   5. Si el producto ≥ 10: sumar sus dígitos (ej: 16 → 1+6 = 7)
 *   6. Sumar todos los resultados → S
 *   7. residuo = S % 10
 *   8. DV = (residuo === 0) ? 0 : (10 - residuo)
 */
function calcularDigitoVerificador(cadenaNumerica: string): string {
  let suma = 0;
  const len = cadenaNumerica.length;

  for (let i = 0; i < len; i++) {
    // Iterar desde la derecha (i=0 es el dígito más a la derecha)
    const indice = len - 1 - i;
    const digito = parseInt(cadenaNumerica[indice], 10);

    // Alternar: posición derecha (i=0) × 2, siguiente × 1, etc.
    const multiplicador = i % 2 === 0 ? 2 : 1;
    let producto = digito * multiplicador;

    // Si el producto tiene dos dígitos, sumar sus dígitos
    if (producto >= 10) {
      producto = Math.floor(producto / 10) + (producto % 10);
    }

    suma += producto;
  }

  const residuo = suma % 10;
  const dv = residuo === 0 ? 0 : 10 - residuo;
  return dv.toString();
}

// ============================================
// API PÚBLICA
// ============================================

/**
 * Genera un CUFE de 64 caracteres localmente siguiendo la especificación DGI.
 *
 * Uso en modo contingencia (offline):
 *   - tipoEmision debe ser '02' (contingencia internet) o '04' (contingencia DGI)
 *
 * Uso normal (cuando HKA no está disponible temporalmente):
 *   - tipoEmision '01' también es válido para generar el CUFE localmente
 *
 * @example
 * ```typescript
 * const result = generarCUFELocal({
 *   tipoDocumento: '01',
 *   tipoContribuyente: '2',
 *   rucEmisor: 'PE10-1234-56789',
 *   digitoVerificadorRuc: '28',
 *   codigoSucursal: '0001',
 *   fechaEmision: new Date('2026-04-02'),
 *   numeroDocumentoFiscal: '0000000001',
 *   puntoFacturacion: '001',
 *   tipoEmision: '02',
 *   ambiente: '1',
 * });
 * // result.cufe → string de 64 caracteres
 * ```
 */
export function generarCUFELocal(input: CUFEInput): CUFEResult {
  // 1. Validar campos mínimos requeridos
  validarInputCUFE(input);

  // 2. Generar (o reusar) secuencia de seguridad
  const secuencia = input.secuenciaSeguridad
    ? input.secuenciaSeguridad.padStart(9, '0').slice(0, 9)
    : generarSecuenciaSeguridad(input.numeroDocumentoFiscal);

  // 3. Construir cadena base de 63 caracteres
  const cadenaBase = construirCadenaBase(input, secuencia);

  // 4. Convertir a cadena numérica (omitir guiones, convertir letras)
  const cadenaNumerica = normalizarParaLuhn(cadenaBase);

  // 5. Calcular dígito verificador (Luhn Mod10)
  const digitoVerificador = calcularDigitoVerificador(cadenaNumerica);

  // 6. Componer el CUFE final (63 + 1 = 64 caracteres)
  const cufe = cadenaBase + digitoVerificador;

  return {
    cufe,
    cadenaBase,
    cadenaNumerica,
    secuenciaSeguridad: secuencia,
    digitoVerificador,
  };
}

/**
 * Valida un CUFE de 64 caracteres recalculando su dígito verificador.
 *
 * @returns true si el CUFE es válido, false en caso contrario
 */
export function validarCUFE(cufe: string): boolean {
  if (!cufe || cufe.length !== 64) return false;

  const cadenaBase = cufe.slice(0, 63);
  const dvEsperado = cufe[63];

  const cadenaNumerica = normalizarParaLuhn(cadenaBase);
  const dvCalculado = calcularDigitoVerificador(cadenaNumerica);

  return dvCalculado === dvEsperado;
}

/**
 * Convierte una letra a su representación numérica (último dígito ASCII).
 * Guiones ('-') se eliminan en normalizarParaLuhn — esta función no los recibe.
 * Exportada para testing y diagnóstico.
 *
 * @example letraADigito('P') → '0'  (P=80 → 0)
 * @example letraADigito('E') → '9'  (E=69 → 9)
 * @example letraADigito('A') → '5'  (A=65 → 5)
 */
export function letraADigito(letra: string): string {
  const ascii = letra.charCodeAt(0);
  return (ascii % 10).toString();
}

// ============================================
// VALIDACIÓN DE INPUT
// ============================================

function validarInputCUFE(input: CUFEInput): void {
  const errores: string[] = [];

  if (!input.tipoDocumento) errores.push('tipoDocumento es requerido');
  if (!input.tipoContribuyente) errores.push('tipoContribuyente es requerido');
  if (!input.rucEmisor) errores.push('rucEmisor es requerido');
  if (!input.digitoVerificadorRuc) errores.push('digitoVerificadorRuc es requerido');

  if (!input.codigoSucursal || input.codigoSucursal.length > 4) {
    errores.push('codigoSucursal debe tener máximo 4 caracteres');
  }

  if (!input.fechaEmision || !(input.fechaEmision instanceof Date)) {
    errores.push('fechaEmision debe ser un objeto Date válido');
  }

  if (!input.numeroDocumentoFiscal) {
    errores.push('numeroDocumentoFiscal es requerido');
  }

  if (!input.puntoFacturacion || input.puntoFacturacion.trim() === '') {
    errores.push('puntoFacturacion es requerido');
  }

  if (!['01', '02', '03', '04'].includes(input.tipoEmision)) {
    errores.push('tipoEmision debe ser "01", "02", "03" o "04"');
  }

  if (!['1', '2'].includes(input.ambiente)) {
    errores.push('ambiente debe ser "1" (producción) o "2" (pruebas)');
  }

  if (input.secuenciaSeguridad) {
    const sec = input.secuenciaSeguridad;
    if (!/^\d{1,9}$/.test(sec)) {
      errores.push('secuenciaSeguridad debe contener solo dígitos (máx 9)');
    }
  }

  if (errores.length > 0) {
    throw new Error(`[CUFEService] Input inválido:\n  - ${errores.join('\n  - ')}`);
  }
}
