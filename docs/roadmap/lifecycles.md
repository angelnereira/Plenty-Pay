# Hoja de ruta por ciclos de vida: el producto y el dinero

Vista transversal del roadmap. **No cambia el orden ni las precedencias** de [`05-HOJA-DE-RUTA-30-FASES.md`](../../05-HOJA-DE-RUTA-30-FASES.md) y [`phase-matrix.md`](phase-matrix.md): ordena los pasos que ya existen (y los pocos que faltan) según el recorrido real de **una unidad de producto** —desde que el comercio la compra hasta que llega al cliente final y vuelve, si vuelve— y de **un dólar** —desde que entra a PlentyPay hasta que sale hacia el comercio, el cliente o el fisco—. El estado con evidencia vive en [`status.md`](status.md); las fichas comerciales, en [`commerce-plan.md`](commerce-plan.md).

_Escrito el 2026-10-23 con el estado verificado ese día (v0.13.0)._

## 0. Cómo leer este documento

- Cada ciclo se divide en **etapas** (P0–P9 para el producto, M0–M9 para el dinero). Una etapa está **completa** cuando la cadena funciona en producción de punta a punta, con su evento, su registro y su pantalla, y con evidencia del nivel que pide cada paso (L2/L4).
- Cada fila dice **qué falta exactamente**, el paso que lo hace (`F<nn>.<m>`), su estado (✅ hecho · 📝 parcial · 📋 pendiente · ⛔ bloqueado) y su criterio de terminado.
- Los **puntos de contacto** (§3) son los lugares donde los dos ciclos se tocan: una venta mueve a la vez existencias y dinero, y ahí es donde un fallo deja inconsistencias. Son lo primero que se prueba.
- **Cómo ejecutar cada paso** (archivos, contrato, migración, pruebas con nombre, comandos, despliegue, guion L4): [`execution/`](execution/README.md), una ficha por paso, en el orden de las olas de §4.
- Los **pasos nuevos** que este documento propone tienen ficha corta en §5 y fila 📋 en `status.md`. Las **decisiones** que no puede tomar un agente están en `open-questions.md` (Q-56, con respuesta parcial: mensual; Q-55 resuelta).

### Estado por etapa (2026-10-23)

| Ciclo del producto | Estado | Ciclo del dinero | Estado |
|---|---|---|---|
| P0 Alta en el catálogo | 📝 | M0 Entrada a la plataforma | 📝 sandbox |
| P1 Compra al proveedor | 📝 | M1 Custodia en la billetera | ✅ |
| P2 Recepción | 📝 | M2 Pago del cliente | 📝 |
| P3 Almacén y control | 📝 | M3 Reparto y comisión | ✅ |
| P4 Publicación y precio | 📝 | M4 Saldo del comercio | 📝 |
| P5 Venta (caja y mercado) | 📝 | M5 Liquidación del riel | 📝 |
| P6 Factura del hecho | 📋 sin servicio | M6 Pago al comercio | 📝 |
| P7 Entrega o retiro | 📝 solo retiro | M7 Reembolsos y reversos | 📝 |
| P8 Posventa y devoluciones | 📝 | M8 Comisiones e impuestos | 📋 |
| P9 Análisis y reposición | 📝 | M9 Cierre, control y conciliación | 📝 |

## 1. Ciclo de vida del producto

```
 proveedor ──OC──▶ P1 compra ──▶ P2 recepción ──▶ P3 almacén ──▶ P4 publicación
                                  (lote, dañado)   (bloqueado,      (vitrina, precio,
                                                    vencimiento)     en existencia)
                                                         │
   P9 análisis ◀── P8 posventa ◀── P7 entrega ◀── P6 factura ◀── P5 venta (caja / mercado)
   (reorden)        (devolución)    (retiro, envío)                  (reserva → descuento)
```

