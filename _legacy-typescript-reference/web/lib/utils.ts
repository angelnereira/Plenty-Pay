import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un monto como moneda con prefijo "$" y dos decimales, replicando el
 * patrón usado en las tarjetas de facturación (es consistente con el monto
 * principal del dashboard). Acepta number o string numérico.
 */
export function formatCurrency(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount
  const safe = Number.isFinite(value) ? value : 0
  return `$${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
