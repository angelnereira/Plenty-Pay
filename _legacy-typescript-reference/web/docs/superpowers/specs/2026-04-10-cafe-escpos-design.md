# CAFE ESC/POS — Design Spec

**Date:** 2026-04-10  
**Branch:** setup-staging-environment-ODcO9  
**Status:** Approved

---

## Problem

Panama's DGI requires every Electronic Invoice to be accompanied by a CAFE (Comprobante Auxiliar de Factura Electrónica) — the physical receipt the customer receives. The current system handles Formato 1 (A4 PDF) by delegating to HKA's `DescargaPDF()`. Two scenarios are not covered:

1. **POS checkout speed**: Downloading and rasterizing a SOAP-returned Base64 PDF for a thermal printer is too slow for a checkout queue. The DGI allows printing a Formato 2 (thermal strip) directly from local data.
2. **Offline / Contingency**: When internet is down, HKA is unreachable. The POS must print a CAFE locally with DGI-mandated contingency legal text.

An existing `features/hka/model/services/cafe.service.ts` already computes QR content, legal contingency texts, and date limits. What's missing is the ESC/POS rendering layer, the daemon communication client, and the UI integration.

---

## Decision: Hybrid Architecture

| Format | Who Renders | When |
|---|---|---|
| Formato 1 (A4 PDF) | HKA `DescargaPDF()` | On demand for certified invoices — existing flow, no changes |
| Formato 2 (Cinta térmica 58/80mm) | Local ESC/POS motor in browser | POS auto-print on certification + on-demand re-print |
| Formato 2 in Contingency | Local ESC/POS motor in browser | Mandatory when HKA unreachable |

**Why `window.print()` is rejected:** Browsers apply uncontrollable scaling that alters physical QR dimensions. The DGI requires QR ≥ 25mm wide; browser-scaled output cannot guarantee this. Additionally, `window.print()` blocks the checkout flow with a dialog.

**Why buffer builds in the browser (not a Server Action):** `escpos-buffer` is TypeScript-pure with no Node native deps. Running it client-side means the POS can print even when Vercel/Next.js is unreachable — the only runtime dependency is the local daemon.

---

## Architecture

```
                ┌──────────────────────────────────────────┐
                │           Browser (POS / Dashboard)       │
                │                                          │
invoice data ──►│  invoice-to-cafe-escpos.mapper.ts        │
                │  (Invoice → CAFEEscposInput)              │
                │           ↓                              │
                │  cafe-escpos.service.ts                  │
                │  (escpos-buffer, CLIENT-SIDE)             │
                │           ↓ Uint8Array                   │
                │  print-daemon.client.ts                  │
                │  fetch → http://localhost:9876/print      │
                └──────────────┬───────────────────────────┘
                               │ POST (raw bytes, octet-stream)
                       ┌───────▼──────────────┐
                       │  cafe-daemon          │
                       │  (standalone Node/Bun)│
                       │  /dev/usb/lp0 or      │
                       │  TCP 9100             │
                       └──────────────────────┘
```

---

## Emission Modes & DGI Legal Text

The ESC/POS builder determines the emission mode and injects the exact DGI-mandated literal text.

### SINCRONO (B2B — pre-authorization)
**Invoice signal:** `invoice.hkaProtocol` is populated.  
**Printed text:**
```
Protocolo de autorización: {hkaProtocol}, de {dd/mm/aaaa hh:mm:ss}
```

### ASINCRONO (B2C Mostrador — post-authorization)
**Invoice signal:** `receiverType === 'FINAL_CONSUMER'` and `fechaLimitePosterior` is set.  
**Deadline:** Last business hour of the next business day after `issueDate`.  
**Printed text (exact literal per DGI):**
```
CAFE de emisión previa, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta {dd/mm/aaaa hh:mm:ss}
```

### CONTINGENCIA (offline)
**Invoice signal:** No `hkaProtocol` and no `fechaLimitePosterior` (or invoice is QUEUED/unresolved offline).  
**Deadline:** `fechaEmision + 72 hours`.  
**Printed text (exact literal per DGI):**
```
CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta {dd/mm/aaaa hh:mm:ss}
```

> ⚠️ "DIRECCIÓN GENERAL DE INGRESOS" must be spelled out in full. Abbreviating to "DGI" may invalidate the document in an audit.

---

## QR Code Compliance (DGI)

| Requirement | Value |
|---|---|
| Error correction | Level M (15% recovery) |
| Encoding | UTF-8 |
| Standard | ISO/IEC 18004 |
| Minimum total width | ≥ 25mm (22mm content + 3mm quiet zone) |
| Quiet zone ratio | 10% of total width if printed larger than 25mm |

**Module size formula** (for ESC/POS printers):
```typescript
// modules = data modules per side (≈29 for QR v3, 33 for v4, 37 for v5)
// Varies by content length — DGI URL is ~150 chars → ~v4-5
const dotsPerMm = dpi / 25.4;
const targetContentDots = 22 * dotsPerMm;
const moduleSize = Math.ceil(targetContentDots / modules);
// Verify total: (modules + 8) * moduleSize / dotsPerMm >= 25mm
```

