# Caja (punto de venta)

Módulo `pos`. Paso F17.10 salvo indicación. Convenciones: [`README.md`](README.md). Estados de venta: [`../../domain/domain-model.md`](../../domain/domain-model.md) §8.9. En ≥ 1024 dp la venta usa dos paneles: catálogo a la izquierda, ticket a la derecha. El tema puede fijarse en oscuro.

### S-POS-01 · `/pos` · Abrir caja
`pos:session:manage` · `POST /v1/pos/sessions`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Sucursal · Caja | Cajas con sesión abierta por otra persona aparecen "En uso por {nombre}" y no se eligen |
| e2 | `MoneyInput` | Fondo inicial en efectivo | ≥ $0.00 |
| e3 | Conteo opcional | Billetes y monedas | Tabla por denominación (1¢, 5¢, 10¢, 25¢, 50¢, B/.1, $1, $5, $10, $20, $50, $100) que suma en e2 |
| e4 | `PPButton.primary` | Abrir caja | `SESSION_ALREADY_OPEN`: "Esta caja ya tiene una sesión abierta." con "Continuar esa sesión" |

Si el usuario ya tiene sesión abierta, entra directo a S-POS-02.

### S-POS-02 · `/pos/sell` · Venta
`pos:sell` · Pasos F17.10, F24.3 · Reglas: N-FIS-01 a N-FIS-03, N-CON-04 a N-CON-07, N-LOG-01, N-LOG-07

Panel de catálogo:

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Buscador | Buscar o escanear | Acepta lector de códigos (teclado HID) y cámara. Código exacto agrega 1 unidad sin tocar nada |
| e2 | Chips | Favoritos · categorías | — |
| e3 | Cuadrícula | Nombre, precio, existencias | Toca: agrega 1. Producto a granel: abre teclado de cantidad en la unidad SI (con conversión desde lb si el comercio la activó). Lote vencido: no se agrega, "Lote vencido." |

Panel de ticket:

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e4 | Cliente | Consumidor final / {nombre} | Toca: buscar o crear cliente (nombre, documento, RUC + DV opcional, teléfono, correo) |
| e5 | Líneas | Nombre · cantidad ± · precio unitario · total de línea | Deslizar para quitar. Toca: editar cantidad, nota, descuento de línea |
| e6 | `PPButton.text` | Descuento | Ver "Descuentos" abajo |
| e7 | `PPButton.text` | Descuento de ley | Ver "Descuento legal" abajo |
| e8 | Totales | Subtotal · Descuentos · Envío (si aplica) · ITBMS 7 % {x} · ITBMS 10 % {y} · ITBMS 15 % {z} · Exento {w} · **Total** | Una fila por tasa presente. Total en `displayMoney` |
| e9 | `PPButton.primary` | Cobrar {total} | Deshabilitado con ticket vacío → S-POS-03 |
| e10 | Acciones secundarias | Entrega a domicilio · Estacionar · Nota · Vaciar | "Vaciar" con C-05. Ver "Entrega a domicilio" abajo |
| e11 | Indicador | En línea / Sin conexión ({n} ventas por sincronizar) | Sin conexión solo se cobra en efectivo o crédito de la casa |

**Entrega a domicilio (en e10).** Hoja opcional para ventas con despacho desde la sucursal: pide dirección y punto en el mapa, nombre de quien recibe y teléfono (precargados si se seleccionó cliente en e4). Cotiza tarifa y cobertura con `POST /v1/logistics/quote`; si está fuera de cobertura devuelve `OUT_OF_DELIVERY_ZONE` "Esta sucursal no entrega en esa zona." Al pagarse la venta en S-POS-03, `pos` crea automáticamente la entrega en `logistics` (`CreateDelivery`) y el recibo incluye el enlace de seguimiento.

**Descuentos (e6).** Porcentaje o monto, sobre línea o ticket, con motivo. Sin `pos:discount:apply`, o por encima del tope configurado, pide PIN de supervisor. `DISCOUNT_EXCEEDS_LIMIT`: "El descuento supera el máximo permitido ({n} %)."

**Descuento legal (e7).** Hoja con:
1. Tipo: "Jubilado, pensionado o tercera edad" / "Persona con discapacidad".
2. Documento: tipo y número (obligatorio); para discapacidad, número de carné de SENADIS.
3. Líneas a las que aplica: preseleccionadas las de categorías con descuento legal; el cajero desmarca lo que no sea consumo personal del beneficiario.
4. Vista previa por línea: "{categoría}: {n} %".

