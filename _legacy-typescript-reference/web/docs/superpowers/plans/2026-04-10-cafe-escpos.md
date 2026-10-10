# CAFE ESC/POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side ESC/POS motor that renders a DGI-compliant CAFE thermal receipt for 58/80mm printers, plus a minimal local daemon that receives the pre-built byte buffer and writes it to the printer device.

**Architecture:** The browser constructs the complete ESC/POS `Uint8Array` using `escpos-buffer` (TypeScript-pure, no Node deps), then POSTs the raw bytes to a localhost daemon — guaranteeing offline/contingency operation even when the Next.js server is unreachable. Formato 1 (A4 PDF) continues to be handled by HKA's `DescargaPDF()` with no changes.

**Tech Stack:** `escpos-buffer`, Jest (jsdom env), TypeScript, Next.js 15 App Router, `features/hka/model/services/cafe.service.ts` (reused)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `features/cafe/model/types/cafe-escpos.types.ts` | Create | `CAFEEscposInput`, `EmisionMode`, `PrintResult` |
| `features/cafe/model/mappers/invoice-to-cafe-escpos.mapper.ts` | Create | `Invoice` model → `CAFEEscposInput`, mode derivation |
| `features/cafe/model/services/cafe-escpos.service.ts` | Create | Builds full ESC/POS `Uint8Array` (6 sections + QR) |
| `features/cafe/infrastructure/print-daemon.client.ts` | Create | `fetch` wrapper to localhost daemon |
| `features/cafe/ui/hooks/use-cafe-print.ts` | Create | Orchestration hook: mapper → builder → daemon |
| `features/cafe/ui/cafe-print-button.tsx` | Create | "Cinta POS" button component |
| `features/invoicing/ui/invoice-detail-view.tsx` | Modify | Add "Cinta POS" button to the certified actions row |
| `packages/cafe-daemon/src/index.ts` | Create | HTTP server: receives buffer → writes to printer device |
| `packages/cafe-daemon/package.json` | Create | Standalone daemon package descriptor |
| `__tests__/features/cafe/cafe-escpos.service.test.ts` | Create | Unit tests for ESC/POS buffer builder |
| `__tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts` | Create | Unit tests for mode derivation mapper |
| `__tests__/features/cafe/print-daemon.client.test.ts` | Create | Unit tests for daemon fetch client |

---

## Task 1: Install `escpos-buffer` and verify browser bundle compatibility

**Files:**
- Modify: `package.json`

- [ ] **Step 1.1: Install the package**

```bash
cd /path/to/repo
pnpm add escpos-buffer
```

Expected: package added to `node_modules/`, `package.json` updated.

- [ ] **Step 1.2: Verify no native Node deps**

```bash
cat node_modules/escpos-buffer/package.json | grep -E '"main"|"module"|"exports"'
# Also check for any native bindings
ls node_modules/escpos-buffer/build 2>/dev/null || echo "no native build — OK"
```

Expected: no `build/` directory with `.node` files.

- [ ] **Step 1.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add escpos-buffer for CAFE thermal receipt rendering"
```

---

## Task 2: Define shared types

**Files:**
- Create: `features/cafe/model/types/cafe-escpos.types.ts`
- Create: `features/cafe/model/types/index.ts`

- [ ] **Step 2.1: Create the types file**

Create `features/cafe/model/types/cafe-escpos.types.ts`:

```typescript
/** Emission mode determines which DGI legal text is printed */
export type EmisionMode = 'SINCRONO' | 'ASINCRONO' | 'CONTINGENCIA';

export interface CAFEEscposItem {
  descripcion: string;
  cantidad: number;
  unidad: string;          // e.g. "UND", "KG", "M2"
  precioUnitario: number;
  itbms: number;
  total: number;
}

export interface CAFEEscposPago {
  metodo: string;          // e.g. "Efectivo", "Tarjeta Débito"
  monto: number;
}

export interface CAFEEscposInput {
  modo: EmisionMode;
  paperWidth: 58 | 80;     // mm — determines char columns (32 or 48)
  printerDpi?: number;     // default 203

  // Document identity
  numeroDocumento: string; // "0001-001-0000000001"
  tipoDocumentoLabel: string; // "FACTURA DE OPERACIÓN INTERNA"
  fechaEmision: Date;
  moneda: string;          // "PAB" | "USD"

  // Parties
  emisorNombre: string;
  emisorRucDv: string;     // "RUC: 123456-1-123456 DV: 28"
  emisorDireccion?: string;
  emisorTelefono?: string;
  receptorNombre: string;
  receptorRucDv?: string;

  // Amounts
  subtotal: number;
  totalITBMS: number;
  descuento?: number;
  totalFactura: number;

  // Line items
  items: CAFEEscposItem[];

  // Payment
  formaPago: CAFEEscposPago[];
  cambio?: number;

  // QR — full DGI verification URL
  qrContent: string;

  // Mode-specific fields
  hkaProtocol?: string;           // SINCRONO: protocol number
  hkaProtocolDate?: Date;         // SINCRONO: authorization date/time
  fechaLimiteTransmision?: Date;  // ASINCRONO | CONTINGENCIA: deadline

  // Optional sections
  mensajePromocional?: string;    // Section 5
  requiereFirma?: boolean;        // Section 6 — acceptance block
}