**Safe defaults:**
- 203 DPI: `moduleSize = 7` (total ≈ 30.75mm ✓ at QR v4)
- 300 DPI: `moduleSize = 10` (total ≈ 31.3mm ✓ at QR v4)

**QR URL content** — reuse `construirQRContent()` pattern from `cafe.service.ts`.  
Parameters: `cufe`, `ruc`, `dv`, `fe` (date ISO compact), `tipo`, `num`, `suc`, `pf`, `te`, `amb`.

---

## Six CAFE Sections (ESC/POS Layout)

Built in order by `cafe-escpos.service.ts`:

### 1. Header
```
── Center ──────────────────
  [LOGO if available]
  COMPROBANTE AUXILIAR DE
  FACTURA ELECTRÓNICA
  FACTURA DE OPERACIÓN INTERNA
─────────────────────────────
  RUC: 123456-1-123456 DV: 28
  EMPRESA EJEMPLO S.A.
  Calle 50, Ciudad de Panamá
─────────────────────────────
  Cliente: JUAN PÉREZ
  RUC: 8-123-456-7
─────────────────────────────
  N°: 0001-001-0000000001
  Fecha: 10/04/2026 14:30:00
  Moneda: PAB
```

### 2. Item Detail
```
Desc         Cant  P.Unit  Total
Producto A  2.0 UND  5.00  10.00
Producto B  1.0 KG   3.50   3.50
```
Qty + unit concatenated (`"2.0 UND"`) to save space on 58mm paper.

### 3. Totals & Payment
```
─────────────────────────────
Subtotal:         B/. 13.50
ITBMS (7%):       B/.  0.945
Total:            B/. 14.45
─────────────────────────────
Forma de Pago:
Efectivo          B/. 20.00
Vuelto:           B/.  5.55
```

### 4. DGI Consultation (conditional legal text)
```
─────────────────────────────
Consulte en: https://efact.mef.gob.pa/...
[QR CODE ≥ 25mm]
[Legal text per emission mode]
```

### 5. Promotional Message (optional)
Free-text block from `mensajePromocional` field. Omitted if empty.

### 6. Acceptance Block (optional)
Blank lines for Nombre / Cédula / Fecha / Firma. Only rendered if `requiereFirma = true`.

---

## Daemon HTTP Contract

The daemon is a **standalone Node/Bun process** installed once per POS machine. It has a single endpoint:

```
POST http://localhost:9876/print
Content-Type: application/octet-stream
Body: raw ESC/POS Uint8Array

→ 200 OK                    (sent to printer)
→ 503 Service Unavailable   (printer device not found)
```

**Configuration via env vars:**
- `CAFE_PRINTER_DEVICE` — default `/dev/usb/lp0` (Linux) or `\\.\COM3` (Windows)
- `CAFE_DAEMON_PORT` — default `9876`

UI behavior on 503 or network error: show toast "Sin impresora — el daemon no responde", **do not block the invoice flow**.

---

## New Files

| File | Type | Purpose |
|---|---|---|
| `features/cafe/model/types/cafe-escpos.types.ts` | Client | `CAFEEscposInput`, `EmisionMode` |
| `features/cafe/model/services/cafe-escpos.service.ts` | Client | ESC/POS buffer builder (6 sections + QR) |
| `features/cafe/model/mappers/invoice-to-cafe-escpos.mapper.ts` | Client | `Invoice` → `CAFEEscposInput`, mode derivation |
| `features/cafe/infrastructure/print-daemon.client.ts` | Client | `fetch` to localhost daemon |
| `features/cafe/ui/hooks/use-cafe-print.ts` | Client | Orchestration hook |
| `features/cafe/ui/cafe-print-button.tsx` | Client | "Cinta POS" action button |
| `packages/cafe-daemon/src/index.ts` | Standalone | HTTP server → printer device write |

---

## Modified Files

| File | Change |
|---|---|
| `features/invoicing/ui/invoice-detail-view.tsx` | Add "Cinta POS" button next to PDF/Email buttons; pass additional invoice fields needed by mapper |

---

## Dependencies

```bash
pnpm add escpos-buffer
```

Verify browser bundle compatibility: no `fs`, `net`, `usb` imports. Use dynamic import if tree-shaking issues arise.

---

## Existing Code to Reuse

| Asset | Location | Used For |
|---|---|---|
| `generarCAFE()` | `features/hka/model/services/cafe.service.ts:313` | Contingency date/text calculation |
| `construirQRContent()` | `cafe.service.ts:215` | QR URL pattern (adapt for authorized flow) |
| `formatearFechaLarga()` | `cafe.service.ts:183` | Date formatting for legal texts |
| `ActionButton` component | `invoice-detail-view.tsx:85` | Button pattern for "Cinta POS" |
| `downloadPDF()` | `features/hka/model/hka.facade.ts` | Formato 1 — no changes |

---

## Out of Scope (This Iteration)

- Formato 1 (A4) local rendering — HKA handles it
- Storing generated CAFE in `invoice.cafe` DB field — generated on demand
- Printer model configuration UI — daemon uses env var
- Section 5 (promotional) and Section 6 (acceptance) full implementation — stubs
