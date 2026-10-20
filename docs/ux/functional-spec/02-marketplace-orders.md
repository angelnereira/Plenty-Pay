# Comprar y pedidos del comercio

Módulos `marketplace` y `orders`. Paso F15.10 salvo indicación. Convenciones: [`README.md`](README.md). Estados de pedido: [`../../domain/domain-model.md`](../../domain/domain-model.md) §8.10.

## Comprar (cliente)

### S-MKT-01 · `/market` · Descubrir
`orders:create:self` · `GET /v1/marketplace/search`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Buscador | Busca productos o tiendas | Busca al enviar o tras 400 ms sin escribir, con ≥ 2 caracteres |
| e2 | Chips | Categorías | Desplazamiento horizontal |
| e3 | Interruptor | Cerca de mí | Pide permiso de ubicación con la explicación "Usamos tu ubicación solo para mostrarte tiendas cercanas." Si se niega, pide corregimiento |
| e4 | Filtros | Precio · Entrega o retiro · Con oferta | Hoja inferior |
| e5 | Cuadrícula de productos | Foto, nombre, precio total, tienda, etiqueta "Agotado" u "Oferta" | 2 columnas en móvil. Toca → S-MKT-02 |
| e6 | Icono de carrito con contador | — | → S-MKT-04 |

El precio de cada tarjeta es el total con impuestos (N-CON-01). Vacío: "No encontramos resultados para “{texto}”."

### S-MKT-02 · `/market/p/:id` · Producto
`orders:create:self` · `GET /v1/marketplace/products/:id` · Reglas: N-CON-01 a N-CON-03, N-CON-07, N-LOG-01, N-LOG-04

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Galería | — | Deslizable; texto alternativo por imagen |
| e2 | Título y precio | {nombre} · {precio total} · "ITBMS incluido" | En oferta: precio anterior tachado con "Precio más bajo de los últimos 90 días" |
| e3 | Unidad | por {unidad SI} | Para productos a granel: "$4.40 por kg (≈ $2.00 por lb)" (N-LOG-02) |
| e4 | Selector de variante | Talla · Color · … | Variante agotada deshabilitada |
| e5 | Selector de cantidad | — | 1 a existencias disponibles; a granel en pasos de la unidad |
| e6 | Bloque vendedor | Vendido por {nombre comercial} · RUC {ruc} · Ver tienda | → S-MKT-03 |
| e7 | Bloque entrega | Entrega a domicilio desde {monto} · Retiro en tienda gratis | Según lo que ofrezca la tienda |
| e8 | Bloque garantía | Garantía: {n} días | "Sin garantía aplicable" solo en categorías que lo permiten |
| e9 | Bloque devoluciones | Devoluciones: {política de la tienda} | Nunca "No se aceptan devoluciones" para defectos (N-CON-09) |
| e10 | Descripción | — | Texto plano |
| e11 | Aviso | Venta solo a mayores de 18 años. Se pedirá documento al entregar. | Solo productos restringidos |
| e12 | `PPButton.primary` | Agregar al carrito | Agotado: deshabilitado "Agotado" |

### S-MKT-03 · `/market/s/:slug` · Tienda
`GET /v1/marketplace/storefronts/:tenant_id`. Cabecera (logo, nombre, RUC, corregimiento, horario, "Abierto"/"Cerrado"), políticas de entrega y devolución, y la cuadrícula de S-MKT-01 e5 filtrada a la tienda. Buscador dentro de la tienda.

### S-MKT-04 · `/market/cart` · Carrito
`orders:create:self` · `/v1/cart`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Grupos por tienda | {tienda} | Cada grupo es un sub-pedido futuro |
| e2 | Línea | Foto, nombre, variante, cantidad ±, precio | Cantidad 0 elimina con opción "Deshacer" 4 s |
| e3 | Aviso por línea | El precio cambió: antes {x}, ahora {y} / Solo quedan {n} | Se recalcula al abrir |
| e4 | Subtotal por tienda | Subtotal {monto} | — |
| e5 | Total | Total de productos {monto} | El envío se calcula en el siguiente paso |
| e6 | `PPButton.primary` | Continuar | Deshabilitado si hay líneas agotadas |

Vacío: "Tu carrito está vacío." con "Explorar tiendas". Límite `CART_LIMIT`: "Tu carrito llegó al máximo de productos."

### S-MKT-05 · `/market/checkout` · Pagar el pedido
`orders:create:self` · `POST /v1/orders/quote`, `POST /v1/orders` y `POST /v1/payments/intents/:id/confirm` · 🔒 desde el umbral · Reglas: N-CON-01, N-PAG-06

Una sola pantalla con secciones plegables, en este orden.

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Por tienda: selector | Entrega a domicilio / Retiro en tienda | — |
| e2 | Dirección | Provincia · Distrito · Corregimiento · Dirección o referencia · Punto en el mapa · Quién recibe · Teléfono | Guardable. Fuera de cobertura de la tienda: "Esta tienda no entrega en esa zona." |
| e3 | Datos fiscales | Consumidor final / Con mi RUC | RUC + DV + nombre (N-FIS-07) |
| e4 | Método de pago | Saldo PlentyPay · otros rieles | Como S-WAL-06 e3 |
| e5 | Resumen por tienda | Productos {x} · Envío {y} · Total {z} | — |
| e6 | Resumen general | Productos · Envíos · Comisión de servicio (si aplica) · ITBMS incluido {monto} · **Total a pagar** | `displayMoney` en el total |
| e7 | Texto `caption` | Cada tienda tiene 15 minutos para aceptar tu pedido. Si una no lo acepta, te devolvemos su parte. | — |
| e8 | `PPButton.primary` | Pagar {total} | — |

