/**
 * Engine Utilities para Compliance HKA
 */

/**
 * Sanitiza un valor numérico para cumplir con formato HKA Decimal
 * Elimina separadores de miles y asegura decimales con punto.
 * Ejemplo: "1,200.50" -> "1200.50"
 * Ejemplo: "1.200,50" -> "1200.50" (Europeo)
 */
export function sanitizeDecimal(value: string | number | undefined | null): string {
    if (value === undefined || value === null || value === '') return '0.00';

    let str = String(value).trim();

    // Detectar formato europeo (coma decimal, punto miles)
    // Heurística: Si hay una coma después del último punto, o solo coma.
    const lastCommaIndex = str.lastIndexOf(',');
    const lastDotIndex = str.lastIndexOf('.');

    if (lastCommaIndex > lastDotIndex) {
        // Caso europeo: 1.000,00 -> Reemplazar puntos por nada, coma por punto
        str = str.replace(/\./g, '').replace(',', '.');
    } else {
        // Caso americano: 1,000.00 -> Eliminar comas
        str = str.replace(/,/g, '');
    }

    const num = parseFloat(str);
    return isNaN(num) ? '0.00' : num.toFixed(2);
}

/**
 * Limpia textos para XML (elimina caracteres inválidos)
 */
export function sanitizeText(text: string | undefined): string {
    if (!text) return '';
    return text
        .replace(/[<>]/g, '') // Eliminar etiquetas HTML/XML básicas
        .trim()
        .substring(0, 500); // Límite seguro genérico
}
