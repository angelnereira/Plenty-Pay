import { format as formatTz, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export const PANAMA_TZ = 'America/Panama';

/**
 * Formats a date string/object/number to Panama Timezone
 * Usage: formatPanama(new Date(), 'dd/MM/yyyy HH:mm')
 */
export function formatPanama(date: Date | string | number, formatStr: string): string {
    return formatTz(date, formatStr, { timeZone: PANAMA_TZ, locale: es });
}

/**
 * Returns the current time in Panama as a formatted string (default ISO-ish or custom)
 */
export function getCurrentPanamaTime(formatStr: string = "yyyy-MM-dd HH:mm:ss"): string {
    return formatTz(new Date(), formatStr, { timeZone: PANAMA_TZ, locale: es });
}

/**
 * Helper to get a Date object that effectively represents Panama time parts 
 * (but technically is a Date object)
 * Useful if some libraries expect a Date object and just print the parts (toString)
 */
export function getPanamaZonedDate(date: Date = new Date()): Date {
    return toZonedTime(date, PANAMA_TZ);
}
