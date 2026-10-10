/**
 * Helpers de dinero para el Motor — todo el dinero del Motor se almacena en
 * BigInt centavos PAB. La conversión a/desde valores legibles ocurre solo
 * en los bordes (forms y UI / PDFs).
 *
 * Convención: nunca se hace aritmética en JS Number con dinero del Motor.
 */

const CENTS_PER_UNIT = 100n;

/**
 * Convierte un valor monetario (string o number) a BigInt centavos.
 * Acepta "123.45", "123", "123.4", 123, 123.45.
 * Rechaza valores no numéricos o más de 2 decimales.
 */
export function toCents(value: string | number): bigint {
    const raw = typeof value === "number" ? value.toString() : value.trim();
    if (!raw || !/^-?\d+(\.\d{1,2})?$/.test(raw)) {
        throw new Error(`Monto inválido: "${value}" (esperado formato N o N.NN)`);
    }
    const negative = raw.startsWith("-");
    const positive = negative ? raw.slice(1) : raw;
    const [intPart, decPart = ""] = positive.split(".");
    const padded = (decPart + "00").slice(0, 2);
    const cents = BigInt(intPart) * CENTS_PER_UNIT + BigInt(padded);
    return negative ? -cents : cents;
}

/**
 * Formatea un BigInt de centavos a string legible "1,234.56".
 * Usa coma como separador de miles y punto como decimal (convención PA).
 */
export function formatCents(cents: bigint, options?: { withCurrency?: boolean }): string {
    const negative = cents < 0n;
    const abs = negative ? -cents : cents;
    const intPart = abs / CENTS_PER_UNIT;
    const decPart = abs % CENTS_PER_UNIT;
    const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decStr = decPart.toString().padStart(2, "0");
    const formatted = `${negative ? "-" : ""}${intStr}.${decStr}`;
    return options?.withCurrency ? `B/. ${formatted}` : formatted;
}

/**
 * Suma una colección de centavos. Útil para totales en UI.
 */
export function sumCents(values: bigint[]): bigint {
    return values.reduce((acc, v) => acc + v, 0n);
}

/**
 * Convierte BigInt a string para serialización JSON segura.
 * BigInt no es JSON-safe nativamente.
 */
export function centsToString(cents: bigint | null | undefined): string | null {
    if (cents === null || cents === undefined) return null;
    return cents.toString();
}

/**
 * Parsea un string de centavos (recibido de un form/JSON) a BigInt.
 */
export function centsFromString(value: string | null | undefined): bigint | null {
    if (value === null || value === undefined || value === "") return null;
    if (!/^-?\d+$/.test(value)) {
        throw new Error(`Centavos inválidos: "${value}"`);
    }
    return BigInt(value);
}
