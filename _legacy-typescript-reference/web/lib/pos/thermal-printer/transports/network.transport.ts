// Network transport: POSTs raw ESC/POS bytes to a local bridge server

const BRIDGE_URL = 'http://localhost:9876';
const BRIDGE_TIMEOUT_MS = 1000;

export interface NetworkPrintOptions {
  printerIp?: string;
  printerPort?: number;
}

export class NetworkTransport {
  private options: NetworkPrintOptions;

  constructor(options: NetworkPrintOptions = {}) {
    this.options = options;
  }

  static async isBridgeAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);

      const res = await fetch(`${BRIDGE_URL}/health`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async print(data: Uint8Array): Promise<void> {
    const body = JSON.stringify({
      data: Array.from(data),
      printerIp: this.options.printerIp,
      printerPort: this.options.printerPort ?? 9100,
    });

    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Error del bridge de impresión: ${text}`);
    }
  }
}