Reglas: no pide PIN ni permiso de descuento; no cuenta para el tope del cajero; si la línea ya tiene promoción, se aplica el mayor de los dos y se indica cuál; queda registrado con el documento (enmascarado en el recibo). Sin documento: `LEGAL_DISCOUNT_ID_REQUIRED` "Registra el documento del beneficiario."

Precio desactualizado sin conexión (más de 24 h desde la última sincronización): `PRICE_STALE` "Actualiza los precios antes de vender este producto."

### S-POS-03 · `/pos/sell/pay` · Cobro
`pos:sell` · `POST /v1/pos/sales/{id}/checkout` · Reglas: N-CON-11, N-PAG-01

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `MoneyText` `displayMoney` | Total {monto} · Falta {monto} | "Falta" baja con cada pago agregado |
| e2 | Botones de medio | Efectivo · QR / NFC · Saldo PlentyPay · Tarjeta · Crédito de la casa · Puntos | Solo los activos. Sin conexión: solo Efectivo y Crédito |
| e3 | Efectivo | Recibido {monto} · Vuelto {monto} | Atajos: monto exacto y siguientes billetes. El vuelto se muestra en `displayMoney` |
| e4 | QR / NFC | QR en pantalla y en el display del cliente · "Esperando al cliente…" | Vence en 15 min. `StatusChip` Confirmando si el riel no responde |
| e5 | Tarjeta | Componente del PSP | Nunca se teclea la tarjeta en PlentyPay |
| e6 | Crédito de la casa | Cliente obligatorio · Disponible {monto} | `CREDIT_LIMIT_EXCEEDED`: "El cliente supera su límite de crédito." |
| e7 | Puntos | Disponibles {n} = {monto} | `INSUFFICIENT_POINTS` |
| e8 | Propina | Agregar propina: 10 % · 15 % · Otro · Sin propina | Solo si el comercio la activó. Nunca preseleccionada. Línea aparte, sin ITBMS |
| e9 | Lista de pagos | {medio} {monto} · `StatusChip` | Un pago no capturado se puede quitar |
| e10 | `PPButton.primary` | Finalizar venta | Habilitado cuando Falta = $0.00 y ningún pago está en "Confirmando" |

`TENDERS_MISMATCH`: "Los pagos no suman el total." Un pago en "Confirmando" bloquea finalizar y ofrece "Dejar la venta en espera": la venta queda en "Por confirmar" y se cierra sola cuando llegue el resultado.

### S-POS-04 · elección de documento
Diálogo tras finalizar, solo con preferencia fiscal `ASK_ALWAYS`: "¿Qué documento entregas?" con "Factura electrónica" y "Recibo interno". Con `AUTO_THRESHOLD`, factura si el total supera el umbral o el cliente dio RUC. Factura a contribuyente sin RUC + DV válidos: `FISCAL_RECEIVER_REQUIRED` "Completa el RUC y el DV del cliente."

### S-POS-05 · `/pos/receipt/:id` · Recibo
`pos:sell` · Pasos F17.10, F24.1 · Reglas: N-FIS-04, N-FIS-05, N-FIS-09

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | `ReceiptView` | Ver contenido abajo | 80 mm |
| e2 | `StatusChip` fiscal | Factura autorizada / Factura pendiente de autorización / Recibo interno | — |
| e3 | `PPButton.primary` | Nueva venta | → S-POS-02 |
| e4 | Acciones | Imprimir · Enviar por correo · Enviar por WhatsApp · Abrir cajón · Ver entrega (si aplica) | Según equipos y canales configurados; "Ver entrega" abre S-LOG-02 |

Contenido del recibo, en orden: nombre comercial, razón social, RUC y DV, dirección de la sucursal; tipo y número de documento; fecha y hora; caja y cajero; cliente y su RUC si aplica; líneas (cantidad con unidad, descripción, precio unitario, total); descuentos con su tipo ("Descuento Ley 6: 25 %"); subtotal; envío a domicilio (si aplica, con enlace `/track/{token}`); ITBMS por tasa; exento; **total**; pagos por medio y vuelto; propina; CUFE y QR de la DGI (solo factura autorizada); puntos ganados; política de devolución. Un recibo interno lleva al pie "Este documento no es una factura fiscal." Una factura pendiente lleva "Comprobante en proceso de autorización."

### S-POS-06 · `/pos/parked` · Ventas estacionadas
Lista: nota o cliente, hora, total, cajero. Acciones: "Retomar" (→ S-POS-02) y "Anular" (`pos:void`, motivo obligatorio). Las ventas estacionadas se cierran o anulan antes del cierre de caja.