Flujo: 1) cotiza al abrir y al cambiar e1, e2 o e4; 2) al pagar, si el total recotizado difiere → `PRICE_CHANGED`: diálogo "El total cambió de {x} a {y}." con "Aceptar nuevo total" y "Revisar carrito", sin cobrar; 3) existencias insuficientes → vuelve a S-MKT-04 con la línea marcada; 4) pago → S-WAL-07 → S-MKT-07.

### S-MKT-06 · `/market/orders` · Mis pedidos
`orders:read:self` · `GET /v1/orders`. Lista: número de pedido, fecha, tiendas, total, `StatusChip` (Por pagar, Pagado, En camino, Completado, Cancelado, Reembolsado). Filtro "En curso / Anteriores". Vacío: "Aún no has hecho pedidos."

### S-MKT-07 · `/market/orders/:id` · Detalle del pedido
`orders:read:self` · `/v1/orders/:id`, WebSocket `delivery` · Pasos F15.10, F18.7 · Reglas: N-CON-03, N-CON-08

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | Pedido {número} · {fecha} · Total {monto} | — |
| e2 | Tarjeta por tienda | {tienda} · `StatusChip` del sub-pedido | Estados: Esperando a la tienda (con cuenta regresiva), Aceptado, Listo, En camino, Entregado, Rechazado, Cancelado |
| e3 | Línea de tiempo | Hitos con hora | — |
| e4 | Mapa | Repartidor en vivo y hora estimada | Solo en "En camino" |
| e5 | Código de entrega | Muestra este código al recibir: {6 dígitos} | En "En camino" y en retiro en tienda |
| e6 | Productos | Líneas con cantidad y precio | — |
| e7 | Factura | Ver factura {número} | Si existe (como S-WAL-08 e5) |
| e8 | `PPButton.secondary` | Cancelar | Solo antes de "Aceptado". C-05 "Cancelar pedido de {tienda}" |
| e9 | `PPButton.secondary` | Devolver productos | Tras "Entregado", dentro del plazo de la política. Formulario: líneas, cantidad, motivo (Defectuoso, No es lo que pedí, Ya no lo quiero), fotos |
| e10 | `PPButton.text` | Tengo un problema | → S-MKT-08 con el pedido precargado |

Rechazo de una tienda: tarjeta "{tienda} no pudo aceptar tu pedido. Te devolvimos {monto}."

### S-MKT-08 · `/help/complaints` · Ayuda y reclamos
Todos · `/v1/complaints` · Paso F15.10 · Regla: N-CON-10

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Lista | Caso {número} · {asunto} · `StatusChip` (Abierto, En revisión, Resuelto) · "Respuesta antes del {fecha}" | — |
| e2 | `PPButton.primary` | Nuevo reclamo | Abre el formulario |
| e3 | Formulario: selector | ¿Sobre qué? Un pedido / Un pago / Una compra en tienda / Mi cuenta | Luego selector del recurso concreto |
| e4 | Selector | Motivo | Lista por tipo: No recibí el producto, Producto defectuoso, Cobro incorrecto, Garantía, Otro |
| e5 | Campo de texto | Cuéntanos qué pasó | 20–2 000 caracteres |
| e6 | Adjuntos | Fotos o documentos | Hasta 5, ≤ 10 MB cada uno |
| e7 | `PPButton.primary` | Enviar reclamo | Devuelve número de caso y fecha de respuesta |

Detalle del caso: conversación con el comercio y con soporte, resolución y botón "No estoy conforme" que lo escala a la plataforma. Al pie: "También puedes acudir a la ACODECO."

## Pedidos del comercio

### S-ORD-01 · `/orders` · Bandeja de pedidos
`orders:read` · `/v1/merchant/orders`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Pestañas con contador | Por aceptar · En preparación · Listos · En entrega · Historial | — |
| e2 | Tarjeta | Pedido {número} · {n} productos · {total} · Entrega/Retiro | En "Por aceptar": cuenta regresiva `mm:ss`; en `warning` bajo 5 min y en `error` bajo 2 min |
| e3 | Sonido y aviso | — | Al entrar un pedido nuevo, configurable en S-POS-11 |

Columnas lado a lado en pantallas ≥ 1024 dp. Vacío por pestaña: "No hay pedidos aquí."

### S-ORD-02 · `/orders/:id` · Detalle del sub-pedido
`orders:manage` · `/v1/merchant/sub-orders/:id/*`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | Pedido {número} · `StatusChip` · cuenta regresiva | — |
| e2 | Cliente | {nombre} · Entrega en {corregimiento} / Retiro | Teléfono y dirección completos solo desde "Aceptado" (N-DAT-12) |
| e3 | Productos | Líneas con existencias actuales al lado | Línea sin existencias marcada |
| e4 | Totales | Productos · Envío · Comisión PlentyPay · ITBMS de la comisión · **Recibirás** {neto} | Desglose de dominio §4 |
| e5 | `PPButton.primary` | Aceptar pedido → Marcar listo → Entregar al cliente | Cambia según el estado |
| e6 | `PPButton.secondary` | Rechazar | Motivo obligatorio: Sin existencias, Tienda cerrada, No entrego en esa zona, Otro. C-05 "Rechazar y reembolsar {monto}" |
| e7 | (retiro) Campo | Código del cliente | 6 dígitos; incorrecto: "El código no coincide." |
| e8 | Fila | Factura {número} / Emitir factura | Según preferencia fiscal |

Plazo vencido: `ACCEPT_DEADLINE_PASSED` "El plazo para aceptar terminó. El pedido fue reembolsado." Al marcar "listo" con entrega a domicilio se crea la entrega y aparece el enlace a S-LOG-02.