export interface PrintResult {
  success: boolean;
  error?: string;
}
```

- [ ] **Step 2.2: Create barrel export**

Create `features/cafe/model/types/index.ts`:

```typescript
export type {
  EmisionMode,
  CAFEEscposInput,
  CAFEEscposItem,
  CAFEEscposPago,
  PrintResult,
} from './cafe-escpos.types';
```

- [ ] **Step 2.3: Commit**

```bash
git add features/cafe/
git commit -m "feat(cafe): add CAFEEscposInput types"
```

---

## Task 3: Mapper — Invoice → CAFEEscposInput

**Files:**
- Create: `features/cafe/model/mappers/invoice-to-cafe-escpos.mapper.ts`
- Create: `__tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts`

The mapper derives emission mode from invoice fields:
- `hkaProtocol` is set → `SINCRONO`
- `hkaProtocol` is null AND `fechaLimitePosterior` is set → `ASINCRONO`
- Neither → `CONTINGENCIA`

For CONTINGENCIA, it calls `generarCAFE()` from `cafe.service.ts` to compute the 72h deadline and QR content.

- [ ] **Step 3.1: Write failing tests**

Create `__tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts`:

```typescript
import { invoiceToCAFEEscposInput } from '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper';

const baseItem = {
  id: 'item-1',
  description: 'Producto A',
  quantity: 2,
  unitPrice: 5.00,
  total: 10.00,
  taxAmount: 0.70,
  unit: 'UND',
};

const baseInvoice = {
  id: 'inv-1',
  invoiceNumber: '0000000001',
  documentType: '01' as const,
  issueDate: new Date('2026-04-10T14:00:00'),
  currency: 'PAB',
  issuerName: 'EMPRESA S.A.',
  issuerRuc: '123456-1-123456',
  issuerDv: '28',
  issuerAddress: 'Calle 50, Panamá',
  receiverName: 'JUAN PÉREZ',
  receiverRuc: '8-123-456',
  receiverDv: '7',
  receiverType: 'CONTRIBUTOR',
  subtotal: 10.00,
  itbms: 0.70,
  discount: 0,
  total: 10.70,
  paymentMethod: 'CASH',
  qrUrl: 'https://efact.mef.gob.pa/receiverfe/servlet/qr?cufe=abc',
  cufeLocal: 'a'.repeat(64),
  codigoSucursal: '0001',
  puntoFacturacion: '001',
  numeroDocumentoFiscal: '0000000001',
  items: [baseItem],
  // Mode signals
  hkaProtocol: null,
  hkaProtocolDate: null,
  fechaLimitePosterior: null,
};

describe('invoiceToCAFEEscposInput', () => {
  const opts = { paperWidth: 80 as const };

  it('sets mode SINCRONO when hkaProtocol is present', () => {
    const inv = { ...baseInvoice, hkaProtocol: 'PROT-001', hkaProtocolDate: new Date('2026-04-10T14:01:00') };
    const result = invoiceToCAFEEscposInput(inv as any, opts);
    expect(result.modo).toBe('SINCRONO');
    expect(result.hkaProtocol).toBe('PROT-001');
  });

  it('sets mode ASINCRONO when fechaLimitePosterior is set and no hkaProtocol', () => {
    const inv = { ...baseInvoice, fechaLimitePosterior: new Date('2026-04-11T17:00:00') };
    const result = invoiceToCAFEEscposInput(inv as any, opts);
    expect(result.modo).toBe('ASINCRONO');
    expect(result.fechaLimiteTransmision).toEqual(new Date('2026-04-11T17:00:00'));
  });

  it('sets mode CONTINGENCIA when neither hkaProtocol nor fechaLimitePosterior', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice as any, opts);
    expect(result.modo).toBe('CONTINGENCIA');
    expect(result.fechaLimiteTransmision).toBeDefined();
  });

  it('maps item fields including unit', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice as any, opts);
    expect(result.items[0]).toMatchObject({
      descripcion: 'Producto A',
      cantidad: 2,
      unidad: 'UND',
      precioUnitario: 5.00,
      itbms: 0.70,
      total: 10.00,
    });
  });

  it('sets paperWidth from options', () => {
    const result = invoiceToCAFEEscposInput(baseInvoice as any, { paperWidth: 58 });
    expect(result.paperWidth).toBe(58);
  });
});
```

- [ ] **Step 3.2: Run to verify they fail**

```bash
npx jest __tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/features/cafe/model/mappers/invoice-to-cafe-escpos.mapper'"

- [ ] **Step 3.3: Implement the mapper**

Create `features/cafe/model/mappers/invoice-to-cafe-escpos.mapper.ts`:

```typescript
import { generarCAFE } from '@/features/hka/model/services/cafe.service';
import type { CAFEEscposInput, EmisionMode } from '../types';

// The Invoice type passed here is the shape coming from the DB / detail view.
// We use a loose interface to avoid coupling to Prisma's generated types.
interface InvoiceForCAFE {
  id: string;
  invoiceNumber?: string | null;
  documentType: string;
  issueDate: Date;
  currency: string;
  issuerName: string;
  issuerRuc: string;
  issuerDv: string;
  issuerAddress?: string | null;
  issuerPhone?: string | null;
  receiverName: string;
  receiverRuc?: string | null;
  receiverDv?: string | null;
  receiverType?: string | null;
  subtotal: number;
  itbms: number;
  discount?: number | null;
  total: number;
  paymentMethod?: string | null;
  qrUrl?: string | null;
  cufeLocal?: string | null;
  cufe?: string | null;
  codigoSucursal?: string | null;
  puntoFacturacion?: string | null;
  numeroDocumentoFiscal?: string | null;
  hkaProtocol?: string | null;
  hkaProtocolDate?: Date | null;
  fechaLimitePosterior?: Date | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxAmount: number;
    unit?: string | null;
  }>;
}

const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  '01': 'FACTURA DE OPERACIÓN INTERNA',
  '02': 'FACTURA DE IMPORTACIÓN',
  '03': 'FACTURA DE EXPORTACIÓN',
  '04': 'NOTA DE CRÉDITO',
  '05': 'NOTA DE DÉBITO',
  '06': 'NOTA DE CRÉDITO GENÉRICA',
  '07': 'NOTA DE DÉBITO GENÉRICA',
  '08': 'FACTURA DE ZONA FRANCA',
  '09': 'REEMBOLSO',
  '10': 'FACTURA DE OPERACIÓN EXTRANJERA',
};

function deriveMode(invoice: InvoiceForCAFE): EmisionMode {
  if (invoice.hkaProtocol) return 'SINCRONO';
  if (invoice.fechaLimitePosterior) return 'ASINCRONO';
  return 'CONTINGENCIA';
}

export function invoiceToCAFEEscposInput(
  invoice: InvoiceForCAFE,
  options: { paperWidth: 58 | 80; printerDpi?: number }
): CAFEEscposInput {
  const modo = deriveMode(invoice);
  const cufe = invoice.cufe ?? invoice.cufeLocal ?? '';

  // For CONTINGENCIA, use cafe.service to get fechaLimite + QR content
  let qrContent = invoice.qrUrl ?? '';
  let fechaLimiteTransmision: Date | undefined;

  if (modo === 'CONTINGENCIA') {
    const cafeResult = generarCAFE({
      cufe,
      tipoDocumento: invoice.documentType as any,
      numeroDocumentoFiscal: invoice.numeroDocumentoFiscal ?? '0000000001',
      codigoSucursal: invoice.codigoSucursal ?? '0001',
      puntoFacturacion: invoice.puntoFacturacion ?? '001',
      tipoEmision: '02',
      fechaInicioContingencia: invoice.issueDate,
      motivoContingencia: 'Operación en contingencia por falla de conectividad.',
      fechaEmision: invoice.issueDate,
      moneda: invoice.currency,
      totalFactura: invoice.total,
      totalITBMS: invoice.itbms,
      emisor: {
        nombre: invoice.issuerName,
        ruc: invoice.issuerRuc,
        dv: invoice.issuerDv,
        direccion: invoice.issuerAddress ?? undefined,
      },
      receptor: {
        nombre: invoice.receiverName,
        ruc: invoice.receiverRuc ?? undefined,
        dv: invoice.receiverDv ?? undefined,
      },
      ambiente: '1',
    });
    qrContent = cafeResult.qrContent;
    fechaLimiteTransmision = cafeResult.fechaLimiteTransmision;
  } else if (modo === 'ASINCRONO' && invoice.fechaLimitePosterior) {
    fechaLimiteTransmision = new Date(invoice.fechaLimitePosterior);
  }

  const items = invoice.items.map((item) => ({
    descripcion: item.description,
    cantidad: item.quantity,
    unidad: item.unit ?? 'UND',
    precioUnitario: item.unitPrice,
    itbms: item.taxAmount,
    total: item.total,
  }));

  const formaPago = invoice.paymentMethod
    ? [{ metodo: invoice.paymentMethod, monto: invoice.total }]
    : [];

  return {
    modo,
    paperWidth: options.paperWidth,
    printerDpi: options.printerDpi ?? 203,
    numeroDocumento: invoice.numeroDocumentoFiscal ?? invoice.invoiceNumber ?? invoice.id,
    tipoDocumentoLabel: TIPO_DOCUMENTO_LABEL[invoice.documentType] ?? 'FACTURA',
    fechaEmision: invoice.issueDate,
    moneda: invoice.currency,
    emisorNombre: invoice.issuerName,
    emisorRucDv: `RUC: ${invoice.issuerRuc} DV: ${invoice.issuerDv}`,
    emisorDireccion: invoice.issuerAddress ?? undefined,
    emisorTelefono: invoice.issuerPhone ?? undefined,
    receptorNombre: invoice.receiverName,
    receptorRucDv:
      invoice.receiverRuc && invoice.receiverDv
        ? `RUC: ${invoice.receiverRuc} DV: ${invoice.receiverDv}`
        : undefined,
    subtotal: invoice.subtotal,
    totalITBMS: invoice.itbms,
    descuento: invoice.discount ?? undefined,
    totalFactura: invoice.total,
    items,
    formaPago,
    qrContent,
    hkaProtocol: invoice.hkaProtocol ?? undefined,
    hkaProtocolDate: invoice.hkaProtocolDate ?? undefined,
    fechaLimiteTransmision,
  };
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npx jest __tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts --no-coverage
```

Expected: 5 tests PASS

- [ ] **Step 3.5: Commit**

```bash
git add features/cafe/ __tests__/features/cafe/invoice-to-cafe-escpos.mapper.test.ts
git commit -m "feat(cafe): add invoice-to-cafe-escpos mapper with mode derivation"
```

---

## Task 4: ESC/POS Service — core buffer builder

**Files:**
- Create: `features/cafe/model/services/cafe-escpos.service.ts`
- Create: `__tests__/features/cafe/cafe-escpos.service.test.ts`

