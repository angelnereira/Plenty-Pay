# Plan de trabajo por dominio comercial

Documento auxiliar de [`05-HOJA-DE-RUTA-30-FASES.md`](../../05-HOJA-DE-RUTA-30-FASES.md): **no la sustituye**. La hoja de ruta sigue siendo el índice de ejecución (ids, dependencias y nivel exigido); aquí está la ficha ejecutable de cada paso comercial que no está cerrado. El estado con evidencia vive solo en [`status.md`](status.md); el punto de partida verificado, en la [auditoría del 2026-10-21](../audits/2026-10-21-comercio-estado-real.md); la entrada para un agente nuevo, en [`continuity.md`](continuity.md).

Las reglas no se repiten aquí: cada ficha enlaza su fuente (`SPEC.md` §5, `domain-model.md`, fichas `S-…`, normas `N-…`). Si una ficha y su fuente difieren, manda la fuente (AGENTS.md §1) y se corrige la ficha.

## 0. Cómo leer una ficha
Cada paso tiene 25 campos numerados, siempre en el mismo orden:

1 Id · 2 Objetivo · 3 Problema · 4 Estado · 5 Incluye · 6 Excluye · 7 Depende de · 8 Servicios y archivos · 9 Datos · 10 Contratos · 11 Reglas · 12 Atomicidad · 13 Idempotencia y concurrencia · 14 Autorización · 15 Pantallas · 16 Normativa · 17 Seguridad y privacidad · 18 Observabilidad · 19 Pruebas · 20 Comandos · 21 Aceptación · 22 Despliegue · 23 Reversión · 24 Evidencia · 25 Siguiente.

«Pendiente de decidir» remite siempre a una `Q-NN` de [`open-questions.md`](../open-questions.md). Los nombres nuevos (permisos, `reason`, campos) que una ficha propone se agregan a [`glossary.md`](../glossary.md) **en el mismo cambio que los implementa**, no antes.

Los comandos de verificación comunes a todo paso (AGENTS.md §3.8) se abrevian como **checks**: `./scripts/check-isolation.sh && ./scripts/check-docs.sh && ./scripts/sync-protos.sh --check`.

## 1. Orden de ejecución
El orden sale de las dependencias de la hoja de ruta (F16 → F17; F14 → F18; F20.3 → avisos en tiempo real). Dentro de F16 y F17 los pasos abiertos son independientes entre sí salvo lo indicado.

