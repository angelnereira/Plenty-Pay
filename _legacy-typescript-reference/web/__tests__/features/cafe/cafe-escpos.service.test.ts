import iconv from 'iconv-lite';
import { buildCafeEscposBuffer } from '@/features/cafe/model/services/cafe-escpos.service';
import type { CAFEEscposInput } from '@/features/cafe/model/types';

const decode = (buf: Uint8Array) => iconv.decode(Buffer.from(buf), 'cp850');

const baseInput: CAFEEscposInput = {
  modo: 'SINCRONO',
  paperWidth: 80,
  printerDpi: 203,
  numeroDocumento: '0001-001-0000000001',
  tipoDocumentoLabel: 'FACTURA DE OPERACIÓN INTERNA',
  fechaEmision: new Date('2026-04-10T14:00:00'),
  moneda: 'PAB',
  emisorNombre: 'EMPRESA EJEMPLO S.A.',
  emisorRucDv: 'RUC: 123456-1-123456 DV: 28',
  emisorDireccion: 'Calle 50, Panamá',
  receptorNombre: 'JUAN PÉREZ',
  receptorRucDv: 'RUC: 8-123-456 DV: 7',
  subtotal: 100.00,
  totalITBMS: 7.00,
  totalFactura: 107.00,
  items: [
    {
      descripcion: 'Producto A',
      cantidad: 2,
      unidad: 'UND',
      precioUnitario: 50.00,
      itbms: 3.50,
      total: 100.00,
    },
  ],
  formaPago: [{ metodo: 'Efectivo', monto: 110.00 }],
  cambio: 3.00,
  qrContent: 'https://efact.mef.gob.pa/receiverfe/servlet/qr?cufe=abc123',
  hkaProtocol: 'PROT-20260410-001',
  hkaProtocolDate: new Date('2026-04-10T14:01:00'),
};

describe('buildCafeEscposBuffer', () => {
  it('returns a non-empty Uint8Array', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('SINCRONO: contains exact DGI protocol text', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    const text = decode(buf);
    expect(text).toContain('Protocolo de autorización');
    expect(text).toContain('PROT-20260410-001');
  });

  it('ASINCRONO: contains "DIRECCIÓN GENERAL DE INGRESOS" (full name)', async () => {
    const input: CAFEEscposInput = {
      ...baseInput,
      modo: 'ASINCRONO',
      hkaProtocol: undefined,
      hkaProtocolDate: undefined,
      fechaLimiteTransmision: new Date('2026-04-11T17:00:00'),
    };
    const buf = await buildCafeEscposBuffer(input);
    const text = decode(buf);
    expect(text).toContain('CAFE de emisión previa');
    expect(text).toContain('DIRECCIÓN GENERAL DE INGRESOS');
    expect(text).toContain('11/04/2026');
  });

  it('CONTINGENCIA: imprime la frase DGI exacta con formato HH:mm:ss', async () => {
    const deadline = new Date('2026-04-13T14:00:30'); // segundos = :30 para detectar omisión
    const input: CAFEEscposInput = {
      ...baseInput,
      modo: 'CONTINGENCIA',
      hkaProtocol: undefined,
      hkaProtocolDate: undefined,
      fechaLimiteTransmision: deadline,
    };
    const buf = await buildCafeEscposBuffer(input);
    // Unir líneas para neutralizar word-wrap del motor ESC/POS
    const text = decode(buf).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
    expect(text).toContain(
      'CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta 13/04/2026 14:00:30'
    );
  });

  it('item line contains "2 UND" (cantidad + unidad concatenated)', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    const text = decode(buf);
    expect(text).toContain('2 UND');
  });

  it('contains QR byte sequence: GS ( k (0x1D 0x28 0x6B)', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    const bytes = Array.from(buf);
    const idx = bytes.findIndex(
      (b, i) => b === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b,
    );
    expect(idx).toBeGreaterThan(-1);
  });

  it('QR bytes include Level M error correction byte (0x31 after fn 0x45)', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    const bytes = Array.from(buf);
    // Look for: GS ( k 3 0 1 E(0x45) then 0x31 (Level M)
    let found = false;
    for (let i = 0; i < bytes.length - 7; i++) {
      if (
        bytes[i] === 0x1d &&
        bytes[i + 1] === 0x28 &&
        bytes[i + 2] === 0x6b &&
        bytes[i + 3] === 0x03 &&
        bytes[i + 4] === 0x00 &&
        bytes[i + 5] === 0x31 &&
        bytes[i + 6] === 0x45 &&
        bytes[i + 7] === 0x31 // Level M
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('works with 58mm paper width', async () => {
    const buf = await buildCafeEscposBuffer({ ...baseInput, paperWidth: 58 });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(50);
  });

  it('includes cambio (change) in the output', async () => {
    const buf = await buildCafeEscposBuffer(baseInput);
    const text = decode(buf);
    expect(text).toContain('Vuelto');
  });
});
