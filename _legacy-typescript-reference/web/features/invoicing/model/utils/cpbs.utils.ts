/**
 * CPBS Utilities
 */

/**
 * Deriva el código de Segmento (2 dígitos) a partir del código de Familia (4 dígitos)
 * @param cpbsCode Código completo de 4 dígitos
 * @returns Código abreviado de 2 dígitos o undefined si el input es inválido
 */
export function deriveCpbsSegment(cpbsCode?: string): string | undefined {
    if (!cpbsCode || cpbsCode.length < 2) return undefined;
    return cpbsCode.substring(0, 2);
}

/**
 * Valida si un código CPBS tiene el formato correcto (4 dígitos numéricos)
 */
export function isValidCpbsCode(cpbsCode?: string): boolean {
    if (!cpbsCode) return false;
    return /^\d{4}$/.test(cpbsCode);
}
