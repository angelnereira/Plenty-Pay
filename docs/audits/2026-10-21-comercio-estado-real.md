# Auditoría: estado real de los dominios comerciales (2026-10-21)

Contrasta el código, los contratos, los despliegues y la app con `docs/roadmap/status.md`, `ARCHITECTURE.md` y los `SPEC.md`. Cada dato sale de un comando ejecutado ese día. El resultado alimenta el plan por dominio ([`docs/roadmap/commerce-plan.md`](../roadmap/commerce-plan.md)) y la guía de continuidad ([`docs/roadmap/continuity.md`](../roadmap/continuity.md)).

## 1. Punto de partida verificado
| Dato | Valor | Cómo se verificó |
|---|---|---|
| Versión de la app | `0.6.0+16` | `flutter_app/pubspec.yaml` |
| Último release | `v0.6.0` en GitHub (tag remoto) | `git ls-remote --tags origin` (los tags locales llegan a `v0.3.1`: los releases se etiquetan en GitHub) |
| Commit | `3f5799d` = `origin/main`, árbol limpio | `git rev-parse HEAD origin/main`, `git status` |
| Contenedores de negocio en producción | identity, api-gateway, ledger, payments-core, settlement, fiscal-invoicing, catalog, inventory, pos, orders, security, infra-management, web | `docker compose ps` |
| **No** desplegados | logistics, notifications, geolocation, payroll, analytics-bi (no tienen `main.go` ni Dockerfile) | `ls <c>` |

### 1.1 Cobertura real de RPC (métodos con cuerpo propio, sin contar `internal/pb`)
| Contenedor | Implementados | Sin implementar |
|---|---|---|
| catalog | 14/16 | `BulkImportProducts`, `CreateUploadUrl` |
| inventory | 17/17 | — |
| pos | 10/18 | `ParkSale`, `ResumeSale`, `RefundSale`, `GetReceipt`, `SyncOfflineSales`, `StreamCustomerDisplay`, `GetPosSettings`, `UpdatePosSettings` |
| orders | 13/13 | — |
| fiscal-invoicing | 13/14 | `GetInvoiceDocument` |
| payments-core | 18/18 | — (todos los rieles externos en sandbox: `payments-core/src/rails/mod.rs`) |
| logistics | 0/17 | todo (solo dominio con pruebas L1) |
| notifications | 1/13 | casi todo |
| geolocation, payroll, analytics-bi | 0/9, 0/16, 0/14 | todo |

Comando: por cada `rpc` del `.proto`, `grep` de `func (… ) <Rpc>(ctx` (Go) o `fn <rpc_snake>(` (Rust) fuera de `internal/pb`.

## 2. Matriz por dominio
Estados: 📋 pendiente · 📝 en desarrollo o parcial · ✅ implementado y probado al nivel del paso · 🚀 desplegado en producción · ⛔ bloqueado.