This is the heart of the feature. It uses `escpos-buffer` to produce a complete `Uint8Array` with all 6 CAFE sections. The service must be callable in a browser (no Node-only APIs).

> **Reference:** `escpos-buffer` API — `Printer`, `Align`, `Font`, `Style`, `Image`, `QRCode`. Key methods: `printer.align(Align.CT)`, `printer.style(Style.BOLD)`, `printer.text(str)`, `printer.feed(n)`, `printer.qrcode(content, { size, correction })`, `printer.cut()`, `printer.flush()` → returns `Buffer`/`Uint8Array`.

- [ ] **Step 4.1: Write failing tests**

Create `__tests__/features/cafe/cafe-escpos.service.test.ts`:

```typescript
import { buildCafeEscposBuffer } from '@/features/cafe/model/services/cafe-escpos.service';
import type { CAFEEscposInput } from '@/features/cafe/model/types';

// Minimal valid input
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
    { descripcion: 'Producto A', cantidad: 2, unidad: 'UND', precioUnitario: 50.00, itbms: 3.50, total: 100.00 },
  ],
  formaPago: [{ metodo: 'Efectivo', monto: 110.00 }],
  cambio: 3.00,
  qrContent: 'https://efact.mef.gob.pa/receiverfe/servlet/qr?cufe=abc123',
  hkaProtocol: 'PROT-20260410-001',
  hkaProtocolDate: new Date('2026-04-10T14:01:00'),
};

describe('buildCafeEscposBuffer', () => {
  it('returns a non-empty Uint8Array', () => {
    const buf = buildCafeEscposBuffer(baseInput);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(10);
  });

  it('buffer starts with ESC @ (printer initialize command)', () => {
    const buf = buildCafeEscposBuffer(baseInput);
    // ESC @ = 0x1B 0x40
    expect(buf[0]).toBe(0x1b);
    expect(buf[1]).toBe(0x40);
  });

  it('SINCRONO legal text includes exact DGI-mandated phrase', () => {
    const buf = buildCafeEscposBuffer(baseInput);
    const text = Buffer.from(buf).toString('latin1');
    expect(text).toContain('Protocolo de autorización');
    expect(text).toContain('PROT-20260410-001');
  });

  it('ASINCRONO legal text includes full "DIRECCIÓN GENERAL DE INGRESOS"', () => {
    const input: CAFEEscposInput = {
      ...baseInput,
      modo: 'ASINCRONO',
      hkaProtocol: undefined,
      hkaProtocolDate: undefined,
      fechaLimiteTransmision: new Date('2026-04-11T17:00:00'),
    };
    const buf = buildCafeEscposBuffer(input);
    const text = Buffer.from(buf).toString('latin1');
    expect(text).toContain('CAFE de emisión previa');
    expect(text).toContain('DIRECCIÓN GENERAL DE INGRESOS');
    expect(text).toContain('11/04/2026');
  });

  it('CONTINGENCIA legal text includes full "DIRECCIÓN GENERAL DE INGRESOS"', () => {
    const input: CAFEEscposInput = {
      ...baseInput,
      modo: 'CONTINGENCIA',
      hkaProtocol: undefined,
      hkaProtocolDate: undefined,
      fechaLimiteTransmision: new Date('2026-04-13T14:00:00'),
    };
    const buf = buildCafeEscposBuffer(input);
    const text = Buffer.from(buf).toString('latin1');
    expect(text).toContain('CAFE emitido durante operación en contingencia');
    expect(text).toContain('DIRECCIÓN GENERAL DE INGRESOS');
    expect(text).toContain('13/04/2026');
  });

  it('item line concatenates cantidad and unidad', () => {
    const buf = buildCafeEscposBuffer(baseInput);
    const text = Buffer.from(buf).toString('latin1');
    expect(text).toContain('2 UND');
  });

  it('includes QR byte sequence (GS ( k)', () => {
    const buf = buildCafeEscposBuffer(baseInput);
    // GS ( k = 0x1D 0x28 0x6B — start of QR function commands
    const bytes = Array.from(buf);
    const gsIdx = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b);
    expect(gsIdx).toBeGreaterThan(-1);
  });

  it('works with 58mm paper width', () => {
    const buf = buildCafeEscposBuffer({ ...baseInput, paperWidth: 58 });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 4.2: Run to verify they fail**

```bash
npx jest __tests__/features/cafe/cafe-escpos.service.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/features/cafe/model/services/cafe-escpos.service'"

- [ ] **Step 4.3: Implement the ESC/POS service**

Create `features/cafe/model/services/cafe-escpos.service.ts`:

```typescript
'use client';

import { Printer, Align, Style, Font, QRCodeErrorCorrectionLevel } from 'escpos-buffer';
import type { CAFEEscposInput, CAFEEscposItem, CAFEEscposPago } from '../types';

// Char columns per paper width
const COLS: Record<58 | 80, number> = { 58: 32, 80: 48 };

// ──────────────────────────────────────────────
// QR module size calculation
// DGI requires ≥25mm total (22mm content + 3mm quiet zone)
// moduleSize = ceil(22mm * (dpi/25.4mm) / modules_per_side)
// Safe default: size=7 at 203dpi for ~v4-v5 QR content
// ──────────────────────────────────────────────
function calcQRModuleSize(dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  const targetContentDots = 22 * dotsPerMm;
  // Conservative estimate: assume QR v5 (37 modules/side) for long DGI URLs
  const modules = 37;
  return Math.max(7, Math.ceil(targetContentDots / modules));
}

// Date formatter: DD/MM/YYYY HH:mm:ss
function fmt(d: Date): string {
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mm}:${ss}`;
}