### P0 · Alta del producto en el catálogo (catalog)
El producto existe, con datos fiscales y de inventario correctos, antes de comprarlo.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Variantes (talla, color) y precio por sucursal en `catalog.Product` | F15.1 | 📝 | Una variante es una unidad de inventario propia; la caja y el mercado venden la variante; precio de sucursal manda sobre el general |
| Importación masiva con clave de lote (CSV) | F15.3 | 📋 | 1 000 productos en una carga idempotente con reporte de filas rechazadas |
| Ficha por categoría (atributos obligatorios según vertical) | F15.11 | 📋 | Un medicamento exige registro sanitario; un alimento, vencimiento; sin ellos no se publica |
| Historial de cambios del producto (precio, impuesto) | F15.12 | 📋 | Cada cambio queda con quién y cuándo; la venta usa el precio vigente al venderse |
| **inventory se entera del producto nuevo** (hueco 2 de `event-chains.md`): el «mínimo» del formulario llega a inventory | **F16.14** (nuevo) | 📋 | `catalog.product.changed` → inventory registra el producto rastreable y su punto de reorden, idempotente |

### P1 · Compra al proveedor (inventory · compras)
El comercio decide qué comprar, a quién y a qué costo.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Proveedores, órdenes de compra, sugerencias de reorden | F16.5, F16.6 | ✅ | — |
| ITBMS por línea en la orden y total con impuesto | F16.5 (pendiente de S-INV-05) | 📋 | La orden muestra subtotal, ITBMS por tasa y total, con la tasa vigente leída de `legal.pa.*` |
| Enviar la orden al proveedor por correo con PDF | F20.2 + S-INV-05 | 📋 | El proveedor recibe el PDF; el envío queda registrado; sin notifications la acción no aparece |
| Historial de compras y **costo de adquisición** por producto | F16.13 | 📋 (costo de lo vendido ⛔ Q-52) | Último costo y costo promedio de compra visibles por producto; el costo de lo vendido espera Q-52 |
| **Cuentas por pagar a proveedores**, opcional por comercio (Q-55 resuelta: configurable) | **F16.17** (nuevo) | 📋 | Con el módulo activo, cada recepción deja la deuda con el proveedor; el comercio registra sus pagos y ve lo pendiente por proveedor y vencimiento. Con el módulo apagado, nada cambia |

### P2 · Recepción (inventory · compras)
La mercancía llega y entra al inventario con su lote, su estado y su documento.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Recepción parcial/total, lotes y vencimiento por línea | F16.5, F16.8 | ✅ | — |
| Dañado entra bloqueado; «Cerrar con faltante» | F16.12 | ✅ | — |
| Escáner (cámara y lector) en la recepción | F16.11 | 📝 | Falta la lectura con cámara de un código impreso en el Pixel y un lector físico |
| **Devolución al proveedor** de lo dañado o sobrante | **F16.15** (nuevo) | 📋 | Movimiento de salida con referencia a la orden y nota del proveedor; lo bloqueado sale de lo bloqueado; R1 se mantiene |

### P3 · Almacén y control (inventory)
Lo que hay físicamente coincide con lo que dice el sistema.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Bodegas, movimientos inmutables, transferencias, FEFO, bloqueado, aviso de vencimiento | F16.1–F16.4, F16.10 | ✅ | — |
| Sucursal en bodegas y alcance por sucursal (ADR 0018) | F16.9 | 📋 | Un cajero con alcance de sucursal solo ve y mueve existencias de sus bodegas (`BRANCH_OUT_OF_SCOPE`) |
| **Verificación diaria de R1** (`on_hand` = Σ movimientos; bloqueado = Σ BLOCK/UNBLOCK; Σ lotes = existencia) | **F16.16** (nuevo) | 📋 | Job diario con métrica `pp_inventory_invariant_violations_total` (debe ser 0) y alerta |
| Aviso activo de lotes por vencer y de existencia baja (correo, bandeja) | F20.5 | 📋 | `inventory.stock.low` y el aviso de vencimiento llegan a la bandeja del comercio una vez por día y producto |
| Pantallas de inventario completas en el teléfono (L4 de compras) | F16.7 | 📝 | L4 de órdenes y recepción en el Pixel (hecho en F16.11/F16.12; falta registrar el cierre del paso) |

