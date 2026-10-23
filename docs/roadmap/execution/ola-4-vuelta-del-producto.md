# Ola 4 · El producto completa su vuelta

**Qué cierra**: el producto nace bien en el catálogo, se compra con costo e impuesto, vuelve al proveedor o al lote correcto si se devuelve, y toda corrección deja rastro. Etapas: P0, P1, P2, P8 ([`../lifecycles.md`](../lifecycles.md)). Procedimiento común: [`README.md`](README.md) §2.

| # | Paso | Contenedores | Nivel | Precedencia | Bloqueo |
|---|---|---|---|---|---|
| 1 | [F16.13](#f1613--historial-de-compras-y-costo-de-adquisición) Historial de compras y costo | inventory, app | L2 | F16.5 ✅ | costo de lo vendido ⛔ Q-52 |
| 2 | [Orden de compra con ITBMS y envío](#s-inv-05--itbms-por-línea-y-envío-al-proveedor) | inventory, notifications, app | L2 | F20.2 (envío) | — |
| 3 | [F16.15](#f1615--devolución-al-proveedor) Devolución al proveedor | inventory, app | L2 | F16.12 ✅ | — |
| 3b | [F16.17](#f1617--cuentas-por-pagar-a-proveedores-opcional) Cuentas por pagar a proveedores (opcional) | inventory, app | L2 | F16.13, F16.15 | — (Q-55 resuelta) |
| 4 | [F17.20](#f1720--devolución-al-lote-original) Devolución al lote original | pos, inventory | L2 | F16.4 ✅, F17.9 | — |
| 5 | [F17.14](#f1714--correcciones-posteriores-a-la-venta) Correcciones posteriores a la venta | flutter_app, pos | L1 | F17.9, F13.5 | — |
| 6 | [F15.1](#f151--variantes-y-precio-por-sucursal) Variantes y precio por sucursal | catalog, inventory, pos, orders, app | L2 | — | — |
| 7 | [F15.2](#f152--imágenes-con-url-prefirmada-y-verificación) Imágenes prefirmadas y verificación | catalog, object-storage | L2 | — | antivirus: ver ficha |
| 8 | [F15.11](#f1511--ficha-de-producto-por-categoría) Ficha por categoría | catalog, app | L2 | F15.1 | — |
| 9 | [F15.12](#f1512--historial-de-cambios-del-producto) Historial de cambios del producto | catalog, app | L2 | — | — |
| 10 | [F15.3](#f153--importación-masiva) Importación masiva | catalog, app | L2 | F15.1, F15.11 | — |
| 11 | [F15.5](#f155--búsqueda-con-atributos) Búsqueda con atributos | catalog, nosql | L2 | F15.11 | cercanía espera F14 |

---

### F16.13 · Historial de compras y costo de adquisición
Ficha de diseño: [commerce-plan F16.13](../commerce-plan.md#f1613--historial-de-compras-y-costo-de-adquisición) · Ciclo P1 · Nivel L2 · Estado 📋.
- **Bloqueo**: el **costo de lo vendido y el margen** esperan Q-52 (método de valoración). Este paso entrega solo historial y costo de adquisición **como información**; no calcula costo de lo vendido ni lo presenta como dato contable.
- **Leer antes**: `inventory/internal/store/purchasing.go` (`purchase_receipts`, `purchase_order_lines.unit_cost_minor`), `inventory/SPEC.md` §4.
- **Resultado observable**: en el detalle de un producto, la sección «Compras» lista cada recepción (fecha con mes en texto, proveedor, orden, cantidad recibida, dañada, costo unitario) y muestra «Último costo» y «Costo promedio de las últimas 5 recepciones».
- **Contrato** (`inventory.proto`, aditivo): `rpc ListPurchaseHistory(ListPurchaseHistoryRequest) returns (ListPurchaseHistoryResponse)`; `ListPurchaseHistoryRequest { string product_id = 1; string supplier_id = 2; string warehouse_id = 3; plentypay.common.v1.PageRequest page = 4; }`; `PurchaseHistoryEntry { string purchase_order_id = 1; string receipt_id = 2; string supplier_id = 3; string supplier_name = 4; string warehouse_id = 5; int64 received_milli = 6; int64 damaged_milli = 7; plentypay.common.v1.Money unit_cost = 8; google.protobuf.Timestamp received_at = 9; }`; respuesta con `entries`, `page`, `last_unit_cost`, `avg_unit_cost_last5` (Money).
- **Datos**: hoy `purchase_receipts` no guarda cantidades por línea: agregar `purchase_receipt_lines(receipt_id, tenant_id, product_id, received_milli, damaged_milli, unit_cost_minor, lot_code)` en `inventory/migrations/0007_receipt_lines` (o el siguiente libre) escrita por `ReceiptHook` en la misma transacción; las recepciones anteriores se reconstruyen desde los movimientos RECEIPT con `reference = purchase_order` (comando de relleno idempotente, documentado).
- **Código**: store consulta paginada por producto; promedio = Σ costo / n con `half_up` (centavos enteros); server con `inventory:purchase:manage`.
- **Gateway / app**: `GET /v1/inventory/purchase-history?product_id=&supplier_id=` ; S-INV-02 sección «Compras» (ampliar la ficha primero); costos **nunca** en la vitrina pública.
- **Pruebas**: L2 `TestL2_F16_13_HistoryMatchesReceipts` (dos recepciones con costos distintos → entradas, último y promedio exactos), `TestL2_F16_13_DamagedIsShown`; widget de la sección.
- **Terminado cuando**: «Coincide con las recepciones» (05).

### S-INV-05 · ITBMS por línea y envío al proveedor
Pendiente declarado en la ficha S-INV-05 (`*Pendiente*: ITBMS por línea y el envío al proveedor por correo con PDF`) · Ciclo P1 · Nivel L2.
- **Precedencia**: el envío necesita notifications (ola 2, F20.2). El ITBMS no.
- **Resultado observable**: la orden muestra subtotal, ITBMS por tasa y total; «Enviar al proveedor» manda el PDF por correo y lo registra.
- **Contrato**: `PurchaseOrderLine.tax_rate_bps = 6` (o siguiente libre), `PurchaseOrder.tax_total = 12`, `PurchaseOrder.subtotal = 13`; `rpc SendPurchaseOrder(SendPurchaseOrderRequest)` (envía por notifications; requiere correo del proveedor).
- **Reglas**: la tasa válida se lee de `legal.pa.itbms.*` en infra-management con la fecha de la orden (AGENTS §2.13), igual que fiscal-invoicing R1; el costo unitario se interpreta **sin** ITBMS (documentarlo en el SPEC).
- **Pruebas**: L1 de totales con vectores (`half_up` por línea); L2 `TestL2_PO_TaxTotalsByRate`; envío con notifications en modo log.
- **Terminado cuando**: la orden cuadra por tasa y el envío queda registrado una vez.

### F16.15 · Devolución al proveedor
Ficha corta: [`../lifecycles.md`](../lifecycles.md) §5 · Ciclo P2 · Nivel L2 · Estado 📋 (paso nuevo).
- **Leer antes**: R9 y R10 de `inventory/SPEC.md`; `inventory/internal/domain/stock.go` (`MovementType`, `Validate`, `Apply`).
- **Resultado observable**: desde una orden recibida, «Devolver al proveedor» saca N unidades (de lo bloqueado si se marca «dañado») con nota del proveedor; la orden muestra lo devuelto.
- **Contrato**: `MOVEMENT_TYPE_RETURN_TO_SUPPLIER = 10` (enum aditivo); `rpc ReturnToSupplier(ReturnToSupplierRequest) returns (PurchaseOrder)` con `purchase_order_id`, `idempotency_key`, `lines {product_id, quantity_milli, lot_code, from_blocked}`, `supplier_note`; `PurchaseOrderLine.returned_milli`.
- **Datos**: migración siguiente: `movements` acepta tipo 10; `purchase_order_lines.returned_milli` con `CHECK (returned_milli <= received_milli)`; incidencia `RETURNED` (kind 3) en `purchase_receipt_issues`.
- **Reglas**: nunca más de lo recibido de esa orden menos lo ya devuelto; con `from_blocked` escribe UNBLOCK + RETURN_TO_SUPPLIER con la misma clave (como la baja de lo bloqueado de F16.10); R1 y bloqueado = Σ siguen cuadrando.
- **Permisos**: `inventory:purchase:manage`.
- **Pruebas**: L1 `TestF16_15_ReturnSignAndCap`; L2 `TestL2_F16_15_ReturnFromBlockedKeepsR1`, `TestL2_F16_15_ConcurrentReturnsNeverExceedReceived`.
- **Terminado cuando**: el criterio de la ficha corta.

### F16.17 · Cuentas por pagar a proveedores (opcional)
Ciclo P1 · M6 · Nivel L2 · Estado 📋 (paso nuevo; Q-55 resuelta el 2026-10-23: **configurable por comercio**).
- **Precedencia**: F16.13 (líneas de recepción con costo) y F16.15 (devoluciones que reducen la deuda).
- **Decisión vigente**: módulo **opcional, apagado por defecto**. Con el módulo apagado nada cambia: la compra se registra igual (existencias y costo). Con el módulo activo, PlentyPay lleva la deuda del comercio con cada proveedor y los pagos que el comercio **registra** (pago hecho por fuera: transferencia, cheque, efectivo). Pagar al proveedor **desde la billetera** del comercio movería dinero en el ledger (no hay plantilla para pagar a quien no es usuario de PlentyPay): queda fuera de este paso y, si se quiere, es una pregunta nueva con su plantilla (como Q-56).
- **Resultado observable**: el dueño activa «Cuentas por pagar» (S-INV-07, actualizar la ficha); cada recepción crea la deuda (Σ costo × recibido, ITBMS si la orden lo trae); una devolución al proveedor la reduce; el dueño registra un pago con fecha, medio y referencia; ve por proveedor lo pendiente y lo vencido según los días de crédito.
- **Contrato** (`inventory.proto`, aditivo): `InventorySettings.payables_enabled = 2`; `Supplier.credit_days = …` (siguiente libre); `rpc ListPayables(ListPayablesRequest) returns (ListPayablesResponse)` (por proveedor: `owed`, `paid`, `balance`, `overdue`); `rpc RecordSupplierPayment(RecordSupplierPaymentRequest) returns (SupplierPayment)` con `idempotency_key`, `supplier_id`, `amount`, `paid_on`, `method` (`TRANSFER|CHECK|CASH|OTHER`), `reference` (≤ 60), `note`.
- **Datos**: `supplier_payables(id, tenant_id, supplier_id, purchase_order_id, receipt_id, amount_minor, due_on, created_at)` (una por recepción, inmutable; las devoluciones crean una fila negativa), `supplier_payments(id, tenant_id, supplier_id, amount_minor, paid_on, method, reference, note, created_by, idempotency_key UNIQUE, created_at)` inmutable (un pago equivocado se corrige con otro de signo contrario y motivo, nunca se borra).
- **Reglas**: saldo del proveedor = Σ deudas − Σ pagos; un pago no puede dejar el saldo negativo salvo que se marque «anticipo» (decisión menor del paso: si hay duda, no permitir y preguntar); montos en centavos; vencimiento = fecha de recepción + `credit_days`.
- **Permisos**: ver y registrar pagos: `inventory:purchase:manage`; activar el módulo: `inventory:purchase:manage` (o uno nuevo `inventory:payables:manage` si se quiere separar funciones: agregarlo a identity y al glosario en el mismo cambio).
- **Pruebas**: L1 `TestF16_17_BalanceIsDebtsMinusPayments`; L2 `TestL2_F16_17_ModuleOffChangesNothing`, `TestL2_F16_17_ReceiptCreatesPayableOnce`, `TestL2_F16_17_ConcurrentPaymentsNeverOverpay`, `TestL2_F16_17_ReturnReducesPayable`.
- **Terminado cuando**: el criterio de [`../lifecycles.md`](../lifecycles.md) §5 (F16.17) con L2.

### F17.20 · Devolución al lote original
Ficha corta: [`../lifecycles.md`](../lifecycles.md) §5 · Ciclo P8 · Nivel L2 · Estado 📋 (paso nuevo; nota abierta de F17.9: «Volver al lote original queda pendiente»).
- **Resultado observable**: vender 3 de un lote y devolver 1 con reingreso deja ese lote con +1.
- **Contrato**: inventory devuelve los movimientos (con `lot_code`) al descontar una venta: verificar que `AdjustStock` responde el movimiento con lote; pos guarda por línea los lotes descontados. Campo aditivo `SaleLine.lots` (repeated `{lot_code, quantity_milli}`) o tabla interna de pos sin cambio de contrato (preferible: tabla interna).
- **Datos**: pos `sale_line_lots(sale_id, line_id, lot_code, quantity_milli)` escrita por el worker de `stock_tasks` con la respuesta de inventory.
- **Código**: tareas RETURN de pos (`refund_tasks`) mandan `lot_code` según lo descontado (FEFO inverso: primero el lote que salió último); inventory acepta RETURN con lote (hoy lo ignora: `inventory/internal/service/inventory.go`, comentario «Una devolución de caja (RETURN) reingresa sin lote»).
- **Pruebas**: L2 pos + inventory `TestL2_F17_20_ReturnGoesBackToSoldLot`, producto sin lotes sin cambio.
- **Terminado cuando**: el criterio de la ficha corta.

### F17.14 · Correcciones posteriores a la venta
Ficha de diseño: [commerce-plan F17.14](../commerce-plan.md#f1714--correcciones-posteriores-a-la-venta) · Nivel L1 · Estado 📋.
- **Precedencia**: F17.9, F13.5.
- **Resultado observable**: en el recibo (S-POS-07), «Corregir» abre una tabla de decisión que lleva a cada mecanismo: ajuste de inventario, devolución + cobro nuevo, devolución parcial, nota de crédito + factura nueva, «Emitir factura» de un recibo interno. Ninguna corrección edita la venta.
- **Código**: solo app (S-POS-07); «Emitir factura» llama a fiscal con la venta (F13.5).
- **Pruebas**: widget `test('F17.14 S-POS-07: cada corrección abre su mecanismo y ninguna edita la venta', ...)`.
- **Terminado cuando**: «Ninguna corrección edita una venta pagada» (05).

### F15.1 · Variantes y precio por sucursal
Ciclo P0, P4 · Nivel L2 · Estado 📝 (productos simples con L2).
- **Leer antes**: `catalog/SPEC.md` R1–R3 y §3 (modelo con variantes, si está), `catalog.proto` (`Product`), contrato de inventory (hoy usa `product_id`; el SPEC de inventory habla de `variant_id`).
- **Decisión a documentar primero**: hoy inventario, caja y pedidos usan `product_id`. Introducir variantes exige elegir: (a) la variante es un `product_id` hijo con `parent_product_id` (sin cambiar inventory/pos/orders), o (b) `variant_id` en todos los contratos. **(a)** es aditiva y no rompe nada; si el SPEC dice otra cosa, prevalece el SPEC y se registra la diferencia en `open-questions.md`.
- **Resultado observable**: «Camiseta» con variantes talla S/M/L, cada una con su SKU, código, existencia y precio; precio de sucursal manda sobre el general en caja.
- **Contrato** (con la opción a): `Product.parent_product_id`, `Product.variant_attributes` (map), `rpc SetBranchPrice` / `Product.branch_prices` (repeated `{branch_id, price}`).
- **Pruebas**: L2 `TestR1_VariantSKUUniquePerTenant`, `TestR2_BranchPriceOverridesBase` (caja de la sucursal B cobra el precio de B), `TestR3_PriceChangeDoesNotAlterPastSales`.
- **Terminado cuando**: «R1–R3» (05) con variantes y precio por sucursal.

### F15.2 · Imágenes con URL prefirmada y verificación
Nivel L2 · Estado 📝.
- **Qué falta**: URL prefirmada de subida (clave generada por el servidor) y verificación R6 al confirmar (tipo por *magic bytes*; antivirus antes de publicar). Si no hay antivirus en el entorno, la imagen queda «en revisión» y no se publica: documentarlo y preguntar al dueño (no publicar sin verificar).
- **Pruebas**: L2 `TestR6_WrongMagicBytesIsRejected`, `TestR6_UnverifiedImageIsNotPublic`.
- **Terminado cuando**: «R6» (05).

### F15.11 · Ficha de producto por categoría
Ficha de diseño: [commerce-plan F15.11](../commerce-plan.md#f1511--ficha-de-producto-por-categoría) · Nivel L2 · Estado 📋.
- **Resultado observable**: un abarrote crea un producto con nombre, precio y código en un solo paso; una farmacia ve y debe llenar registro sanitario y lote/vencimiento.
- **Contrato**: `Product.attributes` (map o `google.protobuf.Struct`) y `rpc ListProductTemplates` (plantillas por vertical del perfil del negocio, ADR 0018 §3).
- **Datos**: `products.attributes` ya existe como `jsonb` (verificar); plantillas como datos versionados en catalog (`product_templates`).
- **Pruebas**: L2 por plantilla `TestF15_11_RequiredFieldOfTemplateIsValidatedOnServer`.
- **Terminado cuando**: «Alta rápida con lo mínimo; campo obligatorio de la plantilla validado en el servidor» (05).

### F15.12 · Historial de cambios del producto
Ficha de diseño: [commerce-plan F15.12](../commerce-plan.md#f1512--historial-de-cambios-del-producto) · Nivel L2 · Estado 📋.
- **Datos**: `product_changes(id, tenant_id, product_id, field, before jsonb, after jsonb, actor_user_id, changed_at)` inmutable (sin UPDATE/DELETE), escrita en la misma transacción que el cambio.
- **Contrato**: `rpc ListProductChanges`.
- **Pruebas**: L2 `TestF15_12_EveryUpsertLeavesOneRow`.
- **Terminado cuando**: «Cada cambio deja su fila inmutable en la misma transacción» (05).

### F15.3 · Importación masiva
Nivel L2 · Estado 📋 (`BulkImportProducts` responde `UNIMPLEMENTED`).
- **Resultado observable**: subir un CSV de 10 000 filas con 3 % de errores devuelve el resultado por fila y crea los válidos; repetir la carga no duplica.
- **Formato**: documentar en `catalog/SPEC.md` (cabecera, columnas, unidades, GTIN normalizado N-STD-23, tasa por código, lote si aplica).
- **Código**: el archivo se sube a object-storage con URL prefirmada; un job procesa por lotes de 500 con idempotencia por `(tenant, sku)`; resultado descargable.
- **Pruebas**: L2 `TestSPEC11_Import10kRowsWith3PercentErrors`.
- **Terminado cuando**: «Prueba de aceptación (10 000 filas)» (05).

### F15.5 · Búsqueda con atributos
Nivel L2 · Estado 📝 (búsqueda en PostgreSQL con R7 ✅).
- **Qué falta**: atributos en Scylla (o en PostgreSQL con índice GIN si el SPEC lo permite: registrar la decisión) y búsqueda por cercanía (espera F14, ola 5).
- **Pruebas**: L2 `TestR7_SearchByAttributeOnlyActiveTenantsInStock`.
- **Terminado cuando**: «R7» (05) con atributos; cercanía citada como dependiente de F14.