| # | Paso | Desbloqueado | Motivo |
|---|---|---|---|
| ✅ | [F17.4](#f174--estacionar-y-retomar-ventas) Estacionar y retomar | hecho 2026-10-21 | — |
| 2 | [F16.4](#f164--lotes-y-fefo) Lotes y FEFO | sí | Solo inventory (+ bandera de lote en catalog) |
| 3 | [F17.9](#f179--devoluciones) Devoluciones | parcial | Efectivo y saldo PlentyPay sí; efectivo cruzado y vales esperan Q-47 |
| 4 | [F16.8](#f168--lotes-y-vencimiento-en-la-recepción) Lotes en la recepción | tras F16.4 | — |
| 5 | [F17.11](#f1711--configuración-de-caja) Configuración de caja | sí | Necesaria para lealtad, propina y documento |
| 6 | [F16.9](#f169--sucursal-en-bodegas-y-alcance) / [F17.12](#f1712--sucursal-en-cajas-y-ventas) Sucursal y alcance | sí | ADR 0018 ya decidido |
| 7 | [F16.11](#f1611--escáner-en-inventario) Escáner en inventario | sí | Reutiliza `BarcodeScannerDialog` |
| 8 | [F13.5](#f135--cierre-factura-desde-la-venta) Factura desde la venta | sí | fiscal ya acepta `IssueInvoice` |
| 9 | [F17.13](#f1713--cambio-de-turno-y-sesiones-abandonadas) Cambio de turno | sí (con supuesto de Q-51) | — |
| 10 | [F17.15](#f1715--programa-de-lealtad-reglas)–[F17.17](#f1717--canje-de-puntos-en-el-cobro) Lealtad | mecanismo sí; activación ⛔ Q-45 | Depende de F17.6 |
| 11 | [F18.8](#f188--confirmación-de-entrega-con-qr-de-un-solo-uso) QR de entrega | tras F18.2 | logistics aún sin servidor |
| — | [F17.18](#f1718--cupones-y-tarjetas-de-regalo) Cupones y regalo | ⛔ Q-48 | — |
| — | [F18.5](#f185--seguimiento-en-mapa-futuro) Seguimiento en mapa | ⛔ Q-49 y F14 | — |

## 2. Reglas transversales (dónde están)
| Tema | Fuente | Lo mínimo que toda ficha cumple |
|---|---|---|
| Dinero | ADR 0013, `domain-model.md` §4 | Centavos enteros; `half_up`; decimales por ISO 4217 |
| Atomicidad | ADR 0012 | Estado + outbox en la misma transacción; entre servicios, tarea durable con reintento (patrón `stock_tasks` de pos) |
| Idempotencia | `grpc-conventions.md` §3 | Mutación reintentable con `idempotency_key` o transición por estado (repetir = mismo resultado) |
| Concurrencia | SPEC de cada contenedor | `version` optimista o `FOR UPDATE` en orden fijo; nunca el cliente como árbitro |
| Errores | `glossary.md` §5 | Un `reason` por condición; detalle interno solo en telemetría (AGENTS §2.15) |
| Observabilidad | `observability-standards.md` §9–§16 | Error registrado una vez en el borde, con `request_id`; prueba del registro |
| Pantallas | `gravital-experience-ui.md`, `functional-spec/` | Solo lo que dice la ficha; 4 estados; texto al 200 %; un `filled` |
| Legal | `regulatory-framework.md` §13 | Valores `legal.pa.*` vigentes en la fecha del hecho |
| Sin conexión | F17.7, F22.1 | Una operación no se da por confirmada sin respuesta del servicio dueño |

## 3. Matriz de autorización comercial
Permisos del catálogo vigente (`identity/internal/auth/permissions.go`); «nuevo» = se agrega a identity y al glosario en el paso indicado. Alcance: `T` = todo el comercio; `S` = sucursales de `x-pp-branch-scope` (ADR 0018, hoy **sin aplicar** en comercio: F16.9/F17.12). 🔒 = confirmación fuerte (S-GEN-21, ADR 0020).

| Dominio | Recurso | Consultar | Crear / editar | Confirmar | Cancelar / anular | Devolver / corregir | Alcance |
|---|---|---|---|---|---|---|---|
| Catálogo | Producto, categoría | `catalog:read` | `catalog:write` | — | archivar: `catalog:write` | — | T |
| Catálogo | Publicación | `catalog:read` | `catalog:listing:manage` | — | — | — | T |
| Inventario | Existencias, movimientos | `inventory:read` | ajuste/transferencia: `inventory:adjust` | — | — | corrección = ajuste nuevo | S (bodega → sucursal) |
| Compras | Proveedor, orden | `inventory:purchase:manage` (listar órdenes también `inventory:receive`) | `inventory:purchase:manage` | enviar: `inventory:purchase:manage`; recibir: `inventory:receive` | `inventory:purchase:manage` | — | S |
| Caja | Sesión | `pos:read` | abrir/cerrar/movimientos: `pos:session:manage` | — | — | diferencia de arqueo: nota obligatoria | S (caja → sucursal) |
| Caja | Venta | `pos:sell`, `pos:read` | `pos:sell`; descuento > tope: `pos:discount:apply` | cobro: `pos:sell` | `pos:void` | `pos:refund` 🔒 | S |
| Caja | Configuración | `pos:sell` | `pos:settings:manage` | — | — | — | T |
| Pagos | Cobro, reembolso | `payments:read` | `payments:charge` | — | — | `payments:refund` 🔒 | T |
| Fiscal | Documento | `fiscal:read` | `fiscal:issue` | — | — | nota: `fiscal:note:issue` | T |
| Pedidos | Pedido del comercio | `orders:read` | — | aceptar/preparar: `orders:manage` | rechazar: `orders:manage` | reembolso vía payments | T |
| Entregas | Entrega | `logistics:read` | `logistics:manage` | entregar: `logistics:deliver` | `logistics:manage` | — | S |
| Lealtad | Programa, saldo | **nuevo** `loyalty:read` | **nuevo** `loyalty:manage` 🔒 | acumular/canjear: implícito en `pos:sell` | — | reverso automático por devolución | T |

Ocultar un botón en Flutter no autoriza nada: cada RPC verifica permiso, tenant y alcance en el servidor (AGENTS §2.7). Plantillas: `cashier` = `pos:sell`; `supervisor` = descuentos, anulaciones y devoluciones **sin** `pos:sell` (SoD, glosario).

---

## A. Catálogo e inventario

### F16.4 · Lotes y FEFO
1 F16.4 (abierto; transferencias ya ✅). 2 Saldo por lote con salida «primero en vencer, primero en salir». 3 Farmacias, alimentos y cosméticos necesitan saber qué lote vence y no vender lo vencido. 4 📝: transferencias ✅ L2; lotes sin empezar. 5 Tabla `lots` (producto, bodega, código, vencimiento, saldo); bandera `tracks_lots` del producto (catalog, capacidad `inventory.lots`); `AdjustStock`/`TransferStock` con lote; salida de venta FEFO automática; `LOT_REQUIRED`, `LOT_EXPIRED`. 6 Recepción con lote (F16.8), alertas de vencimiento en pantalla (F16.10), números de serie (no previstos; se registran si un vertical lo pide). 7 F16.2 ✅; capacidad `inventory.lots` (ADR 0018). 8 `inventory/internal/{domain,store,service,server}`, `inventory/migrations/0004_lots.*`, `catalog` (campo de producto), `network-contracts/proto/{inventory,catalog}.proto`. 9 `lots(id, tenant_id, warehouse_id, product_id, code, expires_on date, on_hand_milli, created_at)` `UNIQUE(tenant, warehouse, product, code)`; `movements.lot_id` nullable; `stock_levels` = Σ lotes cuando `tracks_lots`. 10 Campos aditivos `lot_code`/`expires_at` ya existen en `ReceivedLine`; agregar `lot_code` en `AdjustStockRequest`/`TransferLine` y `Product.tracks_lots`. 11 R5 del SPEC; vencido (fecha < hoy en America/Panama) no sale (`LOT_EXPIRED`, Q-50); FEFO con desempate por código. 12 Movimiento + saldo del lote + saldo agregado en una transacción. 13 La clave del movimiento ya es única por `(tenant, key, type, warehouse, product)`; el reparto FEFO es determinista para que un reintento produzca los mismos movimientos. 14 `inventory:adjust`; venta: servicio pos/orders. 15 S-INV-02 (lotes con vencidos en `error`, próximos en `warning`), S-INV-03 (lote obligatorio si aplica). 16 N-LOG-07. 17 Sin datos personales. 18 Atributo `pp.lot_id` en el span del movimiento; métrica `pp_inventory_lot_expired_blocked_total`. 19 L1 reparto FEFO; L2 concurrencia de dos salidas sobre el mismo lote, vencido bloqueado, transferencia con lote. 20 `cd inventory && go test -race ./... && ./test/test_l2.sh`; checks. 21 R5 con vectores; ninguna salida de un lote vencido; Σ lotes = existencias. 22 Migración 0004 aditiva antes del binario; respaldo `pg_dump` del esquema. 23 Down de 0004 solo si no hay lotes con saldo; si los hay, el binario anterior ignora `lot_id` (columna nullable). 24 —. 25 F16.8.

### F16.8 · Lotes y vencimiento en la recepción
1 F16.8 (nuevo). 2 La recepción de compras registra lote y vencimiento por línea. 3 Sin esto, lo comprado entra sin trazabilidad del proveedor. 4 📋. 5 `ReceiveGoods` exige `lot_code`/`expires_at` para productos con lote; vencimiento pasado bloqueado; varias líneas del mismo producto con lotes distintos. 6 Incidencias de recepción (F16.12). 7 F16.4. 8 `inventory/internal/service/purchasing.go`, `store/purchasing.go`, `flutter_app/lib/features/inventory/purchase_receive_screen.dart`. 9 `purchase_receipts.lines` guarda el lote. 10 `ReceivedLine.lot_code=3`, `expires_at=4` (existen). 11 S-INV-06 e3; `LOT_REQUIRED`, `LOT_EXPIRED`. 12 Igual que F16.5: recepción + RECEIPT por lote en una transacción. 13 La clave de la recepción cubre todas sus líneas; reintento = mismo resultado. 14 `inventory:receive`. 15 S-INV-06 e3 (se quita «Pendiente»). 16 N-LOG-07. 17 —. 18 Error con `reason` y `pp.purchase_order_id`. 19 L2 recepción con dos lotes; widget de e3. 20 inventory L2 + `flutter test test/features/inventory`; checks. 21 Lote obligatorio cuando aplica; nada vencido entra. 22 Sin migración nueva si F16.4 ya agregó `lot_id`. 23 Revertir binario. 24 —. 25 F16.10.

### F16.9 · Sucursal en bodegas y alcance
1 F16.9 (nuevo). 2 Cada bodega pertenece a una sucursal de identity y las mutaciones respetan `x-pp-branch-scope`. 3 Un gerente de sucursal hoy puede ajustar existencias de cualquier sucursal (ADR 0018 incumplido, auditoría D5). 4 📋. 5 `warehouses.branch_id` (uuid, la matriz por defecto); validación en `AdjustStock`, `TransferStock`, `ReceiveGoods`, `UpsertWarehouse`; lecturas filtradas por alcance. 6 Precios por sucursal (catalog). 7 F08 (branches ✅ en identity). 8 `inventory/internal/tenancy` (leer el metadato), store, migración 0005. 9 `branch_id` NOT NULL tras rellenar con la matriz. 10 `Warehouse.branch_id` aditivo. 11 Fuera de alcance → `PERMISSION_DENIED` `BRANCH_OUT_OF_SCOPE`; una transferencia exige alcance sobre origen **y** destino. 12 Validación dentro de la transacción del movimiento. 13 Sin cambios. 14 Alcance `S`. 15 S-INV-09 muestra la sucursal. 16 —. 17 Prueba de aislamiento entre sucursales. 18 `pp.branch_id` en spans. 19 L2 `TestADR0018_BranchOutOfScope`. 20 inventory L2; checks. 21 Vectores V3/V7 de `business-profiles-and-access.md` §8 aplicados a bodegas. 22 Migración en dos pasos: columna nullable + relleno, luego NOT NULL. 23 Volver a nullable. 24 —. 25 F17.12.

### F16.10 · Existencias no vendibles y alertas de vencimiento
1 F16.10 (nuevo). 2 Separar existencia dañada/bloqueada de la disponible y avisar vencimientos próximos. 3 Hoy todo lo físico cuenta como vendible. 4 📋. 5 Estado de saldo `BLOCKED` por movimiento (bloquear/desbloquear con motivo); `available = on_hand − reserved − blocked`; alerta de lotes que vencen en N días (parámetro del comercio). 6 Valoración contable (Q-52). 7 F16.4. 8 inventory, S-INV-01/02. 9 `stock_levels.blocked_milli`; tipos de movimiento `BLOCK`/`UNBLOCK` (enum aditivo). 10 `StockLevel.blocked_milli`, `MovementType` nuevos valores. 11 Fórmula de §7.2 del encargo: físico = on_hand; disponible = on_hand − reservado − bloqueado; en tránsito y pendiente de recepción **no** suman a on_hand (vienen de órdenes enviadas). 12 Movimiento + saldo en una transacción. 13 Clave de movimiento. 14 `inventory:adjust`. 15 S-INV-01 columna «Bloqueado»; S-INV-02 lotes por vencer. 16 —. 17 —. 18 Métrica de bloqueos. 19 L2 de la fórmula con vectores. 20 inventory L2; checks. 21 Ninguna reserva ni venta toma existencias bloqueadas. 22 Migración aditiva. 23 Columna sin uso al revertir. 24 —. 25 —.

### F16.11 · Escáner en inventario
1 F16.11 (nuevo; el lector del POS es F24.3). 2 Leer códigos en recepción, ajuste y transferencia con cámara o lector que actúa como teclado. 3 Teclear códigos en bodega es lento y causa errores. 4 📝: `BarcodeScannerDialog` ya existe y S-INV-03 escanea. 5 Escaneo en S-INV-06 (suma 1 a la línea del producto), S-INV-04; GTIN normalizado (N-STD-23); lector HID por captura de teclado; antirrebote: el mismo código en < 800 ms cuenta una vez; entrada manual como alternativa. 6 Etiquetas de balanza (F24.3). 7 —. 8 `flutter_app/lib/core/widgets/barcode_scanner_dialog.dart`, pantallas de inventario. 9 —. 10 Búsqueda por código ya en catalog. 11 Código desconocido → «Producto no encontrado» sin alta implícita; un escaneo nunca crea un movimiento por sí solo (se confirma con el botón del paso). 12 —. 13 Antirrebote local; la idempotencia del servidor sigue siendo la del botón. 14 La del paso de la pantalla. 15 S-INV-06 e2 (se quita «Pendiente: escáner»). 16 N-STD-23/24. 17 Permiso de cámara solo al tocar «Escanear» (ADR 0020). 18 Miga `scan_unknown_code` sin el código completo. 19 Widget: doble lectura cuenta 1. 20 `flutter test`; checks. 21 L4 en el Pixel 8 Pro con un código real. 22 Release de la app. 23 Release anterior. 24 —. 25 —.

### F15.11 · Ficha de producto por categoría
1 F15.11 (nuevo). 2 Alta rápida con lo mínimo y campos avanzados según el tipo de comercio. 3 Una ficha única con todos los campos asusta al pequeño comercio y le falta a la cadena. 4 📋. 5 Plantillas por vertical (ADR 0018 §3) que deciden qué secciones se muestran: lote/vencimiento, peso y dimensiones, variantes, atributos; validación condicional en el servidor (catalog). 6 Variantes (F15.1), importación (F15.3). 7 F15.1. 8 catalog, S-CAT-02. 9 `products.attributes jsonb` validado contra la plantilla. 10 `Product.attributes` aditivo. 11 Campo obligatorio de la plantilla vacío → `INVALID_ARGUMENT` con el campo. 12 —. 13 `version` del producto. 14 `catalog:write`. 15 S-CAT-02 por secciones plegables. 16 N-STD-23/26 (GTIN, unidades). 17 —. 18 —. 19 L2 por plantilla. 20 catalog L2; checks. 21 Un abarrote crea un producto con nombre, precio y código en un solo paso. 22 Migración aditiva. 23 Ignorar `attributes`. 24 —. 25 F15.12.

### F15.12 · Historial de cambios del producto
1 F15.12 (nuevo). 2 Saber quién cambió precio, impuesto o estado y cuándo. 3 Disputas de precio en caja sin rastro. 4 📋. 5 Tabla de auditoría por cambio (campo, antes, después, actor, fecha) escrita en la misma transacción. 6 Historial de inventario (ya está en movimientos). 7 —. 8 catalog. 9 `product_changes`. 10 `ListProductChanges` aditivo. 11 Inmutable. 12 Cambio + auditoría en una transacción. 13 —. 14 `catalog:read`. 15 S-CAT-02 pestaña «Historial». 16 N-FIS-08 (conservación). 17 Sin datos personales salvo el id del actor. 18 —. 19 L2. 20 catalog L2; checks. 21 Cada `UpsertProduct` deja su fila. 22 Aditivo. 23 —. 24 —. 25 —.

## B. Compras y abastecimiento
F16.5 y F16.6 están ✅ (v0.6.0). Máquina de estados de la orden: `domain-model.md` §8.12 y `inventory/SPEC.md` §4.

### F16.12 · Incidencias y diferencias de recepción
1 F16.12 (nuevo). 2 Registrar faltantes, daños y sobrantes al recibir sin forzar la orden. 3 Hoy solo se puede recibir hasta lo pedido; lo dañado entra como bueno. 4 📋. 5 Por línea: recibido bueno, dañado (entra bloqueado, F16.10), faltante con motivo; cierre manual de una orden parcialmente recibida («Cerrar con faltante»). 6 Devolución al proveedor (futuro). 7 F16.10. 8 inventory purchasing. 9 `purchase_receipt_issues`. 10 Campos aditivos en `ReceivedLine`; estado `CLOSED_SHORT` aditivo en el enum. 11 Cerrar con faltante exige motivo; nunca borra lo recibido. 12 Recepción + movimientos + incidencias en una transacción. 13 Clave de la recepción. 14 `inventory:receive`; cerrar: `inventory:purchase:manage`. 15 S-INV-06 (columna «Dañado»), S-INV-05 acción «Cerrar con faltante». 16 —. 17 —. 18 —. 19 L2. 20 inventory L2; checks. 21 Lo dañado no queda disponible. 22 Aditivo. 23 —. 24 —. 25 F16.13.

### F16.13 · Historial de compras y costo de adquisición
1 F16.13 (nuevo). 2 Ver qué se compró, a quién, cuándo y a qué costo por producto, proveedor y bodega. 3 El comercio no puede negociar ni detectar alzas. 4 📋. 5 Consulta de recepciones con costo unitario; último costo y promedio simple de las últimas N recepciones **como información**. 6 Costo de lo vendido y margen (⛔ Q-52). 7 F16.5 ✅. 8 inventory. 9 Usa `purchase_receipts`. 10 `ListPurchaseHistory` aditivo. 11 Solo lectura. 12 —. 13 —. 14 `inventory:purchase:manage`. 15 S-INV-02 sección «Compras» (ficha a ampliar). 16 —. 17 Costos nunca en la vitrina pública. 18 —. 19 L2. 20 inventory L2; checks. 21 Coincide con las recepciones. 22 —. 23 —. 24 —. 25 —.

## C. Punto de venta

### F17.4 · Estacionar y retomar ventas
1 **F17.4** (cierre: ventas ✅ L2; falta estacionar/retomar).
2 El cajero aparta una venta en curso, atiende a otro cliente y la retoma después sin perder líneas.
3 En la fila del supermercado un cliente olvida algo; sin estacionar, el cajero anula y vuelve a escanear todo.
4 ✅ 2026-10-21 (L1, L2, L4 de humo y en el Pixel 8 Pro).
5 Incluye: `ParkSale` (OPEN → PARKED, nota opcional ≤ 60 caracteres), `ResumeSale` (PARKED → OPEN), lista de estacionadas de la sesión (`ListSales` con `status=PARKED` y `session_id`), anular una estacionada (`VoidSale` existente, motivo obligatorio), cierre de caja bloqueado si hay estacionadas (`SALES_PENDING`), cobro prohibido desde PARKED (corrige auditoría D3).
6 Excluye: reservar existencias al estacionar (**decisión**: una venta de caja no reserva; las existencias se descuentan al pagar con `stock_tasks`, así que estacionar no toca inventory y no hay doble reserva); caducidad automática (Q-46); pasar una estacionada a otra caja o cajero (Q-51).
7 Depende de F17.3 ✅ (sesiones) y del resto de F17.4 ✅.
8 `pos/internal/domain/sale.go`, `pos/internal/store/store.go`, `pos/internal/service/pos.go`, `pos/internal/server/server.go`, `pos/migrations/0002_park.*`, `network-contracts/proto/pos.proto`, `api-gateway/internal/routes/commerce_table.go`, `flutter_app/lib/features/pos/{pos_screen.dart,pos_parked_screen.dart,pos_data.dart}`, `flutter_app/lib/core/api/api_client.dart`.
9 `sales.park_label text NOT NULL DEFAULT ''`, `sales.parked_at timestamptz NULL` (última vez que se estacionó); el índice `sales_by_session (session_id, status)` ya sirve la lista.
10 Aditivo: `Sale.park_label = 25`, `Sale.parked_at = 26`. Rutas `POST /v1/pos/sales/{sale_id}/park` (cuerpo `{label}`) y `POST /v1/pos/sales/{sale_id}/resume`. Sin eventos (estado interno de la caja).
11 Solo el cajero de la sesión (`NOT_SESSION_OWNER`); sesión abierta (`SESSION_CLOSED`); no se estaciona una venta vacía (`EMPTY_SALE`); nota > 60 → `INVALID_REQUEST`; desde un estado distinto → `INVALID_STATE_TRANSITION`; una estacionada no se edita ni se cobra hasta retomarla.
12 La transición y la comprobación de la sesión ocurren en una transacción que bloquea la sesión `FOR SHARE`; el cierre la bloquea `FOR UPDATE` y cuenta OPEN-pendientes y PARKED, así que una venta no puede quedar estacionada en una caja cerrada.
13 Transición por estado: estacionar una estacionada o retomar una abierta devuelve la venta sin cambios (un reintento tras timeout no falla). Cada cambio sube `version`; `UpdateSale` posterior usa la versión devuelta (`VERSION_CONFLICT` si no).
14 `pos:sell`; anular: `pos:void`.
15 S-POS-02: acción «Estacionar» (pide nota opcional) y acceso «Estacionadas ({n})»; S-POS-06: nota, hora con mes en texto, total; «Retomar» (→ S-POS-02 con la venta) y «Anular» (motivo obligatorio, C-05); S-POS-10 e4 ya muestra `SALES_PENDING`.
16 Ninguna nueva (no cambia montos ni documentos).
17 La nota es texto libre del cajero: no se registra en logs (puede contener el nombre del cliente).
18 Errores por el interceptor con `reason` y `request_id`; atributo `pp.sale_id`; prueba de que el `reason` sale del glosario.
19 L1 transiciones de dominio; L2 (`pos/test/test_l2.sh`): estacionar → listar → retomar, cierre bloqueado por estacionada, cobro de estacionada rechazado, reintento idempotente, sesión de otro cajero; gateway: rutas; Flutter: S-POS-06 4 estados y flujo estacionar/retomar, texto al 200 %.
20 `cd pos && go vet ./... && go test -race ./... && ./test/test_l2.sh`; `cd api-gateway && go test -race ./internal/routes/`; `cd flutter_app && flutter analyze && flutter test`; checks.
21 Aceptación: (a) una venta con líneas se estaciona y aparece en S-POS-06; (b) al retomarla conserva líneas, totales y versión nueva; (c) cerrar caja con una estacionada responde `SALES_PENDING`; (d) cobrar una estacionada responde `INVALID_STATE_TRANSITION`; (e) repetir estacionar/retomar no falla ni duplica; (f) L4 de humo en producción contra el gateway.
22 Respaldo `pg_dump -n pos`; migración 0002 (aditiva) antes del binario; desplegar pos y api-gateway; release de la app.
23 Las columnas nuevas son ignoradas por el binario anterior; no se borran datos. Una venta PARKED con el binario anterior solo puede anularse (comportamiento previo).
24 `status.md` F17.4: pruebas `TestR13_*`, `TestL2_R13_*`, `pos_parked_test.dart`; despliegue con respaldo `~/plentypay-backups/pos-before-0002-*.sql.gz`.
25 F16.4 (lotes) o F17.9 (devoluciones, parcial).

### F17.9 · Devoluciones
1 F17.9 (anulación ✅; devoluciones abiertas). 2 Devolver líneas de una venta pagada con reintegro por el mismo medio, reingreso opcional a inventario y nota de crédito si hubo factura. 3 Hoy una venta pagada no se puede deshacer en caja. 4 📝. 5 `RefundSale` por líneas y cantidades; reintegro en efectivo (salida de caja) o saldo PlentyPay (`payments.RefundPayment`, T7); RETURN a inventario por línea si «Regresa al inventario»; estado PARTIALLY_REFUNDED/REFUNDED; nota de crédito con `fiscal.IssueCreditNote` cuando hubo factura. 6 Efectivo por venta electrónica, vales y plazos (Q-47); reverso de puntos (F17.16). 7 F11.6 (reembolsos T7, 📝 por L4), F13.7 ✅. 8 pos (dominio, store, service, `refund_tasks` análogas a `stock_tasks`), gateway, S-POS-08. 9 `refunds(id, sale_id, lines jsonb, reason, restock, created_by, created_at)`; `sales.refunded_minor`. 10 `RefundSaleRequest` existe; agregar `Refund` en `Sale` (aditivo). 11 R9 (≤ vendido − devuelto, `EXCEEDS_SOLD_QTY`); reparto por medio en orden inverso; motivo obligatorio; 🔒. 12 Devolución + salida de caja + tareas (reembolso, RETURN, nota) en una transacción de pos; cada tarea se entrega con reintento y clave `refund:<id>:<medio>`; un reembolso electrónico en UNKNOWN deja la devolución «por confirmar», nunca «devuelta». 13 `idempotency_key` + `FOR UPDATE` de la venta: dos devoluciones simultáneas no superan lo vendido. 14 `pos:refund` 🔒. 15 S-POS-08 (e1–e6), S-POS-07 «Devolver». 16 N-FIS-08, N-CON-03. 17 Sin datos de tarjeta (no hay tarjeta en caja). 18 `pp.refund_id`; métrica de tareas pendientes. 19 L2 aceptación 4 del SPEC; concurrencia de dos devoluciones; L4 con saldo PlentyPay. 20 pos L2; payments-core L2; checks. 21 Aceptación 4 del SPEC. 22 Migración aditiva; respaldo. 23 Una devolución hecha no se revierte: se corrige con una venta nueva. 24 —. 25 F17.7.

### F17.11 · Configuración de caja
1 F17.11 (nuevo; RPC ya en el contrato). 2 `GetPosSettings`/`UpdatePosSettings` reales y S-POS-11 conectada. 3 S-POS-11 tiene datos fijos y no se alcanza (auditoría D6). 4 📋. 5 Precios con ITBMS incluido, tope de descuento, medios activos, documento por defecto, ventas sin conexión, pie del recibo. 6 Propina (Q-21), lealtad (F17.15), equipos (F24). 7 —. 8 pos (tabla `pos_settings` por tenant), gateway, S-POS-11. 9 `pos_settings(tenant_id PK, settings jsonb, version)`. 10 `PosSettings` existe. 11 Valores con límites; medios solo de los habilitados por payments-core. 12 —. 13 `version` + `idempotency_key`. 14 Leer `pos:sell`; cambiar `pos:settings:manage`. 15 S-POS-11 sin secciones que dependan de pasos abiertos. 16 N-FIS-01 (aviso del recibo interno). 17 —. 18 —. 19 L2 + widget. 20 pos L2; checks. 21 Un cambio de tope de descuento rige en la siguiente venta. 22 Migración aditiva. 23 Valores por defecto. 24 —. 25 F17.15.

### F17.12 · Sucursal en cajas y ventas
1 F17.12 (nuevo). 2 Cada caja pertenece a una sucursal y pos aplica `x-pp-branch-scope`. 3 Auditoría D5. 4 📋. 5 `terminals.branch_id`, `sales.branch_id` (copiado de la caja), validación en apertura, venta, anulación y devolución; reporte Z por sucursal. 6 —. 7 F16.9 (mismo patrón). 8 pos tenancy, store, migración. 9 Como F16.9. 10 `Terminal.branch_id`, `Sale.branch_id` aditivos. 11 `BRANCH_OUT_OF_SCOPE`. 12 —. 13 —. 14 Alcance `S`. 15 S-POS-01 muestra la sucursal. 16 N-FIS (código de sucursal DGI en el documento, F13). 17 Aislamiento entre sucursales. 18 `pp.branch_id`. 19 L2. 20 pos L2; checks. 21 Un cajero con alcance a una sucursal no abre cajas de otra. 22 Dos pasos como F16.9. 23 —. 24 —. 25 F17.13.

### F17.13 · Cambio de turno y sesiones abandonadas
1 F17.13 (nuevo). 2 Relevo de cajero auditado y tratamiento de cajas que quedan abiertas. 3 Un cajero se va sin cerrar y nadie puede vender en esa caja. 4 📋. 5 Supuesto de Q-51: relevo = cierre con arqueo + nueva apertura; cierre forzado por un gerente (`pos:session:manage` + 🔒) con conteo y nota; aviso de caja abierta > 12 h. 6 Sesión compartida o PIN común (prohibido). 7 F17.3, F08 (step-up ADR 0020). 8 pos, identity (step-up), S-POS-10. 9 `cash_sessions.closed_by`, `forced bool`. 10 `CloseCashSessionRequest.step_up_token` aditivo. 11 Solo el dueño de la sesión o un gerente con 🔒; las estacionadas se anulan antes (F17.4). 12 Cierre en una transacción. 13 Clave de cierre. 14 `pos:session:manage`. 15 S-POS-10 «Cerrar caja de otro cajero». 16 —. 17 Identificación siempre por la cuenta del empleado y su factor (ADR 0020), nunca por PIN compartido. 18 Evento de auditoría de cierre forzado. 19 L2. 20 pos L2; checks. 21 Relevo sin perder ventas ni efectivo. 22 Aditivo. 23 —. 24 —. 25 —.

### F17.14 · Correcciones posteriores a la venta
1 F17.14 (nuevo). 2 Distinguir y ejecutar cada tipo de corrección con el mecanismo de su dominio. 3 «Ajustar» una venta mezcla inventario, pago, comercio y fisco. 4 📋. 5 Tabla de decisión en S-POS-07: inventario → ajuste (S-INV-03); medio de pago equivocado → devolución + nuevo cobro (F17.9); precio o cantidad → devolución parcial; datos fiscales → nota de crédito y factura nueva (F13.7); factura posterior a un recibo interno → `IssueInvoice` con la venta (S-POS-07 «Emitir factura»). 6 Editar una venta pagada (nunca). 7 F17.9, F13.5. 8 S-POS-07, pos. 9 Sin tablas nuevas. 10 —. 11 Nada se borra; cada corrección referencia la venta. 12 La de cada mecanismo. 13 La de cada mecanismo. 14 La de cada mecanismo. 15 S-POS-07 acciones. 16 N-FIS-08. 17 —. 18 —. 19 Widget de la tabla. 20 `flutter test`; checks. 21 Toda corrección deja rastro antes/después. 22 —. 23 —. 24 —. 25 —.

### F13.5 · Cierre: factura desde la venta
1 F13.5 (abierto: «falta que pos/orders la llamen al vender»). 2 Al pagar una venta, pos u orders piden la factura según la preferencia (S-POS-04). 3 Hoy la factura solo se emite a mano. 4 📝. 5 Tarea durable `invoice_tasks` en pos (patrón `stock_tasks`) que llama `fiscal.IssueInvoice` con `source=pos_sale:<id>`; el recibo muestra «Comprobante en proceso de autorización» hasta `InvoiceAccepted`; orders igual por sub-pedido. 6 PDF/XML (F13.6). 7 F13.5 servidor ✅ L2. 8 pos, orders, fiscal-invoicing (consumidor), S-POS-05. 9 `invoice_tasks`. 10 `Sale.invoice_id` existe. 11 Una venta cobrada pero no certificada **no** se presenta como factura emitida (N-FIS). 12 Tarea nace con el pago. 13 Idempotente por origen (R6 de fiscal). 14 Servicio. 15 S-POS-05 estado del documento. 16 N-FIS-01..08. 17 RUC del cliente solo si lo pide. 18 Backlog de tareas como métrica. 19 L2 + L4 con simulador. 20 pos/fiscal L2; checks. 21 Venta pagada → factura aceptada por el simulador. 22 Migración aditiva. 23 Tareas en cola se vacían sin efecto. 24 —. 25 F13.6.

## D. Pagos y medios de cobro
Los pasos viven en F11 y F23; aquí solo el mapa y lo nuevo.

| Medio | Estado real | Paso | Bloqueo |
|---|---|---|---|
| Efectivo | ✅ en caja | F17.5 | — |
| Saldo PlentyPay | ✅ (sandbox de rieles externos) | F11, F17.5 | — |
| Pago dividido | ✅ efectivo + saldo | F17.5 | — |
| Yappy, TELERED | adaptador sandbox | F23 | ⛔ Q-02 |
| Tarjeta, Apple/Google Pay, Tap to Pay | oculto por flag | F23.6 | ⛔ Q-03 |
| QR interoperable | sandbox | F23 | ⛔ Q-02 |
| NFC de etiquetas (abrir un cobro) | L1 | F23.2 | Dispositivo físico |
| Cupones, tarjetas de regalo | no existe | F17.18 | ⛔ Q-48 |
| Propinas | desactivadas | F17.19 | ⛔ Q-21 |

NFC: leer una etiqueta que abre un enlace de cobro (F23.2) **no** es aceptar tarjetas sin contacto; eso exige el SDK certificado de un PSP (Q-03) y queda oculto hasta entonces.

### F17.18 · Cupones y tarjetas de regalo
1 F17.18 (nuevo). 2 Emitir y canjear cupones y tarjetas de regalo por comercio. 3 Pedido comercial frecuente. 4 ⛔ Q-48. 5–25 Se completan cuando Q-48 se responda; mientras tanto el medio no aparece en caja.

### F17.19 · Propinas
1 F17.19 (nuevo). 2 Registrar propina separada de la venta y repartirla. 3 Restaurantes y barberías. 4 ⛔ Q-21. 5 Propina como línea propia fuera de la base imponible si Q-21 lo confirma; reparto por cajero o por regla. 6–25 Se completan con Q-21.

## E. Facturación fiscal
Pasos F13.1–F13.9 en la hoja de ruta; arquitectura en `fiscal-invoicing/SPEC.md` y ADR 0022 (PAC neutral). Lo comercial nuevo es [F13.5 · Cierre](#f135--cierre-factura-desde-la-venta). Recordatorio de dominio: recibo comercial (pos, R10) ≠ factura fiscal (fiscal-invoicing, certificada por un PAC) ≠ respuesta de pago (payments-core). La factura de un proveedor que llega con una compra se guarda como número en la recepción (`supplier_invoice`), no es un documento fiscal emitido por PlentyPay. Producción del PAC: ⛔ Q-11.

## F. Entregas y logística
logistics no tiene servidor (0/17 RPC). F18.1–F18.7 de la hoja de ruta siguen siendo el camino; la máquina de estados es `domain-model.md` §8.11. Una entrega **referencia** su origen (venta de pos con R12, sub-pedido de orders) y nunca crea otra venta.

### F18.8 · Confirmación de entrega con QR de un solo uso
1 F18.8 (nuevo; concreta el «código» de F18.4). 2 El repartidor confirma la entrega escaneando un QR que muestra el cliente. 3 Un código estático o reutilizable permite marcar entregas falsas. 4 📋. 5 Token aleatorio de 128 bits por entrega guardado como hash, ligado a `(tenant, delivery_id)`, vence al cerrar la entrega o a las 24 h, se consume una vez en el servidor; respaldo: código de 6 dígitos con 5 intentos (`PICKUP_CODE_MISMATCH` ya existe en orders). 6 Firma y foto (F18.4). 7 F18.2. 8 logistics, S-LOG-06/07. 9 `delivery_tokens(delivery_id PK, hash, expires_at, used_at)`. 10 `RecordCheckpoint` con `proof_token` aditivo. 11 Token de otra entrega, vencido o usado → rechazo con `reason` nuevo (se agrega al glosario al implementar). 12 Consumo del token + checkpoint DELIVERED + outbox en una transacción. 13 Consumo con `UPDATE … WHERE used_at IS NULL`; un reintento con el mismo token tras éxito devuelve el mismo checkpoint. 14 `logistics:deliver` del repartidor asignado. 15 S-LOG-07 muestra el QR; S-LOG-06 escanea. 16 N-LOG-03. 17 El QR no contiene datos personales; sin conexión el repartidor guarda el escaneo y lo confirma al reconectar (nunca se da por entregado localmente). 18 Intentos fallidos como métrica. 19 L2: no confirma otra entrega, no se reutiliza, vence. 20 logistics L2; checks. 21 Pruebas de §12.2 del encargo. 22 Requiere logistics desplegado. 23 —. 24 —. 25 F18.5.

### F18.5 · Seguimiento en mapa (futuro)
1 F18.5. 2 El cliente ve al repartidor en un mapa. 3 —. 4 ⛔ Q-49 y F14 (geolocation sin servidor). 5 Arquitectura: el repartidor envía posiciones a geolocation (`IngestLocations`) con frecuencia adaptativa; logistics publica el stream por entrega; el cliente consulta con el token público de seguimiento (sin datos personales, R5 de logistics); posiciones con TTL; posición obsoleta > 2 min se muestra como «sin señal». 6 Mientras falte: **ningún mapa, coordenada ni ruta simulada**; solo el estado. 7–25 Se completan con Q-49 y F14.

## G. Vitrina digital y pedidos en línea
Un solo sistema de pedidos (orders) y un solo catálogo (catalog): la vitrina de un comercio es el marketplace filtrado por ese comercio (`GetStorefront`), y un carrito de un comercio es un carrito multi-comercio con un solo comercio. El servidor recotiza siempre (orders R3). Pasos abiertos: F15.8 y F15.9 (L4), F15.10 (integration_test).

### F15.13 · Aviso de pedido entrante en tiempo real
1 F15.13 (nuevo). 2 El comercio se entera al instante de un pedido nuevo. 3 Hoy debe refrescar la bandeja; con plazo de aceptación de 15 min se pierden pedidos. 4 📋. 5 Consumidor de `OrderPlaced` en notifications → bandeja in-app y push al comercio; sonido configurable (S-POS-11 «Pedidos»). 6 WhatsApp/SMS (F20.7). 7 F20.3, F20.4. 8 notifications, flutter_app. 9 —. 10 Suscripción R2 de notifications. 11 Solo a quien tiene `orders:manage` del tenant. 12 —. 13 `dedupe_key` de notifications. 14 `orders:manage`. 15 S-ORD (bandeja) con insignia. 16 N-DAT (sin datos del comprador en la notificación). 17 —. 18 Latencia evento→aviso. 19 L4. 20 —. 21 Aviso en < 5 s. 22 notifications desplegado. 23 —. 24 —. 25 —.

## H. Lealtad
Libro de movimientos: el ledger (cuenta `LOYALTY_POINTS`, plantilla T8, `domain-model.md` §5). Ningún saldo de puntos se edita: todo es un asiento.

### F17.15 · Programa de lealtad: reglas
1 F17.15 (nuevo). 2 El comercio define cuántos puntos da por dólar, qué excluye y cuánto vale un punto al canjear. 3 Fidelizar clientes sin herramientas externas. 4 📋 (activación ⛔ Q-45). 5 Programa por tenant: activo, puntos por cada $1 (entero), valor del punto en centavos, exclusiones por categoría o producto, mínimo para canjear; versión del programa guardada en cada asiento. 6 Caducidad (Q-45), niveles. 7 F17.11. 8 pos (configuración) — **sin contenedor nuevo**. 9 `loyalty_programs(tenant_id, version, rules jsonb, active)`. 10 Aditivo en `PosSettings`. 11 Cambiar reglas crea una versión nueva; las ventas pasadas conservan la suya. 12 —. 13 `version`. 14 Nuevo `loyalty:manage` 🔒; leer `loyalty:read`. 15 S-POS-11 sección «Lealtad». 16 Q-45. 17 —. 18 —. 19 L2. 20 pos L2; checks. 21 Programa desactivado por defecto. 22 Aditivo. 23 Desactivar. 24 —. 25 F17.16.

### F17.16 · Acumulación y reversión de puntos
1 F17.16 (nuevo). 2 Al pagar una venta con cliente identificado se acreditan puntos; al devolver, se revierten. 3 —. 4 📋. 5 Tarea durable `loyalty_tasks` (patrón `stock_tasks`) que llama `payments.PostMemoEntry` T8 con clave `loyalty:<sale_id>`; reversión proporcional con `loyalty-rev:<refund_id>`. 6 Canje (F17.17). 7 F17.6 (asiento T8), F17.15, F17.9. 8 pos, payments-core, ledger. 9 `loyalty_tasks`. 10 `PostMemoEntry` (pendiente en el contrato, status «Contratos pendientes»). 11 Base: total pagado sin impuestos ni líneas excluidas; `floor` de puntos. 12 Tarea nace con el pago o la devolución. 13 Clave del asiento. 14 Servicio. 15 S-POS-05 «Puntos ganados». 16 Q-45. 17 Cliente identificado con su consentimiento (N-DAT). 18 Backlog. 19 L2 + L4 balance T8. 20 pos/payments L2; checks. 21 Saldo de puntos = Σ asientos. 22 —. 23 —. 24 —. 25 F17.17.

### F17.17 · Canje de puntos en el cobro
1 F17.17 (nuevo). 2 Pagar parte de la venta con puntos. 3 —. 4 📋. 5 Medio «Puntos» en S-POS-03 e7 con `INSUFFICIENT_POINTS`; asiento de canje T8 inverso con `redeem:<tender_id>`. 6 —. 7 F17.16. 8 pos, payments-core. 9 —. 10 `Tender` con riel de puntos (aditivo). 11 Mínimo de canje; nunca saldo negativo. 12 El canje se confirma antes de dar la venta por pagada. 13 Clave del tender. 14 `pos:sell`. 15 S-POS-03 e7. 16 Q-45 (ITBMS del canje). 17 —. 18 —. 19 L2 + L4. 20 —. 21 —. 22 —. 23 —. 24 —. 25 —.

## I. Roles, cuentas y alcance
El modelo ya está decidido (ADR 0018, `docs/domain/business-profiles-and-access.md`): permisos asignables, plantillas, alcance `TENANT`/`BRANCHES` propagado por el gateway. Lo que falta es **aplicarlo** en comercio: [F16.9](#f169--sucursal-en-bodegas-y-alcance) y [F17.12](#f1712--sucursal-en-cajas-y-ventas). Los permisos nuevos de este plan son solo `loyalty:read` y `loyalty:manage` (F17.15).