### P4 · Publicación y precio (catalog, orders)
El cliente ve el producto, con su precio y si hay existencia.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Vitrina, publicación por producto, `in_stock` proyectado desde inventory | F15.4, consumidor `catalog-stock` | ✅ código · L2 | — |
| Búsqueda del mercado con atributos | F15.5 | 📝 | Filtro por categoría, precio y atributo; resultados solo de tiendas visibles y con existencia |
| Disponible publicado **sin lo bloqueado ni lo reservado** | F16.10 | ✅ | — |

### P5 · Venta (pos, orders, inventory)
La unidad se compromete y luego sale del inventario, una sola vez.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Caja: abrir/cerrar, vender, estacionar, cobrar en efectivo y saldo PlentyPay | F17.3–F17.5 | ✅/📝 | F17.5: L4 de cobro mixto en producción; F17.3: reporte Z por medio y por tasa de ITBMS y conteo por denominación |
| Configuración de caja (S-POS-11 hoy con datos fijos) | F17.11 | 📋 | `GetPosSettings`/`UpdatePosSettings` reales; la pantalla no muestra datos inventados |
| Sucursal en cajas y ventas | F17.12 | 📋 | Cada venta lleva su sucursal; reportes por sucursal |
| Cambio de turno y sesiones abandonadas | F17.13 | 📋 | Supuesto de Q-51: cierre con arqueo y nueva apertura |
| Venta sin conexión (cola local idempotente) | F17.7 | 📋 | Ventas offline se sincronizan una vez, con su `client_sale_id`, sin duplicar existencias ni dinero |
| Pantalla del cliente | F17.8 | 📋 | El cliente ve líneas, total y QR de pago en una segunda pantalla |
| Mercado: carrito, cotización, cobro dividido por comercio, reserva → confirmación | F15.7, F15.8 | ✅/📝 | F15.8: L4 de compra multi-comercio en el Pixel |
| Aceptación con plazo, rechazo con reembolso de ese comercio | F15.9 | 📝 | L4 en producción del rechazo y del vencimiento del plazo |
| Aviso de pedido entrante en tiempo real al comercio (ola 2: necesita notifications) | F15.13 | 📋 | El comercio recibe el pedido en < 5 s (WebSocket + push) |

### P6 · Factura del hecho (fiscal-invoicing)
Cada venta queda respaldada por su documento fiscal electrónico.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Perfil fiscal del comercio y credenciales del PAC en security | F13.3 | 📝 | El comercio registra RUC/DV y su certificado sin que PlentyPay vea la llave en claro |
| Emitir la factura desde la venta (consumir `pos.sale.paid` y `orders.order.paid`, hueco 3) | F13.5 | 📝 | Una venta pagada genera una factura una sola vez (clave `invoice:<sale>`); el rechazo del PAC reintenta y avisa |
| PDF/XML con QR en object-storage | F13.6 | 📝 | El cliente descarga su factura desde el recibo y desde «Mis pedidos» |
| Pantallas fiscales | F13.9 | 📝 | Lista de facturas, notas y su estado ante el PAC |
| Reporte mensual de ITBMS del comercio (N-FIS-11) | F13.9 / F21 | 📋 | Débito por tasa, exento y notas cuadra con las facturas aceptadas del período |
| PAC en producción | — | ⛔ Q-11 | Hasta resolverse, el PAC es el simulador y la app lo dice |

### P7 · Entrega o retiro (orders, logistics, geolocation)
La unidad llega a manos del cliente, con prueba.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Retiro en tienda con código de 6 dígitos | F15.9 | ✅ L2 | — |
| logistics con servidor: transportistas, entregas, estados, asignación | F18.1–F18.3 | 📝 (solo dominio) | Servicio desplegado con L2; una entrega nace del sub-pedido aceptado |
| Prueba de entrega (código, foto, firma, mayoría de edad) | F18.4, F18.8 | 📝/📋 | La entrega solo se cierra con prueba válida; la foto va a object-storage |
| Seguimiento público y en vivo | F18.5, F18.6, F14.* | 📝 | Página `/track/<token>` sin datos personales; posiciones con consentimiento (Q-49) |

