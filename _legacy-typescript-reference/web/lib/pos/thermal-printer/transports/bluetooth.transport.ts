// ESC/POS Bluetooth transport via Web Bluetooth API
// Web Bluetooth types are not in the default TypeScript lib; we use `any` casts.
/* eslint-disable @typescript-eslint/no-explicit-any */

const CHUNK_SIZE = 512;
const CHUNK_DELAY_MS = 20;

// Common ESC/POS BLE service/characteristic UUIDs
const BLE_PROFILES = [
  {
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    charUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  },
  {
    serviceUUID: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    charUUID: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BluetoothTransport {
  private device: any = null;
  private characteristic: any = null;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async connect(): Promise<void> {
    if (!BluetoothTransport.isSupported()) {
      throw new Error('Web Bluetooth no está disponible en este navegador');
    }

    const nav = navigator as any;
    const serviceUUIDs = BLE_PROFILES.map((p) => p.serviceUUID);

    this.device = await nav.bluetooth.requestDevice({
      filters: [
        { services: [serviceUUIDs[0]] },
        { services: [serviceUUIDs[1]] },
      ],
      optionalServices: serviceUUIDs,
    });

    const server = await this.device.gatt.connect();

    // Try each profile until one works
    for (const profile of BLE_PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.serviceUUID);
        this.characteristic = await service.getCharacteristic(profile.charUUID);
        return;
      } catch {
        // Try next profile
      }
    }

    throw new Error('No se encontró un perfil ESC/POS compatible en la impresora');
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('No hay impresora conectada. Ejecute connect() primero');
    }

    let offset = 0;
    while (offset < data.length) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
      offset += CHUNK_SIZE;
      if (offset < data.length) {
        await sleep(CHUNK_DELAY_MS);
      }
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  get isConnected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }
}