| Dominio | Fase y paso | Backend | Persistencia | Contratos y eventos | Flutter | Autorización | Pruebas | Despliegue | Faltantes | Siguiente paso |
|---|---|---|---|---|---|---|---|---|---|---|
| A. Catálogo | F15.1–F15.5 | catalog 14/16 RPC | `catalog` 0001 con RLS, outbox | `ProductUpserted`, `ListingChanged` | S-CAT-01/02/04/05 reales; **S-CAT-03 (importación) con datos fijos y sin entrada** | `catalog:read/write/import/listing:manage` | L2 catalog | 🚀 | variantes (F15.1), importación (F15.3), URL prefirmada (F15.2), plantillas por categoría, historial de cambios | F15.3 (importación) — tras F17.4 |
| A. Inventario | F16.1–F16.4, F16.7 | inventory 17/17 | 0001–0003; movimientos inmutables; idempotencia por fila | `StockChanged`, `StockLow` por outbox | S-INV-01..09 reales | `inventory:*`; **sin alcance por sucursal** | L2 19/19 | 🚀 (0003 el 2026-10-21) | lotes y FEFO (R5), vencimientos, escáner, existencias bloqueadas, `branch_id` | F16.4 (lotes) |
| B. Compras | F16.5, F16.6 | proveedores, OC, recepción, reorden | 0003 (suppliers, purchase_orders, receipts) | sin eventos propios (RECEIPT emite `StockChanged`) | S-INV-05..08 reales (v0.6.0) | `inventory:purchase:manage`, `inventory:receive` | L2 + widget 8/8 | 🚀 | lotes en la recepción, escáner, incidencias, factura del proveedor como documento | F16.8 tras F16.4 |
| C. POS | F17.1–F17.10 | pos 10/18 | 0001; una sesión OPEN por caja | `SalePaid`; tareas de stock | S-POS-01/02/03/05/07/09/10 reales; **S-POS-06 (estacionadas) y S-POS-11 (ajustes) con datos fijos y sin entrada**; S-POS-12 demo | `pos:*` | L2 pos; L4 parcial | 🚀 | estacionar/retomar, devoluciones, ajustes, offline, display, configuración, cambio de turno, `branch_id` | **F17.4** (estacionar) |
| D. Pagos | F11, F23 | payments-core 18/18; en caja solo efectivo y saldo PlentyPay | ledger (Rust) único escritor | `PaymentCaptured`, `RefundIssued` | cobro mixto efectivo + saldo | `payments:*` | L2 ledger/payments | 🚀 (sandbox para rieles externos) | Yappy, tarjeta, QR interoperable (Q-02/Q-03), propinas (Q-21), cupones y tarjetas de regalo | F17.9 depende de F11.6 |
| E. Fiscal | F13 | fiscal-invoicing 13/14; PAC neutral (ADR 0022) con simulador y HKA | 0001 folios sin huecos, inmutabilidad | `InvoiceAccepted/Rejected` | S-FIN-07..10 parciales | `fiscal:*` | L2 | 🚀 (simulador; HKA sin credenciales) | PDF/XML (F13.6), reporte ITBMS, notas desde devolución de pos | F13.6 |
| F. Delivery | F18 | **logistics sin servidor** (0/17) | 0001 sin aplicar | contrato completo | S-LOG-01..07 con datos fijos, ocultas tras `ModuleDef.live` («Disponible próximamente») | `logistics:*` | solo L1 | ❌ | todo; QR de entrega firmado; seguimiento real (F14) | F18.1 tras F14.1 |
| G. Vitrina y pedidos | F15.4, F15.6–F15.10 | orders 13/13; storefront en catalog | orders 0001 | saga de checkout, consumidores de pagos | marketplace, carrito, checkout, pedidos del comercio reales | `orders:*` | L2; L4 pendiente | 🚀 | L4 de la compra multi-comercio, aviso en tiempo real (depende de F20.3) | F15.8 L4 |
| H. Lealtad | F17.6 (asiento T8) | **no existe** programa por comercio | ledger tiene la cuenta `LOYALTY_POINTS` | `LOYALTY_ISSUE`/`LOYALTY_REDEEM` (T8) | S-POS-03 e7 (puntos) sin servicio | **sin permiso** `loyalty:*` | — | ❌ | reglas, acumulación, canje, reversión, expiración (Q-45) | F17.13 (documentado en el plan) |
| I. Roles y alcance | F08, ADR 0018 | identity resuelve `branch_scope` y el gateway propaga `x-pp-branch-scope` | `branches` en identity | — | invitaciones y roles reales | catálogo en `identity/internal/auth/permissions.go` | L2 identity | 🚀 | **ningún servicio de comercio aplica `BRANCH_OUT_OF_SCOPE`**; pos, inventory y orders no guardan `branch_id` | F16.9 / F17.11 |
| Offline | F17.7, F22.1 | `SyncOfflineSales` sin implementar | — | — | `LocalOutbox` (L1) sin uso en caja | — | L1 | ❌ | todo el flujo | F17.7 tras F17.9 |

## 3. Discrepancias encontradas y cómo se resolvieron
| # | Discrepancia | Fuente que prevalece | Resolución |
|---|---|---|---|
| D1 | `status.md` decía «Fase en curso: F11» y que comercio esperaba despliegue | evidencia (`docker compose ps`) | Encabezado de `status.md` reescrito el 2026-10-21 |
| D2 | `README.md` decía «Fase 7 de 30» (2026-10-14) | evidencia | Línea de estado actualizada con enlace a esta auditoría |
| D3 | `domain-model.md` §8.9: el cobro sale de OPEN; `pos/internal/domain/sale.go` permitía cobrar una venta PARKED | ADR → domain-model | ✅ Corregido en F17.4 (`PrepareCheckout` solo desde OPEN, `TestR13_ParkAndResumeTransitions`) |
| D4 | S-POS-10 e4 y la ficha S-POS-06 exigen cerrar o anular las estacionadas antes del cierre; `CloseSession` solo contaba AWAITING_PAYMENT | ficha + SPEC (`SALES_PENDING`) | ✅ Corregido en F17.4 (`TestL2_R13_ParkResumeAndCloseBlocked`) |
| D5 | ADR 0018 exige `BRANCH_OUT_OF_SCOPE` en cada contenedor con `branch_id`; los contenedores de comercio no tienen `branch_id` | ADR 0018 | Pasos nuevos F16.9 y F17.11 en el plan; sin cambio de código hoy |
| D6 | Pantallas sin entrada con datos fijos (S-CAT-03, S-POS-06, S-POS-11, S-POS-12) | AGENTS.md §3.1 | No llegan a producción (sin ruta). ✅ S-POS-06 reescrita sobre el servicio en F17.4; las demás quedan anotadas en sus pasos (F15.3, F17.11, F17.8) |
| D7 | `pos/SPEC.md` pide «cajero» en S-POS-06, pero una venta estacionada nunca sale de la sesión de su cajero (R1 + `SALES_PENDING`) | SPEC (R1) | ✅ Ficha S-POS-06 ajustada |

## 4. Uso de este documento
No se relee el repositorio en cada iteración: el plan por dominio y la guía de continuidad enlazan los archivos de cada paso. Esta auditoría se rehace solo si cambia la topología de despliegue o al cerrar una fase.
