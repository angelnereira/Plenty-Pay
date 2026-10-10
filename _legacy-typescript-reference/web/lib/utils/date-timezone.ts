/**
 * Utilidades para manejo de fechas y horas en zona horaria de Panamá
 * Panamá usa America/Panama (UTC-5) sin horario de verano
 */

import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

// Zona horaria de Panamá
export const PANAMA_TIMEZONE = 'America/Panama';

/**
 * Obtiene la fecha y hora actual en zona horaria de Panamá
 */
export function nowInPanama(): Date {
  const now = new Date();
  return toZonedTime(now, PANAMA_TIMEZONE);
}

/**
 * Convierte una fecha UTC a zona horaria de Panamá
 */
export function toPanamaTime(date: Date): Date {
  return toZonedTime(date, PANAMA_TIMEZONE);
}

/**
 * Convierte una fecha de Panamá a UTC
 */
export function panamaToUTC(date: Date): Date {
  return fromZonedTime(date, PANAMA_TIMEZONE);
}

/**
 * Formatea una fecha en zona horaria de Panamá
 * @param date - Fecha a formatear
 * @param formatString - Formato deseado (ver date-fns format)
 * @returns Fecha formateada en zona horaria de Panamá
 */
export function formatPanamaDate(
  date: Date | string,
  formatString: string = 'dd/MM/yyyy HH:mm:ss'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, PANAMA_TIMEZONE, formatString, { locale: es });
}

/**
 * Formatea una fecha en formato ISO para XML/HKA (YYYY-MM-DDTHH:mm:ss-05:00)
 */
export function formatPanamaISO(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, PANAMA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Formatea una fecha para mostrar en UI (formato legible en español)
 */
export function formatPanamaDateReadable(
  date: Date | string,
  includeTime: boolean = true
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatStr = includeTime
    ? "dd 'de' MMMM 'de' yyyy 'a las' HH:mm"
    : "dd 'de' MMMM 'de' yyyy";
  return formatInTimeZone(dateObj, PANAMA_TIMEZONE, formatStr, { locale: es });
}

/**
 * Obtiene la fecha actual en Panamá como string ISO
 */
export function getPanamaISOString(): string {
  return formatPanamaISO(new Date());
}

/**
 * Crea una fecha en zona horaria de Panamá desde componentes
 */
export function createPanamaDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // Crear fecha en formato ISO string asumiendo Panamá
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}-05:00`;
  return fromZonedTime(new Date(dateStr), PANAMA_TIMEZONE);
}

/**
 * Obtiene la fecha/hora actual en Panamá para usar en Prisma
 * Prisma almacena fechas en UTC, pero queremos que representen la hora local de Panamá
 * 
 * IMPORTANTE: Esta función obtiene la hora actual en Panamá y crea un Date en UTC
 * que cuando se almacene en BD y luego se muestre con formatPanamaDate(),
 * mostrará la hora correcta de Panamá
 */
export function getPanamaTimestamp(): Date {
  // Obtener la hora actual en Panamá como string ISO
  const panamaISO = formatPanamaISO(new Date());
  
  // Convertir ese string ISO (que tiene offset -05:00) a un Date en UTC
  // Esto asegura que cuando se almacene en BD (UTC) y se lea y formatee,
  // mostrará la hora correcta de Panamá
  return fromZonedTime(panamaISO, PANAMA_TIMEZONE);
}

/**
 * Formatea para mostrar en tablas (formato corto)
 */
export function formatPanamaDateShort(date: Date | string): string {
  return formatPanamaDate(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Formatea solo fecha sin hora
 */
export function formatPanamaDateOnly(date: Date | string): string {
  return formatPanamaDate(date, 'dd/MM/yyyy');
}

/**
 * Formatea solo hora sin fecha
 */
export function formatPanamaTimeOnly(date: Date | string): string {
  return formatPanamaDate(date, 'HH:mm:ss');
}

/**
 * Formatea fecha en formato corto con mes abreviado (ej: "15 ene 2024")
 */
export function formatPanamaDateShortMonth(date: Date | string): string {
  return formatPanamaDate(date, 'dd MMM yyyy');
}

