/**
 * HKA Error Handling System
 * Sistema de clasificación y manejo de errores HKA
 *
 * Clasifica errores en:
 * - Recuperables (reintentar automáticamente)
 * - Permanentes (no reintentar, requiere intervención)
 * - Críticos (errores de configuración o sistema)
 */

/**
 * Tipos de errores HKA clasificados por recuperabilidad
 */
export enum HKAErrorType {
  // ========================================
  // ERRORES RECUPERABLES (reintentar Enviar)
  // ========================================

  /** Timeout en la petición HTTP */
  TIMEOUT = 'TIMEOUT',

  /** Error de red o conectividad */
  NETWORK = 'NETWORK',

  /** Servicio HKA temporalmente no disponible */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  /** Rate limit excedido */
  RATE_LIMIT = 'RATE_LIMIT',

  /** HKA código 201: Error interno de HKA (recuperable, reintentar) */
  HKA_INTERNAL_ERROR = 'HKA_INTERNAL_ERROR',

  // ========================================
  // ERRORES NO RECUPERABLES (NO reintentar Enviar)
  // ========================================

  /**
   * HKA código 202: DGI Timeout / DGI Collapse
   * CRÍTICO: NUNCA reenviar con Enviar(). El documento ya está en cola de HKA.
   * Se debe usar EstadoDocumento() para polling hasta resolución.
   */
  DGI_TIMEOUT = 'DGI_TIMEOUT',

  /** Errores de validación de datos (código 109) */
  VALIDATION = 'VALIDATION',

  /** Credenciales HKA inválidas o expiradas (código 101) */
  AUTHENTICATION = 'AUTHENTICATION',

  /** Error de esquema XSD o datos del documento (código 102) */
  DOCUMENT_ERROR = 'DOCUMENT_ERROR',

  /** RUC inválido o no encontrado en DGI */
  INVALID_RUC = 'INVALID_RUC',

  /** No hay folios disponibles */
  NO_FOLIOS = 'NO_FOLIOS',

  /** Factura duplicada (ya existe en HKA) */
  DUPLICATE = 'DUPLICATE',

  /** Documento ya fue anulado previamente */
  ALREADY_CANCELLED = 'ALREADY_CANCELLED',

  /** Error de parseo XML */
  XML_PARSE_ERROR = 'XML_PARSE_ERROR',

  // ========================================
  // ERRORES CRÍTICOS
  // ========================================

  /** Error de configuración HKA */
  CONFIG_ERROR = 'CONFIG_ERROR',

  /** Error desconocido */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Clase de error personalizada para HKA
 * Extiende Error nativo con metadata adicional
 */
export class HKAError extends Error {
  /** Tipo de error clasificado */
  type: HKAErrorType;

  /** Código de respuesta HKA (si aplica) */
  code?: string;

  /** Indica si el error es recuperable (reintentar) */
  recoverable: boolean;

  /** Metadata adicional del error */
  metadata?: Record<string, unknown>;

  /** Timestamp del error */
  timestamp: Date;