function fmtMoney(n: number): string {
  return `B/. ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Pad string to width, truncating if needed
function col(str: string, width: number, align: 'l' | 'r' = 'l'): string {
  const s = str.slice(0, width);
  return align === 'l' ? s.padEnd(width) : s.padStart(width);
}

// Two-column line: left text + right text within total cols
function twoCol(left: string, right: string, cols: number): string {
  const rightWidth = right.length;
  const leftWidth = cols - rightWidth - 1;
  return col(left, leftWidth) + ' ' + right;
}

function divider(cols: number): string {
  return '-'.repeat(cols);
}

function legalText(input: CAFEEscposInput): string {
  if (input.modo === 'SINCRONO') {
    const dateStr = input.hkaProtocolDate ? fmt(input.hkaProtocolDate) : '';
    return `Protocolo de autorización: ${input.hkaProtocol}, de ${dateStr}`;
  }
  if (input.modo === 'ASINCRONO') {
    const deadline = input.fechaLimiteTransmision ? fmt(input.fechaLimiteTransmision) : '';
    return `CAFE de emisión previa, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta ${deadline}`;
  }
  // CONTINGENCIA
  const deadline = input.fechaLimiteTransmision ? fmt(input.fechaLimiteTransmision) : '';
  return `CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta ${deadline}`;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
export function buildCafeEscposBuffer(input: CAFEEscposInput): Uint8Array {
  const cols = COLS[input.paperWidth];
  const dpi = input.printerDpi ?? 203;
  const moduleSize = calcQRModuleSize(dpi);

  const printer = new Printer(cols);

  // ─── INITIALIZE ───────────────────────────────
  printer.initialize();

  // ─── SECTION 1: HEADER ────────────────────────
  printer.align(Align.CT);
  printer.style(Style.BOLD);
  printer.text('COMPROBANTE AUXILIAR DE');
  printer.text('FACTURA ELECTRÓNICA');
  printer.style(Style.NONE);
  printer.text(input.tipoDocumentoLabel);
  printer.feed(1);

  printer.align(Align.LT);
  printer.text(divider(cols));
  printer.text(input.emisorNombre);
  printer.text(input.emisorRucDv);
  if (input.emisorDireccion) printer.text(input.emisorDireccion);
  if (input.emisorTelefono) printer.text(`Tel: ${input.emisorTelefono}`);
  printer.text(divider(cols));

  printer.text(`Cliente: ${input.receptorNombre}`);
  if (input.receptorRucDv) printer.text(input.receptorRucDv);
  printer.text(divider(cols));

  // Date formatted as DD/MM/YYYY HH:mm
  const d = input.fechaEmision;
  const dateLabel = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  printer.text(twoCol('N°:', input.numeroDocumento, cols));
  printer.text(twoCol('Fecha:', dateLabel, cols));
  printer.text(twoCol('Moneda:', input.moneda, cols));
  printer.text(divider(cols));

  // ─── SECTION 2: ITEM DETAIL ────────────────────
  // Header row
  const descWidth = cols - 20;
  printer.style(Style.BOLD);
  printer.text(`${'Descripción'.padEnd(descWidth)}${'Cant'.padStart(6)}${'Total'.padStart(10)}${'ITBMS'.padStart(4)}`);
  printer.style(Style.NONE);
  printer.text(divider(cols));

  for (const item of input.items) {
    // Cantidad + unidad concatenated per DGI Formato 2 guidance
    const cantUnidad = `${item.cantidad} ${item.unidad}`;
    const totalStr = fmtMoney(item.total).padStart(10);
    const itbmsStr = fmtMoney(item.itbms).padStart(4);
    // Description may wrap — truncate to descWidth for simplicity
    printer.text(`${col(item.descripcion, descWidth)}${cantUnidad.padStart(6)}${totalStr}${itbmsStr}`);
  }

  printer.text(divider(cols));

  // ─── SECTION 3: TOTALS & PAYMENT ──────────────
  printer.text(twoCol('Subtotal:', fmtMoney(input.subtotal), cols));
  if (input.descuento) printer.text(twoCol('Descuento:', `-${fmtMoney(input.descuento)}`, cols));
  printer.text(twoCol('ITBMS:', fmtMoney(input.totalITBMS), cols));
  printer.text(divider(cols));
  printer.style(Style.BOLD);
  printer.text(twoCol('TOTAL:', fmtMoney(input.totalFactura), cols));
  printer.style(Style.NONE);
  printer.text(divider(cols));

  printer.text('Forma de Pago:');
  for (const pago of input.formaPago) {
    printer.text(twoCol(pago.metodo + ':', fmtMoney(pago.monto), cols));
  }
  if (input.cambio !== undefined) {
    printer.text(twoCol('Vuelto:', fmtMoney(input.cambio), cols));
  }
  printer.text(divider(cols));

  // ─── SECTION 4: DGI CONSULTATION ──────────────
  printer.align(Align.CT);
  printer.text('Consulte en: efact.mef.gob.pa');
  printer.feed(1);

  // QR Code — DGI mandated: UTF-8, Level M, ≥25mm
  printer.qrcode(input.qrContent, {
    size: moduleSize,
    correction: QRCodeErrorCorrectionLevel.M,
  });
  printer.feed(1);

  printer.align(Align.LT);
  // Word-wrap legal text to cols
  const legal = legalText(input);
  const words = legal.split(' ');
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > cols) {
      printer.text(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) printer.text(line);
  printer.text(divider(cols));

  // ─── SECTION 5: PROMOTIONAL (optional) ────────
  if (input.mensajePromocional) {
    printer.align(Align.CT);
    printer.text(input.mensajePromocional);
    printer.text(divider(cols));
  }

  // ─── SECTION 6: ACCEPTANCE (optional) ─────────
  if (input.requiereFirma) {
    printer.align(Align.LT);
    printer.text('Nombre: ______________________________');
    printer.text('Cédula: ______________________________');
    printer.text('Fecha:  ______________________________');
    printer.text('Firma:  ______________________________');
    printer.text(divider(cols));
  }

  printer.feed(3);
  printer.cut();

  const raw = printer.flush();
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}
```

- [ ] **Step 4.4: Run tests**

```bash
npx jest __tests__/features/cafe/cafe-escpos.service.test.ts --no-coverage
```

Expected: 8 tests PASS. If `escpos-buffer` API differs (e.g., method name, enum import), adjust imports to match the installed version's exported API — check `node_modules/escpos-buffer/src/index.ts`.

- [ ] **Step 4.5: Commit**

```bash
git add features/cafe/model/services/ __tests__/features/cafe/cafe-escpos.service.test.ts
git commit -m "feat(cafe): implement ESC/POS buffer builder with 6 CAFE sections and QR"
```

---

## Task 5: Daemon fetch client

**Files:**
- Create: `features/cafe/infrastructure/print-daemon.client.ts`
- Create: `__tests__/features/cafe/print-daemon.client.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `__tests__/features/cafe/print-daemon.client.test.ts`:

```typescript
import { sendToPrintDaemon } from '@/features/cafe/infrastructure/print-daemon.client';

const mockBuffer = new Uint8Array([0x1b, 0x40, 0x0a]);

describe('sendToPrintDaemon', () => {
  afterEach(() => jest.restoreAllMocks());

  it('POSTs buffer to localhost with octet-stream content type', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

    const result = await sendToPrintDaemon(mockBuffer, { port: 9876 });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9876/print',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/octet-stream' }),
        body: mockBuffer,
      })
    );
    expect(result.success).toBe(true);
  });

  it('returns success:false on 503', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as any);
    const result = await sendToPrintDaemon(mockBuffer);
    expect(result.success).toBe(false);
    expect(result.error).toContain('503');
  });

  it('returns success:false on network error (daemon offline)', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await sendToPrintDaemon(mockBuffer);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('uses default port 9876', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await sendToPrintDaemon(mockBuffer);
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:9876/print');
  });
});
```

- [ ] **Step 5.2: Run to verify they fail**

```bash
npx jest __tests__/features/cafe/print-daemon.client.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 5.3: Implement daemon client**

