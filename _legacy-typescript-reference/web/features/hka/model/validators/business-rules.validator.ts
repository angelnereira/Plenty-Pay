/**
 * HKA Business Rules Validator
 *
 * Validaciones de reglas de negocio específicas de HKA
 * según documentación oficial HKA 2026
 *
 * Reglas implementadas:
 * - Plazo máximo de anulación: 7 días desde emisión
 * - Plazo máximo de NC sobre FE: 180 días desde emisión
 * - Validación de formato RUC (Natural, Jurídico, Gobierno)
 * - Validación de codigoCPBS obligatorio para facturas a gobierno
 * - Validación de cliente extranjero sin RUC
 */

import { differenceInDays, differenceInHours } from 'date-fns';
import type { Cliente, ItemFactura, TipoContribuyente } from '../types/types';

// ============================================
// TIPOS
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: string[];
  warning?: string;
}

// ============================================
// VALIDACIONES DE PLAZOS
// ============================================

/**
 * Valida que la anulación esté dentro del plazo de 7 días
 *
 * Según documentación oficial (línea 1118):
 * - Plazo máximo: 7 días continuos desde la emisión
 * - Después de 7 días: Debe usar Nota de Crédito
 *
 * @param fechaEmision - Fecha de emisión del documento a anular
 * @returns Resultado de validación con error si está fuera de plazo
 */
export function validateAnulacionPlazo(fechaEmision: Date | string): ValidationResult {
  const fecha = typeof fechaEmision === 'string' ? new Date(fechaEmision) : fechaEmision;
  const daysSinceEmission = differenceInDays(new Date(), fecha);

  if (daysSinceEmission > 7) {
    return {
      valid: false,
      error: `Plazo de anulación excedido. Máximo 7 días desde emisión (han transcurrido ${daysSinceEmission} días). Después de 7 días debe usar Nota de Crédito.`
    };
  }

  if (daysSinceEmission < 0) {
    return {
      valid: false,
      error: 'La fecha de emisión no puede ser futura.'
    };
  }

  return { valid: true };
}

/**
 * B1: Valida plazo de Nota de Crédito referente a FE (180 días).
 *
 * Bloqueante: >180 días devuelve valid=false. Las NC fuera de plazo
 * son rechazadas por el mapper antes de llegar a HKA.
 *
 * @param fechaEmisionFE - Fecha de emisión de la Factura Electrónica original
 */
export function validateNotaCreditoPlazo(fechaEmisionFE: Date | string): ValidationResult {
  const fecha = typeof fechaEmisionFE === 'string' ? new Date(fechaEmisionFE) : fechaEmisionFE;
  const daysSinceEmission = differenceInDays(new Date(), fecha);

  if (daysSinceEmission < 0) {
    return {
      valid: false,
      error: 'La fecha de emisión de la FE no puede ser futura.'
    };
  }

  if (daysSinceEmission > 180) {
    return {
      valid: false,
      error: `NC fuera de plazo: han transcurrido ${daysSinceEmission} días (límite DGI: 180 días para NC referenciadas).`,
    };
  }

  return { valid: true };
}

// ============================================
// VALIDACIONES DE FORMATO RUC
// ============================================

/**
 * Valida formato de RUC según tipo de contribuyente
 *
 * Formatos válidos:
 * - Natural (tipoContribuyente='1'): X-XX-XXXX o XX-XX-XXXX o XXX-XX-XXXX
 * - Jurídico (tipoContribuyente='2'): XXXXXXX-X-XXXX (7 dígitos - 1 dígito - hasta 5 dígitos)
 * - Gobierno: 8-NT-X-XXXXX
 *
 * @param ruc - RUC a validar
 * @param tipoContribuyente - '1' para Natural, '2' para Jurídico
 * @returns Resultado de validación con error si el formato es inválido
 */
