# Ola 1 · Lo que ya se vende queda cerrado

**Qué cierra**: la venta en caja y en el mercado, con su cobro y su devolución, funciona en producción de punta a punta y con prueba en el teléfono. Etapas: P3, P5, P8 · M2, M7 ([`../lifecycles.md`](../lifecycles.md)). Procedimiento común: [`README.md`](README.md) §2.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F16.11](#f1611--escáner-en-inventario-cierre) Escáner (cierre) | flutter_app | L4 | — | requiere a una persona |
| 2 | [F16.7](#f167--pantallas-de-inventario-cierre) Pantallas de inventario (cierre) | flutter_app | L4 | F16.11 | — |
| 3 | [F17.5](#f175--cobro-mixto-l4) Cobro mixto (L4) | pos, flutter_app | L4 | — | — |
| 4 | [F17.10](#f1710--pantallas-del-pos-integration_test) Pantallas del POS (integration_test) | flutter_app | L4 | F17.5 | — |
| 5 | [F17.3](#f173--reporte-z-y-conteo-por-denominación) Reporte Z y conteo por denominación | pos, gateway, app | L2 | — | — |
| 6 | [F17.11](#f1711--configuración-de-caja) Configuración de caja | pos, gateway, app | L2 | — | — |
| 7 | [F16.9](#f169--sucursal-en-bodegas-y-alcance) Sucursal en bodegas | inventory, app | L2 | — | — |
| 8 | [F17.12](#f1712--sucursal-en-cajas-y-ventas) Sucursal en cajas y ventas | pos, app | L2 | F16.9 | — |
| 9 | [F17.13](#f1713--cambio-de-turno-y-sesiones-abandonadas) Cambio de turno | pos, identity, app | L2 | F17.3 | supuesto Q-51 |
| 10 | [F11.6](#f116--reembolsos-t7-l4) Reembolsos T7 (L4) | payments-core, app | L4 | — | — |
| 11 | [F17.9](#f179--devoluciones-cierre) Devoluciones (cierre) | pos | L4 | F11.6 | Q-47 para efectivo cruzado; nota de crédito en ola 2 |
| 12 | [F15.8](#f158--checkout-del-mercado-l4) Checkout del mercado (L4) | orders, app | L4 | — | — |
| 13 | [F15.9](#f159--aceptación-plazo-y-rechazo-l4) Aceptación, plazo y rechazo (L4) | orders, app | L4 | F15.8 | logística y fiscal en olas 2 y 5 |
| 14 | [F15.10](#f1510--pantallas-del-mercado-integration_test) Pantallas del mercado (integration_test) | flutter_app | L4 | F15.9 | — |

---

### F16.11 · Escáner en inventario (cierre)
Ficha de diseño: [commerce-plan F16.11](../commerce-plan.md#f1611--escáner-en-inventario) · Ciclo P2 · Nivel L4 · Estado 📝 (código y L4 con lector simulado hechos el 2026-10-23).
- **Precedencia / bloqueos**: ninguna. Requiere a **una persona** frente al teléfono: un agente no puede apuntar la cámara.
- **Leer antes**: `flutter_app/lib/core/widgets/barcode_scanner_dialog.dart`, `lib/core/format/barcode.dart`, C-27 en `docs/ux/functional-spec/README.md` §3.
- **Resultado observable**: con la app de depuración, la cámara lee un código impreso y elige el producto.
- **Contrato / datos / código**: sin cambios.
- **L4**: crear un producto de prueba con el código de barras de un artículo físico a mano (13 cifras impresas en el empaque); Inventario → Ajustar → icono de escaneo → apuntar al código → el selector muestra el producto y «Sistema N». Repetir con la versión UPC-A si el empaque la tiene. Con un lector Bluetooth emparejado: misma pantalla, sin tocar ningún campo, leer el código → mismo resultado. Archivar el producto de prueba.
- **Docs al cerrar**: `status.md` F16.11 → ✅ con fecha, artículo usado (sin datos personales) y resultado; `commerce-plan.md` campo 4.
- **Trampas conocidas**: el teléfono apoyado en la mesa no enfoca; el permiso de cámara se pide al tocar «Escanear» (ADR 0020) y puede estar denegado en la app de depuración (Ajustes → Apps).
- **Terminado cuando**: «Doble lectura cuenta una vez; L4 en dispositivo físico» (05) y la lectura por cámara de un código impreso queda registrada.

### F16.7 · Pantallas de inventario (cierre)
Ciclo P3 · Nivel L4 · Estado 📝.
- **Precedencia**: F16.11.
- **Resultado observable**: el paso queda cerrado con la evidencia que ya existe más la de F16.11.
- **Qué falta**: solo registrar el cierre. Las L4 en el teléfono de compras (orden, envío, recepción con escaneo, dañado, cerrar con faltante) se hicieron en F16.11 y F16.12 (2026-10-23) y los widget tests de 4 estados existen (`test/features/inventory/*`, `test/accessibility/commerce_gravital_test.dart`).
- **Docs al cerrar**: `status.md` F16.7 → ✅ citando las evidencias L4 de F16.11 y F16.12; quitar «Falta: L4 en el teléfono de compras».
- **Terminado cuando**: «Widget tests 4 estados» (05) y L4 de compras citada.

### F17.5 · Cobro mixto (L4)
Ciclo P5 · M2 · Nivel L4 · Estado 📝 (aceptación 1 en L2 con `TestSPEC11_1_CashPlusWalletPaysAndDiscountsStock`).
- **Precedencia**: ninguna (pos y payments-core en producción).
- **Leer antes**: `pos/SPEC.md` §11 aceptación 1; `docs/architecture/event-chains.md` fila «Venta de caja».
- **Resultado observable**: una venta de caja pagada con efectivo + saldo PlentyPay queda PAID, con vuelto correcto, existencias descontadas y el cobro en la lista del comercio.
- **Contrato / datos / código**: sin cambios (salvo defectos que aparezcan).
- **L4** (por API y en el Pixel, cuenta demo):
  1. Producto de prueba activo con existencia 5 (ajuste en Inventario).
  2. Abrir caja con fondo 5.00 (S-POS-01).
  3. Vender 3 unidades a 1.00 → «Cobrar» → efectivo 2.00 recibido sobre 1.00 (vuelto 1.00) + resto 2.00 con saldo PlentyPay. Para pagar el QR hace falta una **segunda cuenta** con saldo: usa una cuenta de prueba creada por la API pública con recarga en sandbox (T1); nunca la cuenta personal del dueño.
  4. Verificar en la base: venta `PAID`, `payments` capturado con `reference = {sale, id}`, movimientos SALE `sale:<venta>:<línea>`, esperado de caja = fondo + efectivo neto.
  5. Cerrar la caja contando el esperado → diferencia 0.
- **Docs al cerrar**: `status.md` F17.5 → ✅ L4 con la evidencia; `event-chains.md` fila «Venta de caja» → «en producción».
- **Trampas conocidas**: si el producto no está activo la venta falla y un guion que sigue de largo puede cerrar la caja con conteo 0 (incidente F17.4): comprueba cada paso antes del siguiente.
- **Terminado cuando**: «Prueba de aceptación 1» (05) en producción.

### F17.10 · Pantallas del POS (integration_test)
Ciclo P5 · Nivel L4 · Estado 📝.
- **Precedencia**: F17.5.
- **Resultado observable**: `integration_test` de venta mixta efectivo + billetera que corre en el Pixel.
- **Código**: crear `flutter_app/integration_test/pos_mixed_sale_test.dart` siguiendo `integration_test/identity_flow_test.dart` (login con la cuenta demo por variables `--dart-define`, nunca en el código). Flujo: abrir caja → agregar producto de prueba → cobrar efectivo parcial → pantalla de QR de saldo (el pago lo hace la segunda cuenta por API desde el guion de la prueba, o se verifica hasta mostrar el QR y se marca el pago por API) → recibo «Pagada».
- **Verificar**: `cd flutter_app && flutter test integration_test/pos_mixed_sale_test.dart -d 41191FDJG002UT --dart-define=...`.
- **Docs al cerrar**: `status.md` F17.10 (display del cliente queda para F17.8).
- **Terminado cuando**: «integration_test: venta mixta efectivo+wallet» (05) pasa en el Pixel.

### F17.3 · Reporte Z y conteo por denominación
Ciclo M9 · Nivel L2 · Estado 📝 (R1, cierre con diferencia, entradas y salidas ✅ L2).
- **Precedencia**: ninguna.
- **Leer antes**: `pos/SPEC.md` §3 (`totals jsonb` del cierre), §4 fila Open/Close/GetCashSession; fichas S-POS-09 y S-POS-10 en `docs/ux/functional-spec/` (módulo caja); N-FIS (reporte por tasa).
- **Resultado observable**: al cerrar la caja se ve y queda guardado el reporte Z: ventas por medio (efectivo, saldo PlentyPay), devoluciones por medio, entradas/salidas, ITBMS por tasa, exento, número de ventas y anulaciones; el conteo puede hacerse por denominación.
- **Contrato** (`network-contracts/proto/pos.proto`, aditivo):
  - `message ZReportLine { string key = 1; plentypay.common.v1.Money amount = 2; int32 count = 3; }` (`key` = `rail:CASH`, `rail:WALLET`, `refund:CASH`, `tax:700`, `tax:0`, `cash_in`, `cash_out`, `voids`).
  - `message ZReport { repeated ZReportLine lines = 1; plentypay.common.v1.Money gross_sales = 2; plentypay.common.v1.Money refunds = 3; plentypay.common.v1.Money net_sales = 4; int32 sales_count = 5; }`.
  - `CashSession.z_report = 13` (solo con la sesión cerrada).
  - `message CashCount { int64 denomination_minor = 1; int32 quantity = 2; }` y `CloseCashSessionRequest.counted_by_denomination = 5` (repeated). Si llega, el servidor calcula `counted_cash` = Σ denominación × cantidad y rechaza si además viene `counted_cash` distinto (`INVALID_REQUEST`).
- **Datos**: `pos/migrations/0004_zreport.up.sql`: `ALTER TABLE cash_sessions ADD COLUMN counted_by_denomination jsonb NOT NULL DEFAULT '[]'` y usar la columna `totals jsonb` existente para el reporte (si no existe en la migración real, agregarla aquí). `down` quita la columna nueva.
- **Código**: `pos/internal/domain` (nuevo `zreport.go`: función pura `BuildZReport(sales, refunds, movements)` con montos enteros y tasas como `tax:<bps>`; denominaciones válidas = las de USD/PAB leídas de una tabla en el dominio: 1, 5, 10, 25, 50 centavos y 1, 5, 10, 20, 50, 100 dólares —no son valores legales variables sino de la moneda—), `pos/internal/store/store.go` (al cerrar: calcular y guardar el reporte en la misma transacción del cierre), `pos/internal/server` (mapear `z_report`).
- **Gateway / app**: ruta existente de cierre (`POST /v1/pos/sessions/{id}/close`) pasa el campo nuevo; S-POS-10 agrega «Contar por billetes y monedas» (actualizar la ficha primero) y S-POS-09 muestra el reporte Z de una sesión cerrada.
- **Pruebas**: L1 `TestF17_3_ZReportTotalsByRailAndTaxRate` (vector: 2 ventas efectivo 1.07 con 7 % y 1 venta saldo 2.00 exenta, 1 devolución efectivo 1.07 → líneas y netos exactos), `TestF17_3_DenominationCountMustMatch`; L2 `TestL2_F17_3_CloseStoresZReport` (cerrar y leer la sesión devuelve el reporte; un reintento del cierre no lo duplica); widget `test('F17.3 S-POS-10: conteo por denominación suma y envía', ...)`.
- **Verificar**: pos L1/L2, gateway, Flutter, checks.
- **Desplegar**: respaldo `pos`, migrate 0004, pos + api-gateway.
- **L4**: abrir caja, una venta en efectivo, cerrar contando por denominación → el reporte Z en pantalla cuadra con la base.
- **Docs al cerrar**: `pos/SPEC.md` (regla del reporte Z), README, glosario (`ZReport`), status.
- **Terminado cuando**: «R1 y cierre» (05) + reporte Z guardado y visible.

### F17.11 · Configuración de caja
Ficha de diseño: [commerce-plan F17.11](../commerce-plan.md#f1711--configuración-de-caja) · Ciclo P5 · Nivel L2 · Estado 📋.
- **Precedencia**: ninguna. Excluye propina (Q-21) y lealtad (F17.15).
- **Leer antes**: `PosSettings` en `pos.proto` (campos 1–9 ya existen), ficha S-POS-11, `flutter_app/lib/features/pos/pos_settings_screen.dart` (hoy con datos fijos: debe quedar sin datos inventados).
- **Resultado observable**: el dueño cambia el tope de diferencia de caja, los medios activos y el pie del recibo; la venta siguiente lo respeta.
- **Contrato**: `UpdatePosSettingsRequest` ya tiene `settings`; agregar `idempotency_key = 2` y `PosSettings.version = 10` si no existen (verificar con `grep -n UpdatePosSettingsRequest -A3 network-contracts/proto/pos.proto`).
- **Datos**: `pos/migrations/0004_settings` (o 0005 si F17.3 ya usó 0004): `pos_settings(tenant_id uuid PRIMARY KEY, settings jsonb NOT NULL, version int NOT NULL DEFAULT 1, updated_by uuid, updated_at timestamptz NOT NULL)` con RLS; sin fila = valores por defecto definidos en el dominio.
- **Código**: `pos/internal/domain/settings.go` (valores por defecto, `Validate`: `auto_threshold_minor ≥ 0`, `cash_difference_threshold_minor ≥ 0`, `receipt_footer ≤ 200`, `enabled_rails` ⊆ {CASH, WALLET} hoy); store `Settings`/`SaveSettings` con `version` optimista (`VERSION_CONFLICT`); service lee la configuración en `Checkout` (medios permitidos → `RAIL_NOT_SUPPORTED`) y en `CloseCashSession` (umbral de aprobación); server `GetPosSettings` (`pos:sell`) y `UpdatePosSettings` (`pos:settings:manage`).
- **Gateway / app**: rutas `GET/PUT /v1/pos/settings` (verificar si existen en `api-gateway/internal/routes/commerce_table.go`; si no, agregarlas con `Idempotency: true` en el PUT); S-POS-11 lee y guarda de verdad; entrada desde el menú de caja para quien tiene `pos:settings:manage`.
- **Pruebas**: L1 `TestF17_11_SettingsValidate`; L2 `TestL2_F17_11_SettingsVersionAndDefaults`, `TestL2_F17_11_DisabledRailIsRejectedOnNextSale`; gateway decode; widget `test('F17.11 S-POS-11: guarda y muestra conflicto de versión', ...)`; gravital al 200 %.
- **Desplegar**: respaldo `pos`, migrate, pos + api-gateway.
- **L4**: desactivar «saldo PlentyPay» → la venta siguiente no lo ofrece; reactivarlo.
- **Trampas conocidas**: la pantalla actual tiene datos literales: bórralos, no los conectes a medias (AGENTS §3.1).
- **Terminado cuando**: «Un cambio rige en la venta siguiente» (05).

### F16.9 · Sucursal en bodegas y alcance
Ficha de diseño: [commerce-plan F16.9](../commerce-plan.md#f169--sucursal-en-bodegas-y-alcance) · Ciclo P3 · Nivel L2 · Estado 📋.
- **Precedencia**: ninguna (sucursales ✅ en identity).
- **Leer antes**: ADR 0018; `docs/domain/business-profiles-and-access.md` §8 (vectores V3, V7); `docs/standards/grpc-conventions.md` (fila `x-pp-branch-scope`: si falta, **ninguna** sucursal); cómo lo lee identity: `identity/internal/auth/access.go`; cómo lo propaga el gateway: `api-gateway/internal/metadata/metadata.go`.
- **Resultado observable**: un gerente con alcance a la sucursal A no puede ajustar, transferir ni recibir en bodegas de B (`BRANCH_OUT_OF_SCOPE`), y solo ve las de A.
- **Contrato**: `Warehouse.branch_id` (siguiente número libre del mensaje `Warehouse` en `inventory.proto`).
- **Datos** (dos migraciones, la ficha de diseño dice «0005» pero ese número ya lo usó F16.10: usar las siguientes libres, **0007 y 0008** al 2026-10-23):
  - `0007_warehouse_branch`: `ALTER TABLE warehouses ADD COLUMN branch_id uuid;` relleno con la sucursal matriz del tenant. inventory no tiene las sucursales: el relleno lo hace un comando `inventory backfill-branches` que pide a identity `ListBranches` por tenant (rol `SYSTEM`) o, si no hay sucursal, deja la marca de matriz `00000000-0000-0000-0000-000000000000` documentada como «matriz».
  - `0008_warehouse_branch_required`: `ALTER TABLE warehouses ALTER COLUMN branch_id SET NOT NULL` (se aplica en un despliegue posterior, tras verificar que no quedan nulos).
- **Código**: `inventory/internal/tenancy` (leer `x-pp-branch-scope` → `Scope{All bool; Branches map[string]bool}`; ausente = ninguna), `internal/server` (pasar el alcance al servicio), `internal/service` (validar en `AdjustStock`, `TransferStock` —origen **y** destino—, `ReceiveGoods`, `UpsertWarehouse`, `ReserveStock` no: las reservas las hace orders como servicio), `internal/store` (filtrar `ListWarehouses`, `ListStock`, `ListMovements`, `ListLots` por bodegas en alcance). Error `ErrBranchOutOfScope` → `PERMISSION_DENIED` `BRANCH_OUT_OF_SCOPE`.
- **Gateway / app**: S-INV-09 muestra y permite elegir la sucursal de la bodega (actualizar la ficha); el selector de bodega de S-INV-01 solo lista las de su alcance (lo da el servidor).
- **Pruebas**: L1 `TestADR0018_ScopeParsing` (`*`, lista, ausente); L2 `TestADR0018_BranchOutOfScope` (V3: ajuste en otra sucursal rechazado; V7: transferencia con destino fuera de alcance rechazada; lectura filtrada); `TestF16_9_ServicesAreNotScoped` (pos/orders como servicio no se filtran); server `toStatus`.
- **Desplegar**: respaldo `inventory`; migrate 0007; backfill; verificar `SELECT count(*) FROM inventory.warehouses WHERE branch_id IS NULL` = 0; en el despliegue siguiente, 0008.
- **L4**: con la cuenta del cajero con alcance de sucursal (existe en la cuenta demo, ver F08.8), Inventario solo muestra su bodega y un ajuste en otra responde el mensaje traducido.
- **Trampas conocidas**: «sin metadato = ninguna sucursal», no «todas»; las llamadas de servicio (pos, orders) llegan con `x-pp-actor-service` y no deben bloquearse.
- **Terminado cuando**: «Vectores V3/V7 aplicados a bodegas» (05).

### F17.12 · Sucursal en cajas y ventas
Ficha de diseño: [commerce-plan F17.12](../commerce-plan.md#f1712--sucursal-en-cajas-y-ventas) · Ciclo P5 · Nivel L2 · Estado 📋.
- **Precedencia**: F16.9 (mismo patrón de alcance; copiar el paquete de tenancy, no importarlo).
- **Resultado observable**: cada caja y cada venta llevan su sucursal; un cajero con alcance a A no abre cajas de B; el reporte Z (F17.3) se puede filtrar por sucursal.
- **Contrato**: `Terminal.branch_id` (payments-core es dueño de las terminales: verificar en `payments.proto` si el punto de cobro ya trae sucursal) y `Sale.branch_id` (siguiente número libre de `Sale`), `CashSession.branch_id`.
- **Datos**: pos `00NN_branch`: `cash_sessions.branch_id`, `sales.branch_id` (copiado de la caja al crear la venta), relleno con la matriz como en F16.9.
- **Código**: `pos/internal/tenancy` (alcance), validación en `OpenCashSession`, `CreateSale`, `VoidSale`, `RefundSale`, `CloseCashSession`; `ListSales` filtrada.
- **App**: S-POS-01 muestra la sucursal del punto de cobro.
- **Pruebas**: L2 `TestADR0018_PosBranchOutOfScope`, `TestL2_F17_12_SaleCopiesBranchFromSession`.
- **Terminado cuando**: «Cajero con alcance a una sucursal no abre cajas de otra» (05).

### F17.13 · Cambio de turno y sesiones abandonadas
Ficha de diseño: [commerce-plan F17.13](../commerce-plan.md#f1713--cambio-de-turno-y-sesiones-abandonadas) · Ciclo P5 · M9 · Nivel L2 · Estado 📋.
- **Precedencia**: F17.3. **Supuesto permitido** (Q-51): relevo = cierre con arqueo + nueva apertura.
- **Leer antes**: ADR 0020 y ADR 0023 (pos consume step-up en identity); `docs/security/strong-authentication.md`.
- **Resultado observable**: un gerente cierra la caja abandonada de otro cajero con conteo, nota y confirmación fuerte; queda auditado; una caja abierta > 12 h genera aviso (cuando notifications exista, ola 2).
- **Contrato**: `CloseCashSessionRequest.step_up_token = 6` (o el número libre), `CashSession.closed_by_user_id`, `CashSession.forced = …`.
- **Datos**: `cash_sessions.closed_by uuid`, `cash_sessions.forced boolean NOT NULL DEFAULT false`.
- **Código**: service: si quien cierra no es el dueño de la sesión, exigir `pos:session:manage` + step-up `pos.session.force_close` (agregar la operación al catálogo de step-up de identity, como hizo ADR 0023 con `pos.sale.void`); las estacionadas se anulan antes (`SALES_PENDING`); evento de auditoría `pp.audit.pos.session.force_closed`.
- **App**: S-POS-10 «Cerrar caja de otro cajero» (actualizar la ficha).
- **Pruebas**: L2 `TestL2_F17_13_ForcedCloseNeedsManagerAndStepUp`, `TestL2_F17_13_OwnerClosesWithoutStepUp`.
- **Terminado cuando**: «Relevo sin perder ventas ni efectivo; cierre forzado con confirmación fuerte» (05).

### F11.6 · Reembolsos T7 (L4)
Ciclo M7 · Nivel L4 · Estado 📝 (T7 por split con step-up en L2).
- **Precedencia**: ninguna.
- **Leer antes**: `domain-model.md` §4.4 (vectores R1–R3), `payments-core/SPEC.md` §12 aceptación 4.
- **Resultado observable**: un reembolso parcial y uno total de un pago con saldo, hechos desde la app con confirmación fuerte, devuelven el dinero al pagador y descuentan al comercio exactamente lo del vector.
- **L4**: cuenta de prueba A paga 25.00 al comercio demo (QR de cobro); el comercio reembolsa 10.00 y luego el resto desde el detalle del cobro (S-PAY) → saldo de A vuelve a su valor; en la base: dos asientos T7, `MERCHANT_PAYABLE` con `merchant_debit` del vector, `PLATFORM_FEES` y `TAX_PAYABLE` devueltos; reintento con la misma clave sin efecto; token de step-up usado → `STEP_UP_INVALID`.
- **Docs al cerrar**: status F11.6 → ✅ L4.
- **Terminado cuando**: «Prueba de aceptación 4» (05) en producción.

### F17.9 · Devoluciones (cierre)
Ficha de diseño: [commerce-plan F17.9](../commerce-plan.md#f179--devoluciones) · Ciclo P8 · M7 · Nivel L4 · Estado 📝.
- **Precedencia**: F11.6 (el reintegro al saldo usa T7).
- **Qué falta**: (a) L4 del reintegro al saldo PlentyPay en vivo (venta pagada con saldo por una cuenta de prueba → devolución desde S-POS-08 → el saldo vuelve); (b) la nota de crédito se cierra en la ola 2 con F13.5; (c) efectivo por una venta electrónica espera **Q-47** (no se implementa); (d) la aceptación 4 «con tarjeta» espera riel de tarjeta (Q-03).
- **Terminado cuando**: (a) con evidencia; el paso queda ✅ con (b), (c), (d) citados como dependencias externas, siguiendo la regla de cierre de otros pasos con dependencia bloqueada (decídelo con el dueño si hay duda: AGENTS §7).

### F15.8 · Checkout del mercado (L4)
Ciclo P5 · M2, M3 · Nivel L4 · Estado 📝 (aceptación 1, 3, 4 en L2).
- **Resultado observable**: un comprador paga en un solo cobro productos de dos comercios; cada comercio ve su sub-pedido esperando aceptación y su parte en `MERCHANT_PAYABLE`.
- **L4**: dos comercios de prueba con un producto publicado cada uno (la cuenta demo es uno; el segundo, el restaurante de ejemplo de F08.8 si está ACTIVE, o uno nuevo aprobado por la cuenta de plataforma); comprador = cuenta de prueba con saldo sandbox; carrito → checkout con step-up → en la base: un pago con dos splits (vector E), dos sub-pedidos `AWAITING_ACCEPTANCE`, reservas confirmadas; checkout repetido con la misma clave → un pedido.
- **Terminado cuando**: «Pruebas de aceptación 1, 3, 4» (05) en producción.

### F15.9 · Aceptación, plazo y rechazo (L4)
Ciclo P5, P7 · M7 · Nivel L4 · Estado 📝 (aceptación 2 en L2).
- **Precedencia**: F15.8.
- **Resultado observable**: el comercio A acepta, prepara y entrega con código de retiro; B no responde y a los 15 min su parte se rechaza sola con reembolso solo de su split y devolución de existencias.
- **L4**: con el pedido de F15.8, A acepta y entrega con el código de 6 dígitos; B no responde → tras el plazo (`ACCEPT_SLA`, mínimo 5 min para la prueba) `REJECTED` con `ACCEPTANCE_TIMEOUT`, T7 del split de B, existencias de B devueltas; pedido `COMPLETED` al entregar A.
- **Qué queda fuera**: integración con logistics (ola 5) y fiscal (ola 2): se citan.
- **Terminado cuando**: «Prueba de aceptación 2» (05) en producción.

### F15.10 · Pantallas del mercado (integration_test)
Ciclo P4, P5 · Nivel L4 · Estado 📝.
- **Precedencia**: F15.9.
- **Código**: `flutter_app/integration_test/market_multi_merchant_test.dart`: buscar → agregar de dos tiendas → carrito agrupado → checkout con PIN → «Mis pedidos» con dos partes.
- **Qué queda fuera**: entrega a domicilio (ola 5), datos fiscales con RUC (ola 2), reclamos S-MKT-08 (sin servicio).
- **Terminado cuando**: «integration_test: compra multi-comercio» (05) pasa en el Pixel.
