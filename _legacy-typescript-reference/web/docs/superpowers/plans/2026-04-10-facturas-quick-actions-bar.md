# Facturas Quick Actions Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el panel colapsable "Herramientas" en la página de facturas por una barra de acciones compacta, siempre visible, de una sola fila sin wrapping, con solo las 5 acciones únicas/globales.

**Architecture:** Un único componente cliente se modifica (`facturas-page-client.tsx`). Se eliminan 4 estados, 3 imports dinámicos, 3 bloques JSX y se agrega un bloque de barra de acciones inline. Sin nuevos archivos de producción.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-10-facturas-quick-actions-bar-design.md`

---

### Task 1: Smoke test — verificar estado actual y preparar test

**Files:**
- Create: `__tests__/facturas-page-client.test.tsx`

- [ ] **Step 1: Crear el archivo de test**

```tsx
// __tests__/facturas-page-client.test.tsx
import { render, screen } from '@testing-library/react'

// Mock all heavy dependencies so the component renders in isolation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('next/dynamic', () => (fn: () => Promise<{ default: React.ComponentType }>) => {
  const DynamicComponent = () => null
  DynamicComponent.displayName = 'DynamicComponent'
  return DynamicComponent
})
jest.mock('@/features/invoicing/ui/responsive-invoice-list', () => ({
  ResponsiveInvoiceList: () => null,
}))
jest.mock('@/features/invoicing/ui/invoice-filters', () => ({
  InvoiceFilters: () => null,
}))
jest.mock('@/components/dashboard/action-card', () => ({
  ActionCard: () => null,
}))
jest.mock('@/features/invoicing/ui/contingency-banner', () => ({
  ContingencyBanner: () => null,
}))
jest.mock('@/components/dashboard/mobile-header', () => ({
  MobileHeader: () => null,
}))
jest.mock('@/hooks/useServerActionMutation', () => ({
  useQueryInvalidation: () => ({ invalidateAll: jest.fn() }),
}))
jest.mock('@shared/hooks/use-invoices', () => ({
  useInvoices: (initial: unknown) => ({ data: initial }),
}))
jest.mock('@/components/dashboard/invoice-generator-provider', () => ({
  useInvoiceGenerator: () => ({ openGenerator: jest.fn(), optimisticInvoices: [] }),
}))
jest.mock('@/app/actions/invoice/parse-invoice-file.action', () => ({
  parseInvoiceFile: jest.fn(),
}))

import { FacturasPageClient } from '@/app/dashboard/facturas/facturas-page-client'

const mockInitialData = {
  invoices: [],
  stats: { total: 0, emitted: 0, draft: 0, processing: 0, error: 0, canceled: 0, totalAmount: 0 },
}