### P8 · Posventa y devoluciones (pos, orders, inventory, fiscal)
La unidad vuelve: al inventario, al proveedor o a la basura, y el documento lo refleja.

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Devolución en caja (efectivo y saldo PlentyPay) con reingreso o no | F17.9 | 📝 | Falta el reintegro al saldo en vivo (L4) y Q-47 (efectivo por venta electrónica) |
| **Devolución al lote original** (hoy un RETURN reingresa sin lote) | **F17.20** (nuevo) | 📋 | El reingreso vuelve al lote vendido (pos guarda los lotes de cada línea al descontar) |
| Nota de crédito electrónica de la devolución | F13.5/F13.7 | 📝 | Cada devolución con factura genera su nota de crédito una sola vez |
| Correcciones posteriores a la venta | F17.14 | 📋 | Corregir el medio o el cliente de una venta sin borrarla (registro nuevo) |
| Reclamos del comprador del mercado | S-MKT-08 (sin paso) | 📋 | Se reabre cuando exista el servicio de reclamos; hoy no se muestra |

### P9 · Análisis y reposición (analytics-bi, inventory)
Lo vendido alimenta la siguiente compra (vuelve a P1).

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Velocidad de venta, clase ABC y sugerencia de reorden | F16.6 | ✅ | — |
| analytics-bi con servidor: ingesta de eventos, agregados, tableros | F21.1–F21.4, F21.10 | 📝 (solo dominio) | Inicio del comercio con ventas del día, margen (cuando Q-52) y productos top desde eventos reales |
| Alertas y anomalías | F21.6 | 📝 | Caída de ventas o faltante de caja disparan una alerta una vez |

## 2. Ciclo de vida del dinero

```
 cliente ──recarga T1 / cobro T2──▶ M0 entrada ──▶ M1 billetera (WALLET, holds)
                                                        │ pago T3 / P2P T4
                                                        ▼
 M9 control ◀── M6 pago al comercio T6/T6b ◀── M4 MERCHANT_PAYABLE ◀── M3 reparto (comisión, ITBMS)
   (I7, conciliación)      ▲                                                   │
                           └── M5 liquidación del riel T5 (RAIL_RECEIVABLE → BANK_CASH)
                M7 reembolso T7 (vuelve al pagador) · M8 comisiones e impuestos (factura, TAX_PAYABLE)
```

Fuera del libro contable quedan, por diseño, el **efectivo de caja** (se controla con la sesión de caja y el reporte Z) y los **memo-libros** del comercio: puntos (T8), crédito de la casa (T9) y nómina (T10).

### M0 · Entrada del dinero a la plataforma (payments-core)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Recarga (T1) y cobro por riel externo (T2) con protocolo UNKNOWN | F11.4, F11.7 | ✅ sandbox | — |
| Webhooks de los rieles con firma obligatoria (nunca *fail-open*) | F11.8 | 📋 | Un webhook sin firma o con firma inválida se rechaza y se registra; el secreto vive en security |
| Rieles reales: Yappy, ACH/Clave | — | ⛔ Q-02 | Hasta resolverse, `sandbox:true` y la app lo muestra (AGENTS §2.12) |
| Tarjetas, Apple Pay, Google Pay vía PSP | F23.6 | ⛔ Q-03 | PlentyPay nunca ve datos de tarjeta (N-STD-28) |
| Dominio público para enlaces de cobro `/t/<código>` | F23.5 | ⛔ Q-53 | Un QR escaneado con la cámara abre la app o la web |

### M1 · Custodia en la billetera (ledger)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Cuentas, holds, saldos, extractos, invariantes en código y en la base | F10.1–F10.5 | ✅ | — |
| Outbox y eventos del ledger | F10.6 | 📝 | `ledger.transaction.posted` y `hold.status_changed` publicados una vez y consumidos por settlement |
| Límites de billetera por nivel de verificación (`legal.pa.*`) | F11 + identity | 📝 | Un pago o recarga que pasa el límite vigente en la fecha del hecho se rechaza con su `reason` |