  constructor(
    type: HKAErrorType,
    message: string,
    options?: {
      code?: string;
      recoverable?: boolean;
      metadata?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'HKAError';
    this.type = type;
    this.code = options?.code;
    this.recoverable = options?.recoverable ?? isRecoverable(type);
    this.metadata = options?.metadata;
    this.timestamp = new Date();

    // Preservar stack trace original si hay causa
    if (options?.cause) {
      this.stack = options.cause.stack;
    }
  }

  /**
   * Convierte el error técnico a un mensaje user-friendly en español
   */
  toUserMessage(): string {
    const messages: Record<HKAErrorType, string> = {
      // Recuperables
      [HKAErrorType.TIMEOUT]:
        'La operación excedió el tiempo límite. Por favor intente nuevamente.',

      [HKAErrorType.NETWORK]:
        'Error de conexión con el servicio HKA. Verifique su conexión a internet.',

      [HKAErrorType.SERVICE_UNAVAILABLE]:
        'El servicio HKA no está disponible temporalmente. Intentando nuevamente...',

      [HKAErrorType.RATE_LIMIT]:
        'Se ha excedido el límite de peticiones. Por favor espere un momento.',

      [HKAErrorType.HKA_INTERNAL_ERROR]:
        'Error interno del servicio HKA. Reintentando automáticamente...',

      // No recuperables (no reintentar Enviar)
      [HKAErrorType.DGI_TIMEOUT]:
        'La DGI no respondió a tiempo. Su factura está en cola y será procesada automáticamente. ' +
        'No intente emitirla nuevamente.',

      [HKAErrorType.VALIDATION]:
        `Datos inválidos: ${this.message}`,

      [HKAErrorType.AUTHENTICATION]:
        'Credenciales HKA inválidas o expiradas. Por favor verifique su configuración en Ajustes.',

      [HKAErrorType.DOCUMENT_ERROR]:
        `Error en el documento: ${this.message}. Verifique los datos e intente nuevamente.`,

      [HKAErrorType.INVALID_RUC]:
        `RUC inválido o no encontrado en la DGI: ${this.message}`,

      [HKAErrorType.NO_FOLIOS]:
        'No tiene folios disponibles. Por favor adquiera más folios para continuar facturando.',

      [HKAErrorType.DUPLICATE]:
        'Esta factura ya fue emitida anteriormente. No se puede duplicar.',

      [HKAErrorType.ALREADY_CANCELLED]:
        'Este documento ya fue anulado previamente.',

      [HKAErrorType.XML_PARSE_ERROR]:
        `Error al procesar la respuesta XML: ${this.message}`,

      // Críticos
      [HKAErrorType.CONFIG_ERROR]:
        `Error de configuración HKA: ${this.message}. Por favor contacte a soporte.`,

      [HKAErrorType.UNKNOWN]:
        `Error inesperado: ${this.message}. Si el problema persiste, contacte a soporte.`,
    };

    return messages[this.type] || this.message;
  }

  /**
   * Serializa el error a JSON para logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Determina si un tipo de error es recuperable
 */
function isRecoverable(type: HKAErrorType): boolean {
  const recoverableTypes = [
    HKAErrorType.TIMEOUT,
    HKAErrorType.NETWORK,
    HKAErrorType.SERVICE_UNAVAILABLE,
    HKAErrorType.RATE_LIMIT,
    HKAErrorType.HKA_INTERNAL_ERROR, // Código 201: reintentar con backoff
    // NOTA: DGI_TIMEOUT (202) NO es recuperable — no se debe reintentar Enviar()
  ];

  return recoverableTypes.includes(type);
}

/**
 * Parser inteligente de errores HKA
 * Analiza códigos y mensajes de respuesta para clasificar el error
 *
 * @param hkaCode - Código de respuesta HKA
 * @param message - Mensaje de error
 * @returns HKAError clasificado
 */
export function parseHKAError(hkaCode: string | undefined, message: string): HKAError {
  const code = hkaCode || '';
  const msg = message.toLowerCase();

  // ================================================
  // PASO 1: Despacho por código HKA (prioritario)
  // Los códigos HKA (100-300) tienen semántica fija
  // ================================================
  const codeInfo = HKA_ERROR_CODES[code];
  if (codeInfo) {
    return new HKAError(
      codeInfo.type,
      `${codeInfo.message}: ${message}`,
      { code, recoverable: codeInfo.recoverable }
    );
  }

  // ================================================
  // PASO 2: Fallback por patrón de mensaje
  // Para errores de transporte/red sin código HKA
  // ================================================

  // Timeout de transporte HTTP (no confundir con 202 DGI timeout)
  if (msg.includes('timeout') || msg.includes('tiempo límite') || msg.includes('timed out')) {
    return new HKAError(
      HKAErrorType.TIMEOUT,
      message,
      { code }
    );
  }

  // Network errors
  if (msg.includes('network') || msg.includes('conexión') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
    return new HKAError(
      HKAErrorType.NETWORK,
      message,
      { code }
    );
  }

  // Servicio no disponible (HTTP 503 de infraestructura, no de HKA)
  if (msg.includes('servicio no disponible') || msg.includes('service unavailable')) {
    return new HKAError(
      HKAErrorType.SERVICE_UNAVAILABLE,
      message,
      { code }
    );
  }

  // Autenticación genérica (sin código HKA)
  if (msg.includes('token') || msg.includes('autenticación') || msg.includes('credencial')) {
    return new HKAError(
      HKAErrorType.AUTHENTICATION,
      message,
      { code }
    );
  }

  // RUC inválido (sin código HKA)
  if (msg.includes('ruc') && (msg.includes('inválido') || msg.includes('no encontrado') || msg.includes('no existe'))) {
    return new HKAError(
      HKAErrorType.INVALID_RUC,
      message,
      { code }
    );
  }

  // Folios
  if (msg.includes('folio') || msg.includes('no tiene folios') || msg.includes('folios agotados')) {
    return new HKAError(
      HKAErrorType.NO_FOLIOS,
      message,
      { code }
    );
  }

  // Duplicado
  if (msg.includes('duplicado') || msg.includes('ya existe') || msg.includes('duplicate')) {
    return new HKAError(
      HKAErrorType.DUPLICATE,
      message,
      { code }
    );
  }

  // Ya anulado
  if (msg.includes('ya fue anulado') || msg.includes('already cancelled')) {
    return new HKAError(
      HKAErrorType.ALREADY_CANCELLED,
      message,
      { code }
    );
  }

  // XML parse errors
  if (msg.includes('xml') && (msg.includes('parse') || msg.includes('parseo') || msg.includes('malformado'))) {
    return new HKAError(
      HKAErrorType.XML_PARSE_ERROR,
      message,
      { code }
    );
  }

  // Validación genérica por mensaje
  if (msg.includes('validación') || msg.includes('validation') || msg.includes('inválido')) {
    return new HKAError(
      HKAErrorType.VALIDATION,
      message,
      { code }
    );
  }

  // Configuración
  if (msg.includes('configuración') || msg.includes('config')) {
    return new HKAError(
      HKAErrorType.CONFIG_ERROR,
      message,
      { code }
    );
  }

  // Unknown por defecto
  return new HKAError(
    HKAErrorType.UNKNOWN,
    message,
    { code }
  );
}

/**
 * Mapeo de códigos de error HKA conocidos
 * Basado en documentación de The Factory HKA
 */
/**
 * Mapeo de códigos de error HKA oficiales (WS Directo)
 * Basado en documentación The Factory HKA 2026
 *
 * Códigos HKA (NO son HTTP):
 * - 100: Sin datos / No encontrado
 * - 101: Token inválido
 * - 102: Error XSD / Error de documento
 * - 109: Error de validación de campos
 * - 200: Éxito (NO se incluye aquí, se maneja como success)
 * - 201: Error interno HKA (recuperable)
 * - 202: DGI Timeout / Colapso (NO reintentar Enviar)
 * - 300: Reenvío requerido
 */
export const HKA_ERROR_CODES: Record<string, {
  type: HKAErrorType;
  message: string;
  recoverable: boolean;
}> = {
  // Sin datos
  '100': {
    type: HKAErrorType.VALIDATION,
    message: 'No se encontraron datos para la consulta',
    recoverable: false,
  },

  // Token inválido
  '101': {
    type: HKAErrorType.AUTHENTICATION,
    message: 'Token de empresa inválido o expirado',
    recoverable: false,
  },

  // Error de esquema XSD o error en datos del documento
  '102': {
    type: HKAErrorType.DOCUMENT_ERROR,
    message: 'Error de esquema XSD o datos del documento inválidos',
    recoverable: false,
  },

  // Error de validación de campos
  '109': {
    type: HKAErrorType.VALIDATION,
    message: 'Error de validación en los campos del documento',
    recoverable: false,
  },

  // Error interno HKA (RECUPERABLE — reintentar con backoff)
  '201': {
    type: HKAErrorType.HKA_INTERNAL_ERROR,
    message: 'Error interno del servicio HKA',
    recoverable: true,
  },

  // DGI Timeout / Colapso (NO RECUPERABLE — usar EstadoDocumento para polling)
  '202': {
    type: HKAErrorType.DGI_TIMEOUT,
    message: 'La DGI no respondió a tiempo. El documento está en cola de procesamiento',
    recoverable: false, // CRÍTICO: NO reintentar Enviar()
  },

  // Reenvío requerido
  '300': {
    type: HKAErrorType.SERVICE_UNAVAILABLE,
    message: 'HKA solicita reenvío del documento',
    recoverable: true,
  },
};

/**
 * Obtiene información de un código de error HKA
 */
export function getHKAErrorInfo(code: string): { type: HKAErrorType; message: string } | undefined {
  return HKA_ERROR_CODES[code];
}

/**
 * Crea un HKAError desde un código conocido
 */
export function createHKAErrorFromCode(code: string, additionalMessage?: string): HKAError {
  const info = getHKAErrorInfo(code);

  if (info) {
    const message = additionalMessage ? `${info.message}: ${additionalMessage}` : info.message;
    return new HKAError(info.type, message, { code });
  }

  return new HKAError(
    HKAErrorType.UNKNOWN,
    additionalMessage || 'Error desconocido',
    { code }
  );
}
