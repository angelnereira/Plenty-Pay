# Diseño: Barra de acciones rápidas en página de facturas

**Fecha:** 2026-04-10
**Archivo afectado:** `app/dashboard/facturas/facturas-page-client.tsx`

---

## Problema

Las secciones "Consultas", "Documentos" y "Gestión" estaban ocultas bajo un botón toggle "Herramientas" (`showTools` state). El usuario tenía que hacer clic para ver 9 acciones agrupadas en un panel colapsable de 3 columnas. Además:

- 4 de las 9 acciones eran redundantes con acciones ya disponibles por fila en la tabla.
- El panel colapsable producía filas desiguales (3-3-1) en ciertos tamaños de pantalla.
- Una fila extra de botones móvil (Nueva Factura + Importar) duplicaba los botones del header.

---

## Decisión de diseño

Barra de acciones compacta, siempre visible, una sola fila.

- 5 acciones únicas (se eliminan las 4 redundantes con acciones por fila).
- Sin etiquetas de sección de texto. Solo icono Lucide + label corto.
- Un divisor visual entre el grupo de consultas (3 botones) y el grupo de nuevos documentos (2 botones).
- `overflow-x: auto` + `white-space: nowrap` + `flex-shrink: 0` en cada botón: nunca hace wrap, siempre una fila. Scroll horizontal en móvil, igual que la barra de filtros existente.

---

## Acciones que permanecen (únicas/globales)

| Botón | Icono Lucide | Color | Acción |
|---|---|---|---|
| Estado DGI | `Search` | blue | `setShowStatusModal(true)` |
| Validar RUC | `CheckCircle` | green | `setShowRucModal(true)` |
| Folios | `Database` | blue | `setShowFoliosModal(true)` |
| — divisor — | | | |
| Nota de Crédito | `FileMinus` | amber | `openGenerator({ documentMode: 'NOTA_CREDITO' })` |
| Nota de Débito | `FileText` | violet | `openGenerator({ documentMode: 'NOTA_DEBITO' })` |

---

## Acciones que se eliminan (redundantes con acciones por fila)

| Botón | Dónde ya existe |
|---|---|
| Descargar PDF | `InvoiceActionButtons` (desktop) + `InvoiceActionsSheet` (móvil) |
| Descargar XML | `InvoiceActionButtons` (desktop) + `InvoiceActionsSheet` (móvil) |
| Enviar Email | `InvoiceActionsSheet` (móvil) |
| Anular Factura | `InvoiceActionButtons` (desktop, botón Void) |

Los modales `DownloadModal`, `SendEmailModal` y `CancelInvoiceModal` también se eliminan del componente junto con sus estados e imports dinámicos. Los archivos de los modales no se borran; siguen disponibles para otros usos.

---

## Otras redundancias eliminadas

- `showTools` state y el botón toggle "Herramientas" (iconos `Wrench`, `ChevronDown`).
- "Mobile Quick Actions Row" (grid `md:hidden` con Nueva Factura + Importar): ya existen en el header.

---

## Estructura resultante del componente

```
FacturasPageClient
├── input[file] oculto (importar archivo)
├── MobileHeader (md:hidden)
└── main
    ├── ContingencyBanner
    ├── Page header (título + search + Importar + Nueva Factura)
    ├── QuickActionsBar — siempre visible, 1 fila, 5 botones
    ├── InvoiceFilters
    ├── ResponsiveInvoiceList
    ├── Texto de resultados
    └── Modales restantes:
        ├── RucValidationModal
        ├── StatusQueryModal
        └── FoliosConsultationModal
```

---

## Responsive

| Breakpoint | Comportamiento |
|---|---|
| Móvil | `overflow-x: auto`, scroll horizontal, `flex-shrink: 0` por botón |
| Desktop | Flex 1 fila, cabe sin scroll en pantallas normales |

---

## Archivos afectados

- `app/dashboard/facturas/facturas-page-client.tsx` — único archivo a modificar.