describe('FacturasPageClient', () => {
  it('no muestra el botón Herramientas', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    expect(screen.queryByText(/herramientas/i)).not.toBeInTheDocument()
  })

  it('muestra las 5 acciones globales siempre visibles', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    expect(screen.getByText(/estado dgi/i)).toBeInTheDocument()
    expect(screen.getByText(/validar ruc/i)).toBeInTheDocument()
    expect(screen.getByText(/folios/i)).toBeInTheDocument()
    expect(screen.getByText(/nota de cr[eé]dito/i)).toBeInTheDocument()
    expect(screen.getByText(/nota de d[eé]bito/i)).toBeInTheDocument()
  })

  it('no muestra botones redundantes de descarga ni anulación en la barra', () => {
    render(<FacturasPageClient initialData={mockInitialData} userName="Test" />)
    // Estos solo deben aparecer por fila, no como botones globales en la barra
    expect(screen.queryByRole('button', { name: /descargar pdf/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /descargar xml/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar email/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anular factura/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test — debe fallar (el componente aún tiene Herramientas)**

```bash
npx jest __tests__/facturas-page-client.test.tsx --no-coverage
```

Esperado: FAIL — `expect(screen.queryByText(/herramientas/i)).not.toBeInTheDocument()` falla porque el botón existe.

---

### Task 2: Limpiar estados, imports y JSX eliminados

**Files:**
- Modify: `app/dashboard/facturas/facturas-page-client.tsx`

- [ ] **Step 1: Actualizar los imports de iconos**

Reemplazar la línea de imports de lucide-react (línea 6 actual):

```ts
// ANTES:
import { Search, Plus, Upload, Pencil, Download, Mail, XCircle, CheckCircle, Database, ChevronDown, Wrench, FileText, FileMinus } from "lucide-react"

// DESPUÉS (elimina: Download, Mail, XCircle, ChevronDown, Wrench — Pencil tampoco se usa tras quitar Mobile Quick Actions):
import { Search, Plus, Upload, CheckCircle, Database, FileText, FileMinus } from "lucide-react"
```

- [ ] **Step 2: Eliminar el import de ActionCard (solo se usaba en el panel colapsable)**

```ts
// ELIMINAR esta línea:
import { ActionCard } from "@/components/dashboard/action-card"
```

- [ ] **Step 3: Eliminar los imports dinámicos de los 3 modales redundantes**

Eliminar estas 3 líneas (líneas 29-33 actuales):

```ts
// ELIMINAR estas líneas:
const DownloadModal = dynamic(() => import("@/components/dashboard/download-modal").then(mod => mod.DownloadModal), { ssr: false })
const CancelInvoiceModal = dynamic(() => import("@/components/dashboard/cancel-invoice-modal").then(mod => mod.CancelInvoiceModal), { ssr: false })
const SendEmailModal = dynamic(() => import("@/components/dashboard/send-email-modal").then(mod => mod.SendEmailModal), { ssr: false })
```

Dejar solo los 3 modales que permanecen:
```ts
const RucValidationModal = dynamic(() => import("@/components/dashboard/ruc-validation-modal").then(mod => mod.RucValidationModal), { ssr: false })
const StatusQueryModal = dynamic(() => import("@/components/dashboard/status-query-modal").then(mod => mod.StatusQueryModal), { ssr: false })
const FoliosConsultationModal = dynamic(() => import("@/components/dashboard/folios-consultation-modal").then(mod => mod.FoliosConsultationModal), { ssr: false })
```

- [ ] **Step 4: Eliminar los 4 estados de modales redundantes y el estado showTools**

Dentro de `FacturasPageClient`, eliminar estas líneas del bloque de estados (líneas 60-70 aprox):

```ts
// ELIMINAR:
const [showTools, setShowTools] = useState(false)
const [showPdfModal, setShowPdfModal] = useState(false)
const [showXmlModal, setShowXmlModal] = useState(false)
const [showCancelModal, setShowCancelModal] = useState(false)
const [showEmailModal, setShowEmailModal] = useState(false)
```

Dejar solo los 3 estados restantes:
```ts
const [showRucModal, setShowRucModal] = useState(false)
const [showStatusModal, setShowStatusModal] = useState(false)
const [showFoliosModal, setShowFoliosModal] = useState(false)
```

- [ ] **Step 5: Eliminar el botón "Herramientas" del header**

En el bloque `{/* Search and Actions */}` (líneas 196-252 aprox), eliminar el botón toggle completo:

```tsx
// ELIMINAR este botón completo:
{/* Tools Toggle */}
<button
  onClick={() => setShowTools(!showTools)}
  className={cn(
    "flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium transition-all text-sm border",
    showTools
      ? "bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-500/50 text-violet-700 dark:text-violet-300"
      : "bg-white dark:bg-white/[0.06] border-gray-200 dark:border-white/[0.1] text-gray-600 dark:text-gray-400 hover:border-violet-300"
  )}
>
  <Wrench size={16} />
  <span className="hidden md:inline">Herramientas</span>
  <ChevronDown size={14} className={cn("transition-transform", showTools && "rotate-180")} />
</button>
```

- [ ] **Step 6: Eliminar el "Mobile Quick Actions Row"**

Eliminar el bloque completo (líneas 256-273 aprox):

```tsx
// ELIMINAR:
{/* Mobile Quick Actions Row */}
<div className="grid grid-cols-2 gap-3 md:hidden">
  <button
    onClick={() => openGenerator()}
    className="flex items-center gap-2 p-3 rounded-xl bg-violet-600 text-white font-bold text-sm shadow-lg"
  >
    <Pencil size={16} />
    Nueva Factura
  </button>
  <button
    onClick={handleImportClick}
    disabled={isProcessingImport}
    className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1] font-bold text-sm text-gray-700 dark:text-gray-300"
  >
    <Upload size={16} />
    {isProcessingImport ? 'Cargando...' : 'Importar'}
  </button>
</div>
```

- [ ] **Step 7: Eliminar el panel colapsable HKA Tools completo**

Eliminar el bloque completo (líneas 274-385 aprox):

```tsx
// ELIMINAR:
{/* HKA Tools Panel (Collapsible) */}
{showTools && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 fade-in duration-300">
    {/* ... todo el contenido ... */}
  </div>
)}
```

- [ ] **Step 8: Eliminar los 3 bloques de modales redundantes del JSX de modales**

Al final del componente, en el bloque `{/* ==================== MODALS ==================== */}`, eliminar:

```tsx
// ELIMINAR:
<DownloadModal
  isOpen={showPdfModal}
  onClose={() => setShowPdfModal(false)}
  type="pdf"
/>
<DownloadModal
  isOpen={showXmlModal}
  onClose={() => setShowXmlModal(false)}
  type="xml"
/>
<CancelInvoiceModal
  isOpen={showCancelModal}
  onClose={() => setShowCancelModal(false)}
  onSuccess={invalidateAll}
/>
<SendEmailModal
  isOpen={showEmailModal}
  onClose={() => setShowEmailModal(false)}
/>
```

- [ ] **Step 9: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit 2>&1 | grep "facturas-page-client"
```

Esperado: sin output (sin errores en ese archivo).

---

### Task 3: Agregar la barra de acciones

**Files:**
- Modify: `app/dashboard/facturas/facturas-page-client.tsx`

- [ ] **Step 1: Insertar el bloque de barra de acciones después del Page Header**

Después del bloque `{/* Page Header */}` que cierra en `</div>` (el div que contiene título + search + botones), agregar:

```tsx
{/* Quick Actions Bar — siempre visible, 1 fila, scroll horizontal en móvil */}
<div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.1] rounded-xl px-3 py-2 shadow-sm">
  {/* Consultas */}
  <button
    onClick={() => setShowStatusModal(true)}
    className="flex-shrink-0 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
  >
    <Search size={12} />
    Estado DGI
  </button>
  <button
    onClick={() => setShowRucModal(true)}
    className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
  >
    <CheckCircle size={12} />
    Validar RUC
  </button>
  <button
    onClick={() => setShowFoliosModal(true)}
    className="flex-shrink-0 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
  >
    <Database size={12} />
    Folios
  </button>

  {/* Divisor */}
  <span className="flex-shrink-0 w-px h-5 bg-gray-200 dark:bg-white/[0.1] mx-1" />

  {/* Nuevos documentos */}
  <button
    onClick={() => openGenerator({ documentMode: 'NOTA_CREDITO' })}
    className="flex-shrink-0 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
  >
    <FileMinus size={12} />
    Nota de Crédito
  </button>
  <button
    onClick={() => openGenerator({ documentMode: 'NOTA_DEBITO' })}
    className="flex-shrink-0 flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
  >
    <FileText size={12} />
    Nota de Débito
  </button>
</div>
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "facturas-page-client"
```

Esperado: sin output.

---

### Task 4: Pasar los tests y hacer commit

**Files:**
- `__tests__/facturas-page-client.test.tsx` (solo lectura — no cambia)
- `app/dashboard/facturas/facturas-page-client.tsx` (ya modificado)

- [ ] **Step 1: Ejecutar los tests**

```bash
npx jest __tests__/facturas-page-client.test.tsx --no-coverage
```

Esperado:
```
PASS __tests__/facturas-page-client.test.tsx
  FacturasPageClient
    ✓ no muestra el botón Herramientas
    ✓ muestra las 5 acciones globales siempre visibles
    ✓ no muestra botones redundantes de descarga ni anulación en la barra
```

- [ ] **Step 2: Build de verificación**

```bash
npx next build 2>&1 | tail -20
```

Esperado: build exitoso sin errores de compilación.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/facturas/facturas-page-client.tsx __tests__/facturas-page-client.test.tsx
git commit -m "$(cat <<'EOF'
feat(facturas): replace collapsible tools panel with permanent quick actions bar

- Remove Herramientas toggle button and showTools state
- Remove Mobile Quick Actions Row (duplicated header buttons)
- Remove DownloadModal, SendEmailModal, CancelInvoiceModal (redundant with per-row actions)
- Add always-visible compact bar: Estado DGI, Validar RUC, Folios | NC, ND
- Single scrollable row on all screen sizes — no wrapping

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