### S-POS-07 · `/pos/sales` · Ventas del turno e historial
Filtros: Hoy / Rango · Caja · Cajero · Medio de pago · Estado. Lista: número, hora, total, medios, `StatusChip` (Pagada, Por confirmar, Devuelta parcial, Devuelta, Anulada). Toca: detalle con el recibo y acciones "Reimprimir", "Devolver" (→ S-POS-08) y "Emitir factura" (si fue recibo interno y el período lo permite).

### S-POS-08 · `/pos/sales/:id/refund` · Devolución
`pos:refund` · 🔒 · Reglas: N-FIS-08, N-CON-03

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Líneas | Casilla · producto · vendido {n} · ya devuelto {m} · a devolver ± | `EXCEEDS_SOLD_QTY`: "No puedes devolver más de lo vendido." |
| e2 | Selector | Motivo | Defectuoso, Cambio, Error de cobro, Garantía, Otro |
| e3 | Interruptor por línea | Regresa al inventario | Desactivado por defecto si el motivo es Defectuoso |
| e4 | Reintegro | Por el mismo medio: {medio} {monto} | Efectivo se devuelve en efectivo; electrónico por su riel; mixto en proporción |
| e5 | Resumen | Devolución {monto} · ITBMS {monto} · Nota de crédito sobre factura {número} | Si la venta tuvo factura |
| e6 | `PPButton.primary` | Devolver {monto} | S-GEN-21 |

### S-POS-09 · `/pos/cash` · Movimientos de caja
`pos:session:manage`. Lista del turno (entradas, salidas, ventas en efectivo, vueltos) con saldo esperado. Botones "Entrada" y "Salida": monto, motivo (Cambio, Pago a proveedor, Retiro a caja fuerte, Otro + texto) y, para salidas mayores al tope configurado, PIN de supervisor.

### S-POS-10 · `/pos/close` · Cierre y arqueo
`pos:session:manage` · `POST /v1/pos/sessions/{id}/close`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Conteo | Efectivo contado | Por denominación, como S-POS-01 e3. El esperado **no** se muestra hasta confirmar el conteo |
| e2 | Resultado | Esperado {x} · Contado {y} · Diferencia {z} | Diferencia ≠ 0 en `error` o `warning` con signo; exige nota |
| e3 | Resumen (reporte Z) | Ventas por medio · Devoluciones · Descuentos · Descuentos de ley · ITBMS por tasa · Exento · Propinas · Número de documentos fiscales y rango de numeración · Entradas y salidas | Solo lectura |
| e4 | `PPButton.primary` | Cerrar caja | `SALES_PENDING`: "Tienes ventas estacionadas o por confirmar." con enlace |
| e5 | Acciones tras cerrar | Imprimir reporte Z · Enviar por correo | — |

### S-POS-11 · `/pos/settings` · Configuración de caja
`pos:settings:manage`

| Sección | Opciones |
|---|---|
| Precios | Los precios incluyen ITBMS (activo por defecto) |
| Descuentos | Máximo sin supervisor (%) · PIN de supervisor · Descuentos de ley: activos (no desactivable si el comercio vende categorías alcanzadas) con la tabla de porcentajes de solo lectura |
| Medios de pago | Activar o desactivar cada uno · Propina: desactivada / sugerir |
| Unidades | Mostrar equivalencia en libras y galones |
| Etiquetas de balanza | Estructura del código de 13 dígitos: prefijo (`20`–`29`) · dígitos del artículo · el valor es peso o precio · número de decimales. Botón "Probar con una etiqueta" que muestra artículo y cantidad leídos (N-STD-25) |
| Documentos | Preferencia: Siempre factura / Solo recibo interno / Preguntar / Automático desde {monto} |
| Sin conexión | Permitir ventas sin conexión · Máximo {200} ventas o {24} horas |
| Equipos | Impresora (sistema o red: IP y puerto) · Cajón · Lector · Pantalla del cliente (emparejar) |
| Pedidos | Sonido y aviso de pedido nuevo |
| Lealtad | Puntos por cada $1 · valor de cada punto |

Con "Solo recibo interno" aparece el aviso fijo: "Un recibo interno no sustituye la factura. Consulta tus obligaciones con la DGI."

### S-POS-12 · `/display/:pairing` · Pantalla del cliente
Dispositivo emparejado · Pasos F17.10, F24.4 · WebSocket `customer_display`. Pantalla completa, tema oscuro forzado, sin navegación. Estados: reposo (logo del comercio); venta (líneas, descuentos y total gigante); cobro (QR de pago, "Escanea para pagar {total}"); resultado ("¡Gracias!" o "Confirmando tu pago…"). Nunca muestra datos del cliente ni del cajero.