Create `features/cafe/infrastructure/print-daemon.client.ts`:

```typescript
import type { PrintResult } from '../model/types';

const DEFAULT_PORT = 9876;
const DEFAULT_TIMEOUT_MS = 3000;

export async function sendToPrintDaemon(
  buffer: Uint8Array,
  options?: { port?: number; timeoutMs?: number }
): Promise<PrintResult> {
  const port = options?.port ?? DEFAULT_PORT;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`http://localhost:${port}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
      signal: controller.signal,
    });

    if (!res.ok) {
      return { success: false, error: `Daemon respondió con estado ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Daemon no disponible: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5.4: Run tests**

```bash
npx jest __tests__/features/cafe/print-daemon.client.test.ts --no-coverage
```

Expected: 4 tests PASS

- [ ] **Step 5.5: Commit**

```bash
git add features/cafe/infrastructure/ __tests__/features/cafe/print-daemon.client.test.ts
git commit -m "feat(cafe): add print-daemon fetch client with timeout and error handling"
```

---

## Task 6: `useCafePrint` hook

**Files:**
- Create: `features/cafe/ui/hooks/use-cafe-print.ts`

No unit test needed here — the hook is a thin orchestration layer over already-tested units. Integration coverage comes from E2E.

- [ ] **Step 6.1: Create the hook**

Create `features/cafe/ui/hooks/use-cafe-print.ts`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { invoiceToCAFEEscposInput } from '../../model/mappers/invoice-to-cafe-escpos.mapper';
import { buildCafeEscposBuffer } from '../../model/services/cafe-escpos.service';
import { sendToPrintDaemon } from '../../infrastructure/print-daemon.client';
import type { PrintResult } from '../../model/types';

interface UseCafePrintOptions {
  paperWidth?: 58 | 80;
  printerDpi?: number;
  daemonPort?: number;
}

export function useCafePrint(options: UseCafePrintOptions = {}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const printCafe = useCallback(
    async (invoice: Parameters<typeof invoiceToCAFEEscposInput>[0]): Promise<PrintResult> => {
      setIsPrinting(true);
      setLastError(null);

      try {
        const input = invoiceToCAFEEscposInput(invoice, {
          paperWidth: options.paperWidth ?? 80,
          printerDpi: options.printerDpi,
        });

        const buffer = buildCafeEscposBuffer(input);

        const result = await sendToPrintDaemon(buffer, { port: options.daemonPort });

        if (!result.success) {
          setLastError(result.error ?? 'Error desconocido al imprimir');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado al generar CAFE';
        setLastError(message);
        return { success: false, error: message };
      } finally {
        setIsPrinting(false);
      }
    },
    [options.paperWidth, options.printerDpi, options.daemonPort]
  );

  return { printCafe, isPrinting, lastError };
}
```

- [ ] **Step 6.2: Commit**

```bash
git add features/cafe/ui/hooks/
git commit -m "feat(cafe): add useCafePrint hook"
```

---

## Task 7: `CafePrintButton` component

**Files:**
- Create: `features/cafe/ui/cafe-print-button.tsx`

- [ ] **Step 7.1: Create the button**

Create `features/cafe/ui/cafe-print-button.tsx`:

```typescript
'use client';

import { Printer, Loader2 } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { useCafePrint } from './hooks/use-cafe-print';

interface CafePrintButtonProps {
  invoice: Parameters<ReturnType<typeof useCafePrint>['printCafe']>[0];
  paperWidth?: 58 | 80;
}

export function CafePrintButton({ invoice, paperWidth = 80 }: CafePrintButtonProps) {
  const { toast } = useToast();
  const { printCafe, isPrinting } = useCafePrint({ paperWidth });

  const handleClick = async () => {
    const result = await printCafe(invoice);
    if (result.success) {
      toast({ title: 'Cinta impresa', description: 'CAFE enviado a la impresora.' });
    } else {
      toast({
        title: 'Sin impresora',
        description: result.error ?? 'El daemon no responde — verifica que esté activo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPrinting}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-700 active:scale-95 transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      <div className="text-teal-500 group-hover:text-teal-400 transition-colors">
        {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Cinta POS</span>
    </button>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add features/cafe/ui/cafe-print-button.tsx
git commit -m "feat(cafe): add CafePrintButton component"
```

---

## Task 8: Integrate button into invoice detail view

**Files:**
- Modify: `features/invoicing/ui/invoice-detail-view.tsx`

The existing component has an action row at lines 328–343 with PDF and Email buttons. We add "Cinta POS" next to them.

The `InvoiceDetailViewProps.invoice` interface also needs the fields the mapper requires (`issuerName`, `issuerRuc`, `issuerDv`, `issuerAddress`, `hkaProtocol`, `hkaProtocolDate`, `items[].unit`, `documentType`, `codigoSucursal`, `puntoFacturacion`, `numeroDocumentoFiscal`, `cufeLocal`).

- [ ] **Step 8.1: Add missing fields to the props interface**

In `features/invoicing/ui/invoice-detail-view.tsx`, update the `invoice` prop type (around line 26):

```typescript
interface InvoiceDetailViewProps {
    invoice: {
        id: string;
        folio?: string;
        invoiceNumber?: string;
        documentType?: string;       // ADD
        cufe?: string;
        cufeLocal?: string;          // ADD
        cafe?: string;
        qrCode?: string;
        qrUrl?: string;
        status: string;
        total: number;
        subtotal: number;
        itbms: number;
        discount?: number;           // ADD
        currency: string;
        issueDate: Date;
        createdAt: Date;
        emittedAt?: Date;
        receiverName: string;
        receiverRuc?: string;
        receiverDv?: string;
        receiverEmail?: string;
        receiverType?: string;
        fechaLimitePosterior?: Date | null;
        // Issuer fields for CAFE                 ADD block below
        issuerName?: string;
        issuerRuc?: string;
        issuerDv?: string;
        issuerAddress?: string;
        issuerPhone?: string;
        // Fiscal fields for CAFE                 ADD block below
        codigoSucursal?: string;
        puntoFacturacion?: string;
        numeroDocumentoFiscal?: string;
        hkaProtocol?: string;
        hkaProtocolDate?: Date;
        paymentMethod?: string;
        items: Array<{
            id: string;
            description: string;
            quantity: number;
            unitPrice: number;
            total: number;
            taxAmount: number;
            unit?: string;           // ADD
        }>;
    };
}
```

- [ ] **Step 8.2: Add the import and the button to the actions row**

At the top of the file (after existing imports), add:

```typescript
import { CafePrintButton } from '@/features/cafe/ui/cafe-print-button';
```

In the `isCertified` action row (replace the existing `<div className="flex items-center gap-2">` block at ~line 329):

```typescript
{isCertified && (
    <div className="flex items-center gap-2">
        <ActionButton
            icon={<Download className="w-4 h-4" />}
            label="PDF"
            onClick={handleDownloadPdf}
            loading={isDownloadingPdf}
        />
        <ActionButton
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            onClick={handleSendEmail}
            loading={isSendingEmail}
        />
        <CafePrintButton invoice={invoice} />
    </div>
)}
```

- [ ] **Step 8.3: Run the full test suite to ensure no regressions**

```bash
npx jest --no-coverage --testPathPattern="invoicing|cafe"
```

Expected: all pass (or pre-existing failures only — do not introduce new ones)

- [ ] **Step 8.4: Commit**

```bash
git add features/invoicing/ui/invoice-detail-view.tsx features/cafe/
git commit -m "feat(cafe): integrate CafePrintButton into invoice detail view"
```

---

## Task 9: Standalone daemon

**Files:**
- Create: `packages/cafe-daemon/package.json`
- Create: `packages/cafe-daemon/src/index.ts`
- Create: `packages/cafe-daemon/README.md`

- [ ] **Step 9.1: Create package descriptor**

Create `packages/cafe-daemon/package.json`:

```json
{
  "name": "@plentypay/cafe-daemon",
  "version": "1.0.0",
  "description": "Local HTTP daemon that receives ESC/POS buffers and writes them to a thermal printer device",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "build": "tsc --outDir dist --module commonjs --target es2020 --esModuleInterop"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 9.2: Implement the daemon**

Create `packages/cafe-daemon/src/index.ts`:

```typescript
import http from 'http';
import fs from 'fs';

const PORT = parseInt(process.env.CAFE_DAEMON_PORT ?? '9876', 10);
const DEVICE = process.env.CAFE_PRINTER_DEVICE ?? '/dev/usb/lp0';

const server = http.createServer((req, res) => {
  // CORS for localhost web origin
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/print') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      res.writeHead(400);
      res.end('Empty buffer');
      return;
    }

    // Verify printer device is accessible before writing
    fs.access(DEVICE, fs.constants.W_OK, (accessErr) => {
      if (accessErr) {
        console.error(`[cafe-daemon] Printer device not accessible: ${DEVICE}`, accessErr.message);
        res.writeHead(503);
        res.end(`Printer device not accessible: ${DEVICE}`);
        return;
      }

      fs.open(DEVICE, 'w', (openErr, fd) => {
        if (openErr) {
          console.error(`[cafe-daemon] Failed to open device:`, openErr.message);
          res.writeHead(503);
          res.end(`Failed to open printer device`);
          return;
        }

        fs.write(fd, buffer, (writeErr) => {
          fs.close(fd, () => {});
          if (writeErr) {
            console.error(`[cafe-daemon] Write error:`, writeErr.message);
            res.writeHead(500);
            res.end('Write error');
            return;
          }
          console.log(`[cafe-daemon] Printed ${buffer.length} bytes to ${DEVICE}`);
          res.writeHead(200);
          res.end('OK');
        });
      });
    });
  });

  req.on('error', (err) => {
    console.error('[cafe-daemon] Request error:', err.message);
    res.writeHead(500);
    res.end('Request error');
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[cafe-daemon] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[cafe-daemon] Printer device: ${DEVICE}`);
});
```

- [ ] **Step 9.3: Create README**

Create `packages/cafe-daemon/README.md`:

```markdown
# cafe-daemon

Local HTTP server that receives raw ESC/POS byte buffers and writes them to a thermal printer device.

## Setup

```bash
# Install dependencies
npm install

# Start (development)
npm run dev

# Build + start (production)
npm run build && npm start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CAFE_PRINTER_DEVICE` | `/dev/usb/lp0` | Printer device path (Linux: `/dev/usb/lp0`, Windows: `\\.\COM3`) |
| `CAFE_DAEMON_PORT` | `9876` | Port to listen on (localhost only) |

## Linux systemd service

Create `/etc/systemd/system/cafe-daemon.service`:

```ini
[Unit]
Description=PlentyPay CAFE Thermal Printer Daemon
After=network.target

[Service]
Type=simple
User=cashier
WorkingDirectory=/opt/cafe-daemon
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=CAFE_PRINTER_DEVICE=/dev/usb/lp0
Environment=CAFE_DAEMON_PORT=9876

[Install]
WantedBy=multi-user.target
```

Then: `systemctl enable cafe-daemon && systemctl start cafe-daemon`

## HTTP Contract

```
POST http://localhost:9876/print
Content-Type: application/octet-stream
Body: raw ESC/POS bytes

200 OK               → printed
400 Bad Request      → empty buffer
503 Service Unavail  → printer device not accessible
```
```

- [ ] **Step 9.4: Commit**

```bash
git add packages/cafe-daemon/
git commit -m "feat(cafe-daemon): add standalone HTTP daemon for ESC/POS printer output"
```

---

## Task 10: Run full test suite and verify

- [ ] **Step 10.1: Run all CAFE tests**

```bash
npx jest --no-coverage --testPathPattern="cafe"
```

Expected: all pass.

- [ ] **Step 10.2: Run full suite to catch regressions**

```bash
npx jest --no-coverage
```

Expected: no new failures.

- [ ] **Step 10.3: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors in `features/cafe/` or modified files.

- [ ] **Step 10.4: Final commit if any lint fixes needed**

```bash
git add -p   # review and stage only cafe-related changes
git commit -m "fix(cafe): address lint/type warnings from full suite run"
```

---

## Verification Checklist (Manual)

After implementation is complete, verify end-to-end:

1. **Daemon up:** `cd packages/cafe-daemon && npm run dev` → see `Listening on http://127.0.0.1:9876`
2. **Test print:** Open an EMITTED invoice in `/dashboard/facturas` → click "Cinta POS" → receipt prints
3. **Legal text SINCRONO:** Verify printed text contains "Protocolo de autorización: [num], de [fecha]"
4. **Legal text ASINCRONO:** Use a B2C invoice with `fechaLimitePosterior` → verify "CAFE de emisión previa, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta [fecha]"
5. **QR readability:** Scan QR with a phone → must open DGI verification URL
6. **QR size:** Measure printed QR on paper → must be ≥ 25mm wide
7. **Daemon offline graceful fail:** Stop daemon → click "Cinta POS" → toast appears, invoice flow not blocked
8. **58mm paper:** Change `paperWidth` to 58 → verify 32-col layout wraps correctly
