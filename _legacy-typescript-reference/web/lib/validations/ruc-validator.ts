/**
 * Validador de RUC (Registro Único de Contribuyente) de Panamá
 * 
 * Implementa el algoritmo oficial de la DGI Panamá para validar RUCs
 * https://www.dgi.gob.pa/
 */

/**
 * Calcula el dígito verificador (DV) de un RUC panameño
 * 
 * Algoritmo:
 * 1. Multiplicar cada dígito por su posición (de derecha a izquierda, empezando en 2)
 * 2. Sumar todos los resultados
 * 3. Obtener el resto de dividir entre 11
 * 4. Si el resto es 0 o 1, el DV es 0, sino es 11 - resto
 * 
 * @param ruc - RUC sin DV (ejemplo: "123456789-1-2023" o "12345678912023")
 * @returns Dígito verificador calculado
 */
export function calcularDigitoVerificador(ruc: string): string {
  // Limpiar RUC: remover guiones y espacios
  const rucLimpio = ruc.replace(/[-\s]/g, '');

  // Separar RUC base, hypen, y año
  const partes = ruc.split('-');
  let rucBase: string;

  if (partes.length === 3) {
    // Formato: "123456789-1-2023"
    rucBase = partes[0] + partes[1]; // Juntar primera parte y hyphen
  } else if (partes.length === 1) {
    // Formato sin guiones: "12345678912023"
    // Últimos 4 dígitos son el año, ignoramos
    rucBase = rucLimpio.slice(0, -4);
  } else {
    // Formato inválido
    throw new Error('Formato de RUC inválido');
  }

  // Validar que solo tenga dígitos
  if (!/^\d+$/.test(rucBase)) {
    throw new Error(
      'RUC contiene letras: el DV debe obtenerse desde ConsultarRucDV() (DGI). ' +
      'Use el botón "Validar con DGI" en Configuración > Organización.'
    );
  }

  // Calcular DV
  let suma = 0;
  let multiplicador = 2;

  // Iterar de derecha a izquierda
  for (let i = rucBase.length - 1; i >= 0; i--) {
    const digito = parseInt(rucBase[i], 10);
    suma += digito * multiplicador;
    multiplicador++;

    // Si multiplicador llega a 8, reiniciar a 2
    if (multiplicador > 7) {
      multiplicador = 2;
    }
  }

  const resto = suma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;

  return dv.toString();
}

/**
 * Valida un RUC completo con su dígito verificador
 * 
 * @param rucCompleto - RUC con DV (ejemplo: "123456789-1-2023-45")
 * @returns true si el DV es válido
 */
export function validarRUCCompleto(rucCompleto: string): boolean {
  try {
    // Separar RUC y DV
    const partes = rucCompleto.split('-');

    if (partes.length !== 4) {
      return false;
    }

    const rucSinDV = `${partes[0]}-${partes[1]}-${partes[2]}`;
    const dvProporcionado = partes[3];

    const dvCalculado = calcularDigitoVerificador(rucSinDV);

    // Comparar considerando que el DV puede tener padding con 0
    return dvCalculado === dvProporcionado || dvCalculado === dvProporcionado.replace(/^0+/, '') || dvCalculado.padStart(2, '0') === dvProporcionado;
  } catch {
    return false;
  }
}

/**
 * Formatea un RUC con su dígito verificador calculado
 * 
 * @param ruc - RUC base (ejemplo: "123456789-1-2023")
 * @returns RUC formateado con DV (ejemplo: "123456789-1-2023-45")
 */
export function formatearRUCConDV(ruc: string): string {
  const dv = calcularDigitoVerificador(ruc);
  // Asegurar que el DV tenga 2 dígitos (padding con 0)
  const dvPadded = dv.padStart(2, '0');
  return `${ruc}-${dvPadded}`;
}

/**
 * Extrae el DV de un RUC completo
 * 
 * @param rucCompleto - RUC completo con DV (ejemplo: "123456789-1-2023-45")
 * @returns Dígito verificador extraído
 */
export function extraerDV(rucCompleto: string): string | null {
  const partes = rucCompleto.split('-');

  if (partes.length !== 4) {
    return null;
  }

  return partes[3];
}

/**
 * Extrae el RUC base sin DV
 * 
 * @param rucCompleto - RUC completo con DV (ejemplo: "123456789-1-2023-45")
 * @returns RUC sin DV (ejemplo: "123456789-1-2023")
 */
export function extraerRUCSinDV(rucCompleto: string): string | null {
  const partes = rucCompleto.split('-');

  if (partes.length !== 4) {
    return null;
  }

  return `${partes[0]}-${partes[1]}-${partes[2]}`;
}

/**
 * Valida el formato de un RUC panameño
 *
 * Acepta:
 * - RUC numérico tradicional (con o sin DV): "123456789-1-2023", "123456789-1-2023-45"
 * - RUC alfanumérico con guiones (DGI Panamá): "PE-4-000-000", "8-NT-000-00"
 *
 * Reglas generales (5–20 caracteres, solo alfanumérico + guiones,
 * sin guiones al inicio/final ni consecutivos).
 *
 * Para RUCs con letras el DV debe obtenerse vía ConsultarRucDV() —
 * calcularDigitoVerificador() solo aplica a RUC numéricos.
 *
 * @param ruc - RUC a validar
 * @returns true si el formato es válido
 */
export function validarFormatoRUC(ruc: string): boolean {
  if (!ruc) return false;
  const r = ruc.trim().toUpperCase();

  // Longitud: 5–20 caracteres
  if (r.length < 5 || r.length > 20) return false;

  // Solo alfanumérico y guiones, sin guión al inicio ni al final
  if (!/^[A-Z0-9]([A-Z0-9\-]*[A-Z0-9])?$/.test(r)) return false;

  // Sin guiones consecutivos
  if (/--/.test(r)) return false;

  return true;
}

/**
 * Indica si un RUC contiene letras (alfanumérico).
 *
 * Para RUCs alfanuméricos el DV DEBE obtenerse desde ConsultarRucDV() (DGI).
 * La función calcularDigitoVerificador() no aplica a estos RUCs.
 *
 * @param ruc - RUC a evaluar
 * @returns true si el RUC contiene alguna letra
 */
export function esRUCAlphanumerico(ruc: string): boolean {
  return /[A-Za-z]/.test(ruc);
}

/**
 * Ejemplos de uso y testing
 */
export function ejemplos() {
  console.log('=== VALIDACIÓN DE RUC PANAMEÑO ===\n');

  // RUCs de prueba (valores inventados para testing)
  const rucs = [
    '123456789-1-2023',
    '87654321-2-2024',
    '19265242-1-2024',
  ];

  rucs.forEach(ruc => {
    const dv = calcularDigitoVerificador(ruc);
    const rucCompleto = `${ruc}-${dv}`;
    const esValido = validarRUCCompleto(rucCompleto);

    console.log(`RUC: ${ruc}`);
    console.log(`DV calculado: ${dv}`);
    console.log(`RUC completo: ${rucCompleto}`);
    console.log(`¿Es válido? ${esValido ? 'SI' : 'NO'}`);
    console.log('---');
  });
}