### M2 · Pago del cliente (payments-core, pos, orders)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Pago con saldo (T3) y transferencias entre personas (T4) | F11.3, F11.10 | ✅ producción | — |
| Cobro mixto en caja (efectivo + saldo) | F17.5 | 📝 | L4 en producción |
| Pago presencial QR/NFC y pantalla «confirmando» | F23.1–F23.4 | 📝 | Un pago UNKNOWN se resuelve sin cobrar dos veces y la app lo muestra hasta el estado final |
| Crédito de la casa (T9) | F17.6 | 📋 | Venta a crédito y abono como memo en el ledger, con límite por cliente |
| Lealtad: reglas, acumulación y canje (T8) | F17.15–F17.17 | 📋 (activación ⛔ Q-45) | Mecanismo listo; no se activa hasta Q-45 |
| Cupones y tarjetas de regalo · propinas | F17.18 · F17.19 | ⛔ Q-48 · Q-21 | — |

### M3 · Reparto y comisión (payments-core)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Motor de comisiones con vectores, repartos por comercio, ITBMS de la comisión | F11.1, F11.3 | ✅ | — |

### M4 · Saldo del comercio (ledger, settlement)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| `MERCHANT_PAYABLE` por comercio con lista de cobros | F11.3 | ✅ | — |
| Pantallas de finanzas del comercio: saldo por liquidar, próximos pagos, historial | F12.8 | 📝 | El comercio ve cuánto le debe PlentyPay, cuándo se le paga y qué cobros lo forman |

### M5 · Liquidación del riel a PlentyPay (settlement)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Importar extractos del riel (CSV genérico; ISO 20022 cuando se integre el banco) | F12.5 | 📝 | Un extracto se importa una sola vez; cada línea queda pendiente de conciliar |
| Conciliación y asiento T5 con excepciones | F12.6 | 📝 | Lo cobrado (RAIL_RECEIVABLE) cuadra con lo depositado; la diferencia va a una excepción, nunca a SUSPENSE por más de 5 días |

### M6 · Pago al comercio (settlement)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Calendarios, destino cifrado con step-up, lotes de pago | F12.1–F12.3 | ✅ | — |
| Confirmar o fallar el pago (T6 banco / T6b billetera) | F12.4 | 📝 | Un pago fallido devuelve el saldo al comercio; uno confirmado asienta T6 una vez |
| Jobs y alertas de liquidación | F12.7 | 📝 | Lote atascado o diferencia de conciliación disparan alerta |
| Transferencia bancaria real | — | ⛔ Q-02/Q-10 | Hasta resolverse, el pago a comercio es a su billetera (T6b) |

### M7 · Reembolsos y reversos (payments-core, ledger)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Reembolso por split (T7) con step-up; devuelve comisión e ITBMS exactos | F11.6 | 📝 | L4 en producción de un reembolso parcial y uno total |
| Reembolso desde la caja y desde el rechazo de un pedido | F17.9, F15.9 | 📝 | L4 del reintegro al saldo PlentyPay del cliente |
| Reverso de un asiento erróneo (nunca borrar) | F10.3 | ✅ | — |

### M8 · Comisiones e impuestos de la plataforma (fiscal-invoicing, ledger)

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Factura de PlentyPay al comercio por sus comisiones | F13.8 | 📝 | Una factura mensual por comercio que cuadra con PLATFORM_FEES y TAX_PAYABLE del período |
| **Salida del ITBMS cobrado sobre comisiones** (TAX_PAYABLE → pago a la DGI) | — | ⛔ **Q-56** | Falta la plantilla de asiento y la decisión de cómo y cuándo se remesa; hoy TAX_PAYABLE solo crece |

### M9 · Cierre, control y conciliación

