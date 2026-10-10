'use client';

/**
 * CAFE ESC/POS Service
 *
 * Builds a complete ESC/POS Uint8Array for thermal printers (58mm / 80mm)
 * containing all 6 DGI-mandated CAFE sections plus a compliant QR code.
 *
 * Key compliance points:
 *  - QR error correction: Level M (15% recovery) — written as raw ESC/POS
 *    bytes because escpos-buffer hardcodes Level L in its qrcode() method.
 *  - QR module size: calculated to guarantee ≥25mm physical width at the
 *    given DPI (DGI requires 22mm content + 3mm quiet zone = 25mm total).
 *  - Legal text: exact DGI-mandated literals per emission mode.
 *
 * Runs entirely client-side — no Server Action required — so the POS can
 * print in contingency mode even when the Next.js server is unreachable.
 */

import { Printer, InMemory, Align, Style, Cut } from 'escpos-buffer';
import type { CAFEEscposInput } from '../types';

// Column widths per paper size
const COLS: Record<58 | 80, number> = { 58: 32, 80: 48 };

// Printer model per paper width (both use Epson-compatible ESC/POS protocol)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL: Record<58 | 80, any> = { 58: 'MP-4200 TH', 80: 'TM-T20' };

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

/** DD/MM/YYYY HH:mm:ss */
function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** B/. 1,234.50 */
function fmtMoney(n: number): string {
  return `B/. ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Left-pad or right-pad a string to exactly `width` chars, truncating if needed */
function col(s: string, width: number, align: 'l' | 'r' = 'l'): string {
  const t = s.slice(0, width);
  return align === 'l' ? t.padEnd(width) : t.padStart(width);
}

/** Two-column line: left fills up, right is fixed-width */
function twoCol(left: string, right: string, cols: number): string {
  const r = right.slice(0, cols - 1);
  const l = left.slice(0, cols - r.length - 1);
  return l.padEnd(cols - r.length) + r;
}

function divider(cols: number): string {
  return '-'.repeat(cols);
}

/** Wrap text to lines of `cols` characters, splitting on word boundaries */
function wordWrap(text: string, cols: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > cols) {
      if (current) lines.push(current);
      current = word.slice(0, cols);
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** DGI-mandated legal text per emission mode */
function buildLegalText(input: CAFEEscposInput): string {
  if (input.modo === 'SINCRONO') {
    const dateStr = input.hkaProtocolDate ? fmtDate(input.hkaProtocolDate) : '';
    return `Protocolo de autorización: ${input.hkaProtocol}, de ${dateStr}`;
  }
  const deadline = input.fechaLimiteTransmision ? fmtDate(input.fechaLimiteTransmision) : '';
  if (input.modo === 'ASINCRONO') {
    return `CAFE de emisión previa, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta ${deadline}`;
  }
  // CONTINGENCIA
  return `CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta ${deadline}`;
}

/**
 * Build raw ESC/POS QR code bytes using Level M error correction.
 * Bypasses escpos-buffer's qrcode() which hardcodes Level L.
 *
 * DGI requires:
 *   - Error correction: Level M (0x31 in Epson fn69 command)
 *   - Encoding: UTF-8
 *   - Module size: chosen so QR content ≥ 22mm wide at printer DPI
 */
function buildQRBytes(data: string, moduleSize: number): Buffer {
  const dataBuffer = Buffer.from(data, 'utf8');
  const len = dataBuffer.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;

  return Buffer.concat([
    // Set QR model 2
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // Set module size (1–16; choose to satisfy ≥22mm content at printer DPI)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]),
    // Set error correction Level M (0x31 = fn param 49 = Level M per Epson spec)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    // Store data
    Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    dataBuffer,
    // Print
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

/**
 * Calculate ESC/POS QR module size to satisfy DGI's 22mm content minimum.
 * Conservative estimate: QR version 5 (37 modules/side) for long DGI URLs.
 * At 203 DPI: moduleSize=7 → 37×7/8 ≈ 32mm total (22mm content + quiet zone) ✓
 */
function calcModuleSize(dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  const modules = 37; // conservative (v5); actual may be smaller → more margin
  return Math.max(7, Math.ceil((22 * dotsPerMm) / modules));
}

// ─────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────

/**
 * Build a complete ESC/POS buffer for a DGI-compliant CAFE thermal receipt.
 * Returns a Uint8Array safe to POST as application/octet-stream to the daemon.
 */
export async function buildCafeEscposBuffer(input: CAFEEscposInput): Promise<Uint8Array> {
  const cols = COLS[input.paperWidth];
  const modelName = MODEL[input.paperWidth];
  const dpi = input.printerDpi ?? 203;
  const moduleSize = calcModuleSize(dpi);

  const connection = new InMemory();
  const printer = await Printer.CONNECT(modelName, connection);

  // ── SECTION 1: HEADER ─────────────────────────────
  await printer.writeln('COMPROBANTE AUXILIAR DE', Style.Bold, Align.Center);
  await printer.writeln('FACTURA ELECTRÓNICA (CAFE)', Style.Bold, Align.Center);
  await printer.writeln(input.tipoDocumentoLabel, 0, Align.Center);
  await printer.writeln(divider(cols));

  await printer.writeln(input.emisorNombre, Style.Bold);
  await printer.writeln(input.emisorRucDv);
  if (input.emisorDireccion) await printer.writeln(input.emisorDireccion);
  if (input.emisorTelefono) await printer.writeln(`Tel: ${input.emisorTelefono}`);
  await printer.writeln(divider(cols));

  await printer.writeln(`Cliente: ${input.receptorNombre}`);
  if (input.receptorRucDv) await printer.writeln(input.receptorRucDv);
  await printer.writeln(divider(cols));

  await printer.writeln(twoCol('N°:', input.numeroDocumento, cols));
  await printer.writeln(twoCol('Fecha:', fmtDate(input.fechaEmision), cols));
  await printer.writeln(twoCol('Moneda:', input.moneda, cols));
  await printer.writeln(divider(cols));

  // ── SECTION 2: ITEM DETAIL ────────────────────────
  // Header row — adapt widths to paper size
  const descW = cols - 18;
  await printer.writeln(
    `${col('Descripción', descW)}${col('Cant', 8, 'r')}${col('Total', 10, 'r')}`,
    Style.Bold,
  );
  await printer.writeln(divider(cols));

  for (const item of input.items) {
    // Quantity + unit concatenated per DGI Formato 2 spec
    const cantUnidad = `${item.cantidad} ${item.unidad}`;
    const totalStr = fmtMoney(item.total);
    await printer.writeln(
      `${col(item.descripcion, descW)}${col(cantUnidad, 8, 'r')}${col(totalStr, 10, 'r')}`,
    );
    // ITBMS sub-line
    if (item.itbms > 0) {
      await printer.writeln(
        `${''.padEnd(descW)}${col('ITBMS:', 8, 'r')}${col(fmtMoney(item.itbms), 10, 'r')}`,
      );
    }
  }
  await printer.writeln(divider(cols));

  // ── SECTION 3: TOTALS & PAYMENT ──────────────────
  await printer.writeln(twoCol('Subtotal:', fmtMoney(input.subtotal), cols));
  if (input.descuento) {
    await printer.writeln(twoCol('Descuento:', `-${fmtMoney(input.descuento)}`, cols));
  }
  await printer.writeln(twoCol('ITBMS:', fmtMoney(input.totalITBMS), cols));
  await printer.writeln(divider(cols));
  await printer.writeln(twoCol('TOTAL:', fmtMoney(input.totalFactura), cols), Style.Bold);
  await printer.writeln(divider(cols));

  await printer.writeln('Forma de Pago:');
  for (const pago of input.formaPago) {
    await printer.writeln(twoCol(`  ${pago.metodo}:`, fmtMoney(pago.monto), cols));
  }
  if (input.cambio !== undefined) {
    await printer.writeln(twoCol('Vuelto:', fmtMoney(input.cambio), cols));
  }
  await printer.writeln(divider(cols));

  // ── SECTION 4: DGI CONSULTATION + QR ─────────────
  await printer.writeln('Consulte en:', 0, Align.Center);
  await printer.writeln('efact.mef.gob.pa', 0, Align.Center);
  await printer.feed(1);

  // QR — raw bytes with Level M (bypass escpos-buffer's Level L)
  await connection.write(buildQRBytes(input.qrContent, moduleSize));
  await printer.feed(1);

  // CUFE Label and value (FE prefix mandatory)
  if (input.cufe) {
    await printer.writeln('CUFE:', Style.Bold, Align.Center);
    const cufeLines = wordWrap(`FE${input.cufe}`, cols); // FE prefix added
    for (const line of cufeLines) {
      await printer.writeln(line, 0, Align.Center);
    }
    await printer.feed(1);
  }

  // Legal text (wrapped to column width)
  const legalLines = wordWrap(buildLegalText(input), cols);
  for (const line of legalLines) {
    await printer.writeln(line);
  }
  await printer.writeln(divider(cols));

  // ── SECTION 5: PROMOTIONAL (optional) ────────────
  if (input.mensajePromocional) {
    await printer.writeln(input.mensajePromocional, 0, Align.Center);
    await printer.writeln(divider(cols));
  }

  // ── SECTION 6: ACCEPTANCE BLOCK (optional) ───────
  if (input.requiereFirma) {
    await printer.writeln('Nombre: ______________________________');
    await printer.writeln('Cédula: ______________________________');
    await printer.writeln('Fecha:  ______________________________');
    await printer.writeln('Firma:  ______________________________');
    await printer.writeln(divider(cols));
  }

  await printer.feed(3);
  await printer.cutter(Cut.Partial);
  await printer.close();

  return new Uint8Array(connection.buffer());
}
