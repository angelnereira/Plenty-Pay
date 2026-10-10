import type { PrinterProfile } from './printer-profiles';
import { DEFAULT_PROFILE } from './printer-profiles';
import type { ReceiptData } from './escpos-encoder';
import { buildReceiptBuffer } from './escpos-encoder';
import { BluetoothTransport } from './transports/bluetooth.transport';
import { PdfTransport } from './transports/pdf.transport';
import { NetworkTransport } from './transports/network.transport';

export type ConnectionType = 'bluetooth' | 'network' | 'pdf';

export interface PrinterConfig {
  connectionType: ConnectionType;
  profile: PrinterProfile;
  printerIp?: string;
  printerPort?: number;
}

const STORAGE_KEY = 'plentypay_printer_config';

export class PrinterService {
  private config: PrinterConfig;
  private bluetooth: BluetoothTransport | null = null;

  constructor(config?: Partial<PrinterConfig>) {
    this.config = {
      connectionType: 'pdf',
      profile: DEFAULT_PROFILE,
      ...PrinterService.loadConfig(),
      ...config,
    };
  }

  static loadConfig(): Partial<PrinterConfig> | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static saveConfig(config: PrinterConfig): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  static hasConfig(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(STORAGE_KEY);
  }

  updateConfig(config: Partial<PrinterConfig>): void {
    this.config = { ...this.config, ...config };
    PrinterService.saveConfig(this.config);
  }

  getConfig(): PrinterConfig {
    return { ...this.config };
  }

  async print(data: ReceiptData): Promise<void> {
    const { connectionType, profile, printerIp, printerPort } = this.config;

    if (connectionType === 'pdf') {
      const transport = new PdfTransport();
      await transport.print(data);
      return;
    }

    // For bluetooth and network, we need the ESC/POS buffer
    const buffer = await buildReceiptBuffer(data, profile);

    if (connectionType === 'bluetooth') {
      if (!this.bluetooth || !this.bluetooth.isConnected) {
        this.bluetooth = new BluetoothTransport();
        await this.bluetooth.connect();
      }
      await this.bluetooth.print(buffer);
      return;
    }

    if (connectionType === 'network') {
      const transport = new NetworkTransport({ printerIp, printerPort });
      await transport.print(buffer);
      return;
    }
  }

  disconnectBluetooth(): void {
    this.bluetooth?.disconnect();
    this.bluetooth = null;
  }
}