| Falta | Paso | Estado | Criterio de terminado |
|---|---|---|---|
| Job de invariante I7 (Σ débitos = Σ créditos por moneda) con métrica y alerta | F10.7 | 📝 | `pp_ledger_invariant_violations_total` = 0 y alerta si cambia |
| Reporte Z de caja y conciliación del efectivo | F17.3 | 📝 | El esperado de caja cuadra con ventas, devoluciones, entradas y salidas, por medio |
| Carga básica del ledger | F10.8 | 📝 | Objetivo de asientos por segundo del paso cumplido sin violar invariantes |
| Validación legal antes de mover dinero real | F28.7, F30.3 | 📋 | Ninguna regla ◐/⚠ habilita dinero real sin validación (AGENTS §8) |

## 3. Puntos de contacto entre los dos ciclos (se prueban primero)

| Momento | Producto | Dinero | Riesgo si falla | Garantía actual |
|---|---|---|---|---|
| Venta de caja pagada | SALE descuenta existencias (lote FEFO) | T3 o efectivo esperado | Cobrado sin descontar, o descontado sin cobrar | Una transacción en pos con tareas de stock y `SalePaid` por outbox; claves `sale:<venta>:<línea>` (L2) |
| Pedido del mercado pagado | Reserva → confirmación por comercio | T3 con un split por comercio | Doble venta de la última unidad | Reserva todo-o-nada con TTL (100 reservas sobre 50 → 50, L2) |
| Rechazo o plazo vencido | RETURN de lo reservado | T7 solo de ese split | Reembolsar sin devolver existencias o al revés | Tareas REFUND y RETURN con claves deterministas (L2) |
| Devolución en caja | RETURN (con o sin reingreso) | Salida de caja o T7 | Devolver más de lo vendido | `EXCEEDS_SOLD_QTY` y bloqueo concurrente (L2, L4) |
| Recepción con dañado | RECEIPT + BLOCK | Costo de compra (F16.13) | Vender lo dañado | BLOCK en la misma transacción (L2, L4) |
| Factura | — | ITBMS del comercio | Venta sin factura o con dos | Pendiente: F13.5 con clave `invoice:<sale>` |

## 4. Orden de trabajo propuesto (respeta la matriz de fases)

Cada ola cierra un tramo de punta a punta en producción. Dentro de cada ola el orden es el de los predecesores de `phase-matrix.md`; las olas 1–4 pueden avanzar en paralelo donde la matriz lo permite (F12, F13 y F14 tras F11; F20 tras F09).

1. **Ola 1 · Lo que ya se vende queda cerrado** (P5, M2, M7, sin dependencias nuevas): F16.11 (cámara), F17.5 L4, F17.3 reporte Z, F17.11, F17.12 + F16.9 (sucursal), F17.13, F15.8 y F15.9 L4, F15.10 y F17.10 (integration_test), F11.6 y F17.9 L4 del reintegro al saldo. → [`execution/ola-1-venta-cerrada.md`](execution/ola-1-venta-cerrada.md)
2. **Ola 2 · El hecho se documenta y se avisa** (P6, P3, M8): desplegar notifications (F20.1–F20.8; cierra el hueco 1), F15.13, F13.3, F13.5 (con la decisión del hueco 3), F13.6, F13.9; F16.14; F16.16. → [`execution/ola-2-documento-y-aviso.md`](execution/ola-2-documento-y-aviso.md)
3. **Ola 3 · El dinero sale hacia el comercio** (M4–M6, M9): F10.6, F10.7, F12.4–F12.8, F10.8. → [`execution/ola-3-dinero-al-comercio.md`](execution/ola-3-dinero-al-comercio.md)
4. **Ola 4 · El producto completa su vuelta** (P1, P2, P8): F16.13 (sin costo de lo vendido hasta Q-52), ITBMS y envío de la orden de compra, F16.17 (cuentas por pagar opcionales), F16.15, F17.20, F17.14, F15.1, F15.2, F15.11, F15.12, F15.3, F15.5. → [`execution/ola-4-vuelta-del-producto.md`](execution/ola-4-vuelta-del-producto.md)
5. **Ola 5 · Entrega a domicilio** (P7): ADR de geolocalización, F14.*, F18.1–F18.8 (requiere F14/F15 cerrados; mapa ⛔ Q-49). → [`execution/ola-5-entrega.md`](execution/ola-5-entrega.md)
6. **Ola 6 · Fidelización y crédito** (M2): F17.6, F17.15–F17.17 (activación ⛔ Q-45), F19.6 (nómina T10). → [`execution/ola-6-fidelizacion-y-credito.md`](execution/ola-6-fidelizacion-y-credito.md)
7. **Ola 7 · Análisis** (P9): F21.1–F21.10. → [`execution/ola-7-analisis.md`](execution/ola-7-analisis.md)
8. **Ola 8 · Dinero real** (M0, M6, M8): Q-02, Q-03, Q-10, Q-11, Q-53, Q-56 resueltas → F11.8, F23.2–F23.6, riel bancario, PAC real, F13.8, remesa del ITBMS; F28 y F30. → [`execution/ola-8-dinero-real.md`](execution/ola-8-dinero-real.md)

