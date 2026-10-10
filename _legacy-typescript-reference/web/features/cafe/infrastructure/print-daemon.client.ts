/**
 * CAFE Print Daemon Client
 *
 * Sends a pre-built ESC/POS Uint8Array to the local daemon running on the POS
 * machine. The daemon writes the bytes directly to the printer device.
 *
 * Contract:
 *   POST http://localhost:{port}/print
 *   Content-Type: application/octet-stream
 *   Body: ESC/POS Uint8Array
 *
 *   200 OK           → printed successfully
 *   503 Unavailable  → printer device not accessible
 *   network error    → daemon not running
 *
 * All failures are caught and returned as { success: false, error } so the
 * caller can show a toast without crashing.
 */

import type { PrintResult } from '@/features/cafe/model/types';

const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT_MS = 3000;

export async function sendToPrintDaemon(
  buffer: Uint8Array,
  options?: { port?: number; timeoutMs?: number },
): Promise<PrintResult> {
  const port = options?.port ?? DEFAULT_PORT;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `http://localhost:${port}/print`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: buffer as unknown as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: controller.signal as AbortSignal,
    });

    if (response.ok) {
      return { success: true };
    }

    const text = await response.text().catch(() => response.statusText);
    return { success: false, error: `Daemon respondió ${response.status}: ${text}` };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: 'Sin respuesta del daemon (tiempo de espera agotado)' };
    }
    return {
      success: false,
      error: 'Daemon no disponible — verifique que el servicio esté activo',
    };
  } finally {
    clearTimeout(timer);
  }
}