export function validateRUCFormat(
  ruc: string,
  tipoContribuyente: TipoContribuyente
): ValidationResult {
  if (!ruc) {
    return {
      valid: false,
      error: 'RUC es requerido'
    };
  }

  // Remover espacios
  const rucTrimmed = ruc.trim();

  // Gobierno: 8-NT-X-XXXXX
  if (rucTrimmed.startsWith('8-NT-') || rucTrimmed.startsWith('8-N-')) {
    const regexGobierno = /^8-N[T]?-\d{1}-\d{1,5}$/;
    if (!regexGobierno.test(rucTrimmed)) {
      return {
        valid: false,
        error: 'Formato RUC gubernamental inválido. Formato esperado: 8-NT-X-XXXXX'
      };
    }
    return { valid: true };
  }

  // Natural: X-XX-XXXX o XX-XX-XXXX o XXX-XX-XXXX
  if (tipoContribuyente === '1') {
    const regexNatural = /^\d{1,3}-\d{1,2}-\d{1,5}$/;
    if (!regexNatural.test(rucTrimmed)) {
      return {
        valid: false,
        error: 'Formato RUC natural inválido. Formato esperado: XXX-XX-XXXX'
      };
    }
    return { valid: true };
  }

  // Jurídico: XXXXXXX-X-XXXX (5-7 dígitos - 1-2 dígitos - hasta 5 dígitos)
  if (tipoContribuyente === '2') {
    const regexJuridico = /^\d{5,7}-\d{1,2}-\d{1,5}$/;
    if (!regexJuridico.test(rucTrimmed)) {
      return {
        valid: false,
        error: 'Formato RUC jurídico inválido. Formato esperado: XXXXXXX-X-XXXX'
      };
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Tipo de contribuyente inválido. Debe ser "1" (Natural) o "2" (Jurídico)'
  };
}

/**
 * Valida que el dígito verificador sea numérico y de longitud 1-2
 *
 * @param dv - Dígito verificador
 * @returns Resultado de validación
 */
export function validateDV(dv: string): ValidationResult {
  if (!dv) {
    return {
      valid: false,
      error: 'Dígito verificador es requerido'
    };
  }

  const dvTrimmed = dv.trim();

  if (!/^\d{1,2}$/.test(dvTrimmed)) {
    return {
      valid: false,
      error: 'Dígito verificador debe ser numérico de 1-2 dígitos'
    };
  }

  return { valid: true };
}

// ============================================
// VALIDACIONES DE CLIENTE GOBIERNO
// ============================================

/**
 * Valida que factura a gobierno cumpla todos los requisitos
 *
 * Según documentación oficial (línea 339):
 * - tipoClienteFE: 03
 * - Requiere: RUC gubernamental (formato 8-NT-X-XXXXX)
 * - **códigos CPBS obligatorios en TODOS los items**
 *
 * @param cliente - Cliente de la factura
 * @param items - Items de la factura
 * @returns Resultado de validación con lista de errores
 */
export function validateFacturaGobierno(
  cliente: Cliente,
  items: ItemFactura[]
): ValidationResult {
  const errors: string[] = [];

  // Solo validar si es cliente gobierno
  if (cliente.tipoClienteFE !== '03') {
    return { valid: true, errors: [] };
  }

  // Validar RUC gubernamental
  if ('numeroRUC' in cliente) {
    const ruc = cliente.numeroRUC;
    if (!ruc.startsWith('8-NT-') && !ruc.startsWith('8-N-')) {
      errors.push(
        `RUC gubernamental inválido: "${ruc}". Debe tener formato 8-NT-X-XXXXX`
      );
    }
  } else {
    errors.push('Cliente gobierno requiere RUC');
  }

  // Validar que TODOS los items tengan codigoCPBS y unidadMedidaCPBS
  items.forEach((item, index) => {
    if (!item.codigoCPBS && !item.codigoCPBSAbrev) {
      errors.push(
        `Item ${index + 1} "${item.descripcion}": codigoCPBS es OBLIGATORIO para facturas a gobierno`
      );
    }
    if (!item.unidadMedidaCPBS) {
      errors.push(
        `Item ${index + 1} "${item.descripcion}": unidadMedidaCPBS es OBLIGATORIO para facturas a gobierno`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined
  };
}

// ============================================
// VALIDACIONES DE CLIENTE EXTRANJERO
// ============================================

/**
 * Valida que cliente extranjero NO tenga RUC ni ubicación
 *
 * Según documentación oficial (línea 247):
 * - tipoClienteFE: 04
 * - Requiere: tipoIdentificacion, nroIdentificacionExtranjero
 * - NO enviar: campos de RUC ni ubicación (provincia, distrito, corregimiento)
 *
 * @param cliente - Cliente de la factura
 * @returns Resultado de validación
 */
export function validateClienteExtranjero(cliente: Cliente): ValidationResult {
  if (cliente.tipoClienteFE !== '04') {
    return { valid: true };
  }

  const errors: string[] = [];

  // Verificar que tenga campos requeridos
  if ('tipoIdentificacion' in cliente) {
    if (!cliente.tipoIdentificacion) {
      errors.push('Cliente extranjero requiere tipoIdentificacion');
    }
    if (!cliente.nroIdentificacionExtranjero) {
      errors.push('Cliente extranjero requiere nroIdentificacionExtranjero');
    }
  } else {
    errors.push('Cliente extranjero mal configurado');
  }

  // Verificar que NO tenga RUC
  if ('numeroRUC' in cliente && cliente.numeroRUC) {
    errors.push('Cliente extranjero NO debe tener RUC. Use nroIdentificacionExtranjero');
  }

  // Verificar que NO tenga ubicación panameña
  if ('provincia' in cliente && (cliente.provincia || (cliente as any).distrito || (cliente as any).corregimiento)) {
    errors.push('Cliente extranjero NO debe tener ubicación panameña (provincia, distrito, corregimiento)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined
  };
}

// ============================================
// VALIDACIONES NOTAS DE CRÉDITO/DÉBITO
// ============================================

/**
 * Valida que el monto de la NC no supere la factura original
 * y que la cadena (Factura + ND - NC) >= 0
 *
 * @param notaTotal - Monto total de la nota de crédito a emitir
 * @param facturaOriginalTotal - Monto total de la factura original
 * @param existingCreditNotesTotal - Suma de NC ya emitidas contra esta factura
 * @param existingDebitNotesTotal - Suma de ND ya emitidas contra esta factura
 */
export function validateNotaCreditoMontos(
  notaTotal: number,
  facturaOriginalTotal: number,
  existingCreditNotesTotal: number = 0,
  existingDebitNotesTotal: number = 0
): ValidationResult {
  if (notaTotal > facturaOriginalTotal) {
    return {
      valid: false,
      error: `El monto de la Nota de Crédito (${notaTotal.toFixed(2)}) no puede superar el monto de la factura original (${facturaOriginalTotal.toFixed(2)}).`
    };
  }

  const balance = facturaOriginalTotal + existingDebitNotesTotal - existingCreditNotesTotal - notaTotal;
  if (balance < 0) {
    return {
      valid: false,
      error: `La cadena de documentos quedaría en negativo (${balance.toFixed(2)}). Factura: ${facturaOriginalTotal.toFixed(2)} + ND: ${existingDebitNotesTotal.toFixed(2)} - NC existentes: ${existingCreditNotesTotal.toFixed(2)} - esta NC: ${notaTotal.toFixed(2)}.`
    };
  }

  return { valid: true };
}

/**
 * Valida que el receptor de la NC/ND sea idéntico al de la factura original
 */
export function validateReceptorIgual(
  notaReceiverRuc: string | null | undefined,
  facturaOriginalReceiverRuc: string | null | undefined
): ValidationResult {
  const notaRuc = (notaReceiverRuc || '').trim();
  const facturaRuc = (facturaOriginalReceiverRuc || '').trim();

  if (!facturaRuc) {
    return { valid: true }; // Consumidor final sin RUC
  }

  if (notaRuc !== facturaRuc) {
    return {
      valid: false,
      error: `El RUC del receptor de la nota (${notaRuc || 'vacío'}) debe ser idéntico al de la factura original (${facturaRuc}).`
    };
  }

  return { valid: true };
}

/**
 * Valida que la factura original no esté anulada
 */
export function validateFacturaNoAnulada(
  facturaOriginal: { isCancelled: boolean; status: string }
): ValidationResult {
  if (facturaOriginal.isCancelled || facturaOriginal.status === 'CANCELLED') {
    return {
      valid: false,
      error: 'No se puede emitir una Nota de Crédito/Débito contra una factura anulada.'
    };
  }

  return { valid: true };
}

/**
 * Valida que la NC/ND no referencie a otra NC o ND (solo facturas)
 */
export function validateNoReferenciaCircular(
  facturaOriginalDocumentType: string
): ValidationResult {
  if (facturaOriginalDocumentType === 'NOTA_CREDITO' || facturaOriginalDocumentType === 'NOTA_DEBITO') {
    return {
      valid: false,
      error: 'Una Nota de Crédito/Débito no puede referenciar a otra Nota de Crédito ni a una Nota de Débito. Solo puede referenciar facturas.'
    };
  }

  return { valid: true };
}

/**
 * Valida que no haya CUFEs duplicados en la lista de referencias
 */
export function validateCUFEsUnicos(cufeList: string[]): ValidationResult {
  const uniqueCufes = new Set(cufeList.filter(Boolean));
  if (uniqueCufes.size !== cufeList.filter(Boolean).length) {
    return {
      valid: false,
      error: 'El mismo CUFE no puede aparecer duplicado dentro de las referencias del documento.'
    };
  }

  return { valid: true };
}

/**
 * Verifica antigüedad >180 días (devuelve warning, no error)
 */
export function checkNotaCreditoAntiguedad(fechaEmisionFE: Date | string): {
  isOld: boolean;
  daysSinceEmission: number;
  warning?: string;
} {
  const fecha = typeof fechaEmisionFE === 'string' ? new Date(fechaEmisionFE) : fechaEmisionFE;
  const daysSinceEmission = differenceInDays(new Date(), fecha);

  if (daysSinceEmission > 180) {
    return {
      isOld: true,
      daysSinceEmission,
      warning: `La factura original fue emitida hace ${daysSinceEmission} días (más de 180). La DGI autorizará el documento pero con código de Notificación (N).`
    };
  }

  return { isOld: false, daysSinceEmission };
}

// ============================================
// VALIDACIONES COMBINADAS
// ============================================

/**
 * Valida todas las reglas de negocio para un cliente
 *
 * @param cliente - Cliente a validar
 * @param items - Items de la factura (requerido para validar facturas a gobierno)
 * @returns Resultado de validación con todos los errores encontrados
 */
export function validateCliente(
  cliente: Cliente,
  items?: ItemFactura[]
): ValidationResult {
  const errors: string[] = [];

  // Validar RUC si es contribuyente o gobierno
  if (cliente.tipoClienteFE === '01' || cliente.tipoClienteFE === '03') {
    if ('numeroRUC' in cliente && 'tipoContribuyente' in cliente) {
      const rucResult = validateRUCFormat(cliente.numeroRUC, cliente.tipoContribuyente);
      if (!rucResult.valid && rucResult.error) {
        errors.push(rucResult.error);
      }

      // Validar DV
      const dvResult = validateDV(cliente.digitoVerificadorRUC);
      if (!dvResult.valid && dvResult.error) {
        errors.push(dvResult.error);
      }
    }
  }

  // Validar reglas de gobierno
  if (cliente.tipoClienteFE === '03' && items) {
    const gobiernResult = validateFacturaGobierno(cliente, items);
    if (!gobiernResult.valid && gobiernResult.errors) {
      errors.push(...gobiernResult.errors);
    }
  }

  // Validar reglas de extranjero
  if (cliente.tipoClienteFE === '04') {
    const extranjeroResult = validateClienteExtranjero(cliente);
    if (!extranjeroResult.valid && extranjeroResult.errors) {
      errors.push(...extranjeroResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined
  };
}

// ============================================
// VALIDACIONES DE CONTINGENCIA
// ============================================

/**
 * Valida que el plazo de 72 horas de contingencia no haya expirado.
 *
 * Según normativa DGI:
 * - El contribuyente tiene 72 horas máximas desde el inicio de la contingencia
 *   para transmitir las facturas emitidas offline a HKA/DGI.
 * - Pasado ese plazo, el modo contingencia debe desactivarse y no se pueden
 *   emitir nuevas facturas hasta restablecer la conexión normal.
 *
 * @param inicio - ISO string de cuando inició la contingencia
 * @returns ValidationResult con error si el plazo expiró
 */
/**
 * C1: Relajar bloqueo de 72h de contingencia.
 *
 * La DGI NO rechaza documentos pasadas las 72h — los acepta con
 * Notificación 1524. El bloqueo duro anterior impedía envíos válidos.
 *
 * Ahora: valid=true siempre (permite envío), pero incluye warning
 * si se superaron las 72h para que el usuario sepa que DGI notificará.
 */
export function validateContingencia72h(inicio: string): ValidationResult {
  const fechaInicio = new Date(inicio);
  if (isNaN(fechaInicio.getTime())) {
    return { valid: false, error: 'Fecha de inicio de contingencia inválida.' };
  }

  const horasTranscurridas = differenceInHours(new Date(), fechaInicio);

  if (horasTranscurridas >= 72) {
    return {
      valid: true,
      warning:
        `Han transcurrido ${horasTranscurridas}h desde el inicio de la contingencia (límite recomendado: 72h). ` +
        `La DGI aceptará el documento pero emitirá Notificación 1524.`,
    };
  }

  return { valid: true };
}

// ============================================
// VALIDACIONES DE PAÍS / DESTINO
// ============================================

/**
 * Valida coherencia entre destino de operación y país del receptor.
 *
 * Reglas DGI:
 * - 1611: País receptor no puede ser extranjero si destino='1' (Panamá)
 * - 1612: País receptor no puede ser PA si destino='2' (Extranjero)
 * - 1614: País='ZZ' sin descripción paisOtro
 * - 1615: País ISO válido enviado junto con paisOtro (mutuamente excluyentes)
 */
export function validatePaisDestino(
  destinoOperacion: '1' | '2',
  pais: string,
  paisOtro?: string
): ValidationResult {
  const errors: string[] = [];

  if (destinoOperacion === '1' && pais !== 'PA') {
    errors.push(
      `Destino de operación es "1" (Panamá) pero el país del receptor es "${pais}". ` +
      `Debe ser "PA" (Rechazo DGI 1611).`
    );
  }

  if (destinoOperacion === '2' && pais === 'PA') {
    errors.push(
      `Destino de operación es "2" (Extranjero) pero el país del receptor es "PA". ` +
      `Debe ser un código ISO de país extranjero (Rechazo DGI 1612).`
    );
  }

  if (pais === 'ZZ' && !paisOtro) {
    errors.push(
      `País es "ZZ" (desconocido) pero no se proporcionó "paisOtro". ` +
      `Cuando pais="ZZ" es obligatorio enviar paisOtro (Rechazo DGI 1614).`
    );
  }

  if (pais !== 'ZZ' && pais.length === 2 && paisOtro) {
    errors.push(
      `País es "${pais}" (código ISO válido) pero se envió "paisOtro". ` +
      `Son mutuamente excluyentes: use código ISO O "ZZ"+paisOtro (Rechazo DGI 1615).`
    );
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ============================================
// VALIDACIONES DE ANTIGÜEDAD POST-CONTINGENCIA
// ============================================

/**
 * Verifica si la fecha de emisión supera los 30 días de antigüedad.
 *
 * Según Ficha Técnica DGI (Regla B10): al transmitir documentos post-contingencia,
 * si la fechaEmision tiene más de 30 días, la DGI emite Notificación código 1519
 * ("Fecha de emisión muy antigua"). NO es rechazo, es warning.
 *
 * @param fechaEmision - Fecha de emisión del documento
 * @returns Warning si supera 30 días, null si está dentro del plazo
 */
export function checkContingenciaAntiguedad(fechaEmision: Date | string): {
  isOld: boolean;
  daysSinceEmission: number;
  warning?: string;
} {
  const fecha = typeof fechaEmision === 'string' ? new Date(fechaEmision) : fechaEmision;
  const daysSinceEmission = differenceInDays(new Date(), fecha);

  if (daysSinceEmission > 30) {
    return {
      isOld: true,
      daysSinceEmission,
      warning:
        `El documento fue emitido hace ${daysSinceEmission} días (más de 30). ` +
        `La DGI autorizará el documento pero con código de Notificación 1519 ` +
        `("Fecha de emisión muy antigua"). Priorice transmisión de documentos antiguos.`,
    };
  }

  return { isOld: false, daysSinceEmission };
}

// ============================================
// D1: VALIDACIÓN MONTO CONSUMIDOR FINAL
// ============================================

/**
 * D1: Advierte cuando una factura a Consumidor Final (tipoClienteFE='02')
 * supera los $10,000 USD.
 *
 * La DGI NO rechaza estas facturas, pero emite Notificación 2515
 * ("Monto elevado para consumidor final"). Este warning permite al usuario
 * confirmar que los datos son correctos antes de emitir.
 *
 * @param tipoClienteFE - Tipo de cliente receptor
 * @param totalFactura - Monto total de la factura
 * @param umbral - Umbral en USD (default: 10000)
 */
export function checkMontoConsumidorFinal(
  tipoClienteFE: string,
  totalFactura: number,
  umbral: number = 10000
): { exceedsThreshold: boolean; warning?: string } {
  if (tipoClienteFE !== '02') {
    return { exceedsThreshold: false };
  }

  if (totalFactura > umbral) {
    return {
      exceedsThreshold: true,
      warning:
        `Factura a Consumidor Final por $${totalFactura.toLocaleString('en-US', { minimumFractionDigits: 2 })} ` +
        `supera el umbral de $${umbral.toLocaleString('en-US')}. ` +
        `La DGI emitirá Notificación 2515. Verifique que el tipo de receptor sea correcto ` +
        `(considere usar Contribuyente si el cliente tiene RUC).`,
    };
  }

  return { exceedsThreshold: false };
}

// ============================================
// EXPORTS
// ============================================
// VALIDACIÓN DESTINO ↔ TIPO DOCUMENTO (DGI 1533/1534/1650/1651)
// ============================================

/**
 * Valida coherencia entre destinoOperacion y tipoDocumento.
 *
 * Rechazos DGI:
 * - 1533: destino='1' (Panamá) + tipoDocumento='03' (Exportación)
 * - 1534: destino='2' (Extranjero) + tipoDocumento='01' (Operación Interna)
 * - 1650: destino='1' + gFExp presente → prohibido
 * - 1651: destino='2' + gFExp ausente → obligatorio
 */
export function validateDestinoTipoDocumento(
  destinoOperacion: '1' | '2',
  tipoDocumento: string,
  hasGrupoExportacion: boolean
): ValidationResult {
  const errors: string[] = [];

  // 1533: No puede ser exportación con destino Panamá
  if (destinoOperacion === '1' && tipoDocumento === '03') {
    errors.push(
      'Destino "1" (Panamá) es incompatible con tipoDocumento "03" (Exportación). Rechazo DGI 1533.'
    );
  }

  // 1534: No puede ser factura interna con destino extranjero
  if (destinoOperacion === '2' && tipoDocumento === '01') {
    errors.push(
      'Destino "2" (Extranjero) es incompatible con tipoDocumento "01" (Operación Interna). Rechazo DGI 1534.'
    );
  }

  // 1650: gFExp prohibido cuando destino='1'
  if (destinoOperacion === '1' && hasGrupoExportacion) {
    errors.push(
      'Grupo de Exportación (gFExp) está prohibido cuando destino="1" (Panamá). Rechazo DGI 1650.'
    );
  }

  // 1651: gFExp obligatorio cuando destino='2'
  if (destinoOperacion === '2' && !hasGrupoExportacion) {
    errors.push(
      'Grupo de Exportación (gFExp) es obligatorio cuando destino="2" (Extranjero). Rechazo DGI 1651.'
    );
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ============================================
// VALIDACIÓN NC/ND REFERENCIAS CRUZADAS (DGI 1712-1718)
// ============================================

/**
 * Valida que NC/ND no referencien tipos de documento prohibidos.
 *
 * Rechazos DGI:
 * - 1712: NC referencia otra NC
 * - 1713: ND referencia otra ND
 * - 1715: NC referencia ND
 * - 1716: ND referencia NC
 * - 1718: Referencia a documento anulado
 */
export function validateReferenciasCruzadas(
  tipoDocumentoActual: string,
  tipoDocumentoReferenciado?: string,
  referenciadoAnulado?: boolean
): ValidationResult {
  const errors: string[] = [];

  if (!tipoDocumentoReferenciado) {
    return { valid: true };
  }

  const isNC = tipoDocumentoActual === '04' || tipoDocumentoActual === '06';
  const isND = tipoDocumentoActual === '05' || tipoDocumentoActual === '07';
  const refIsNC = tipoDocumentoReferenciado === '04' || tipoDocumentoReferenciado === '06';
  const refIsND = tipoDocumentoReferenciado === '05' || tipoDocumentoReferenciado === '07';

  // 1712: NC → NC
  if (isNC && refIsNC) {
    errors.push('Una Nota de Crédito no puede referenciar otra Nota de Crédito. Rechazo DGI 1712.');
  }

  // 1715: NC → ND
  if (isNC && refIsND) {
    errors.push('Una Nota de Crédito no puede referenciar una Nota de Débito. Rechazo DGI 1715.');
  }

  // 1713: ND → ND
  if (isND && refIsND) {
    errors.push('Una Nota de Débito no puede referenciar otra Nota de Débito. Rechazo DGI 1713.');
  }

  // 1716: ND → NC
  if (isND && refIsNC) {
    errors.push('Una Nota de Débito no puede referenciar una Nota de Crédito. Rechazo DGI 1716.');
  }

  // 1718: Referencia a documento anulado
  if (referenciadoAnulado) {
    errors.push('No se puede referenciar un documento que tiene evento de anulación. Rechazo DGI 1718.');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ============================================

export const BusinessRulesValidator = {
  validateAnulacionPlazo,
  validateNotaCreditoPlazo,
  validateNotaCreditoMontos,
  validateReceptorIgual,
  validateFacturaNoAnulada,
  validateNoReferenciaCircular,
  validateCUFEsUnicos,
  checkNotaCreditoAntiguedad,
  checkContingenciaAntiguedad,
  checkMontoConsumidorFinal,
  validateDestinoTipoDocumento,
  validateReferenciasCruzadas,
  validateRUCFormat,
  validateDV,
  validateFacturaGobierno,
  validateClienteExtranjero,
  validateCliente,
  validateContingencia72h,
  validatePaisDestino,
};

export { validateRetencionCompra } from './strategies/retencion-compra.validator';
export { validateIncoterm } from './strategies/incoterms.validator';
export { validateZonaFranca } from './strategies/zona-franca.validator';
export { validateReembolso } from './strategies/reembolso.validator';

export default BusinessRulesValidator;