## 5. Pasos nuevos propuestos (fichas cortas)

| Paso | Qué | Dónde | Depende de | Criterio | Pruebas |
|---|---|---|---|---|---|
| **F16.14** inventory consume `catalog.product.changed` | Registrar el producto rastreable, su bandera de lotes y su punto de reorden al crearlo o editarlo (hueco 2) | inventory (consumidor durable con `processed_events`), catalog (el evento lleva el mínimo) | F15.1, F16.6 | Crear un producto con mínimo 5 deja su punto de reorden en inventory en ≤ 30 s, una vez aunque el evento llegue dos veces | L2 con NATS efímero; consumidor idempotente |
| **F16.15** Devolución al proveedor | Movimiento `RETURN_TO_SUPPLIER` (enum aditivo) que saca existencia —de lo bloqueado si viene de un dañado— con referencia a la orden y nota del proveedor | inventory (contrato, dominio, store), S-INV-05 acción «Devolver al proveedor» | F16.12 | Lo devuelto sale de la existencia y del lote; R1 y bloqueado = Σ siguen cuadrando; nunca más de lo recibido de esa orden | L1 de signo y tope; L2 de tope concurrente y lote |
| **F16.16** Verificación diaria de invariantes de inventario | Job que recalcula `on_hand`, bloqueado y Σ lotes contra los movimientos por (bodega, producto) | inventory (job + métrica `pp_inventory_invariant_violations_total` + alerta) | F16.10 | En una base sana la métrica es 0; una diferencia sembrada en la prueba se detecta y se registra con bodega y producto | L2 con base efímera |
| **F16.17** Cuentas por pagar a proveedores (opcional por comercio, Q-55) | Con el módulo activo, cada recepción crea la deuda con el proveedor (costo × recibido, menos devoluciones); pagos registrados contra ella; saldo por proveedor y vencimiento por días de crédito | inventory (compras) | F16.13 (líneas de recepción con costo) | Con el módulo apagado nada cambia; con el módulo activo, saldo del proveedor = Σ recepciones − Σ devoluciones − Σ pagos, sin pagar dos veces la misma deuda | L1 del saldo; L2 de concurrencia de pagos |
| **F17.20** Devolución al lote original | pos guarda el lote de cada línea al descontar (de la respuesta de inventory) y el RETURN reingresa a ese lote | pos (campo aditivo por línea), inventory (RETURN con lote) | F16.4, F17.9 | Vender 3 de un lote y devolver 1 deja ese lote con +1; un producto sin lotes no cambia | L2 en pos e inventory |

## 6. Decisiones abiertas que este documento agrega

- **Q-55** · Pagos a proveedores — **resuelta el 2026-10-23: configurable por comercio** (módulo opcional, apagado por defecto). Se ejecuta como F16.17.
- **Q-56** · ITBMS cobrado por PlentyPay sobre sus comisiones: plantilla de asiento para remesarlo (TAX_PAYABLE → BANK_CASH), periodicidad y responsable. Afecta M8. **Respuesta parcial (2026-10-23)**: mensual según el dueño (coherente con N-FIS-11 ◐); falta plantilla, responsable y confirmación del contador.
