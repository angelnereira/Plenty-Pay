# Productos e inventario

Módulos `catalog` (paso F15.10) e `inventory` (paso F16.7). Convenciones: [`README.md`](README.md).

## Productos

### S-CAT-01 · `/catalog` · Lista de productos
`catalog:read` · `/v1/catalog/products`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Buscador | Buscar por nombre, código o SKU | Icono de cámara: escanear código de barras |
| e2 | Filtros | Categoría · Estado (Activo, Archivado) · Publicado en tiendas · Sin existencias · Datos incompletos | "Datos incompletos" lista lo que impide vender o publicar |
| e3 | Lista | Foto, nombre, SKU, precio, existencias, etiquetas | Toca → S-CAT-02. Etiqueta "En el marketplace" si está publicado |
| e4 | `PPButton.primary` | Nuevo producto | Requiere `catalog:write` |
| e5 | Menú | Importar · Exportar · Categorías | → S-CAT-03, C-20, S-CAT-04 |

Vacío: "Aún no tienes productos." con "Nuevo producto" e "Importar desde un archivo".

### S-CAT-02 · `/catalog/new`, `/catalog/:id` · Editor de producto
`catalog:write` · Reglas: N-FIS-01, N-FIS-02, N-FIS-13, N-CON-02, N-CON-03, N-CON-07, N-LOG-01, N-LOG-04, N-LOG-05, N-LOG-07, N-FMT-08, N-FMT-09

| Sección | Campo | Validación |
|---|---|---|
| Básico | Nombre | 2–120 caracteres, obligatorio |
| | Descripción | ≤ 4 000 caracteres; obligatoria para publicar |
| | Categoría | Lista; obligatoria. Determina descuentos de ley y restricciones |
| | Fotos | Hasta 8, JPEG/PNG/WebP ≤ 5 MB; la primera es la principal; texto alternativo por foto. "Agregar foto" ofrece "Tomar foto" (cámara, donde el equipo la tenga) y "Elegir de la galería"; sin cámara abre la galería directamente (ADR 0021) |
| Identificación | SKU | Único en el negocio; se genera si se deja vacío |
| | Código de barras | GTIN de 8, 12, 13 o 14 dígitos con dígito de control válido (N-STD-23): "El código de barras no es válido." Botón de escanear. Un código que empieza por `02` o `20`–`29` se guarda como **código interno** con el aviso "Este código es de uso interno de tienda; no identifica el producto fuera de tu negocio." (N-STD-24). Sin código del fabricante: botón "Generar código interno" (prefijo `2`, N-STD-26) |
| Venta | Unidad de medida | Unidad (ud) · kg · g · L · mL · m · cm · m². Obligatoria. No se puede cambiar si hay movimientos |
| | Se vende a granel | Activa cantidades decimales (milésimas) |
| | Precio de venta | `MoneyInput`; obligatorio; > $0.00 |
| | El precio incluye ITBMS | Activo por defecto |
| | Costo | Opcional; solo visible con `inventory:read` |
| Impuestos | Tratamiento | Gravado / Exento / No sujeto. Obligatorio |
| | Tasa de ITBMS | 7 % (por defecto) · 10 % · 15 % · 0 %. Solo si es Gravado. Sugerida por la categoría (alcohol y hospedaje 10 %, tabaco 15 %); el usuario puede cambiarla con aviso |
| | Lleva impuesto selectivo | Etiqueta informativa |
| Variantes | Atributos y combinaciones | Cada variante: SKU, código de barras, precio y existencias propias |
| Precios por sucursal | Tabla sucursal → precio | Opcional |
| Inventario | Controlar existencias | Activo por defecto |
| | Controla lotes y vencimientos | Solo si lleva inventario (`LOTS_REQUIRE_INVENTORY`). Texto de ayuda: "Cada entrada pide el lote del proveedor; las ventas salen primero de lo que vence antes." Obligatorio en alimentos perecederos y medicamentos (lo decide el comercio; el sistema no lo impone por categoría hasta F15.11) |
| | Existencia mínima | Dispara la alerta de quiebre |
| Garantía y devoluciones | Días de garantía | Entero ≥ 0. 0 solo si la categoría lo permite |
| | Política de devolución | Lista: 7 / 15 / 30 días, o la de la tienda. Sin opción de negar devolución por defecto |
| Restricciones | Solo mayores de 18 | Automático y bloqueado en alcohol y tabaco |
| | Requiere receta | Si está activo, no se puede publicar en tiendas |
| Marketplace | Mostrar en el marketplace | Interruptor; solo en un producto ya guardado y con `catalog:listing:manage`. Lo cambia al instante (`PUT /v1/catalog/products/:id/listing`, sin esperar a "Guardar"). Sin foto o sin precio: `LISTING_INCOMPLETE` "Al producto le falta foto o precio para publicarse." Con la tienda oculta (S-CAT-05) avisa "Tu tienda está oculta: el producto se verá cuando la muestres." (N-CON-02) |
| Oferta | Precio de oferta · desde · hasta | Menor que el precio de venta. El "precio anterior" lo calcula el sistema (más bajo de los últimos 90 días) y se muestra de solo lectura |

Botón primario "Guardar". Acción secundaria "Archivar" (C-05; el producto deja de venderse y no se borra). Al pie, panel "Listo para vender: sí/no" y "Listo para publicar: sí/no" con la lista de lo que falta, enlazada al campo.

### S-CAT-03 · `/catalog/import` · Importar productos
`catalog:import`. Paso 1: descargar plantilla CSV y subir archivo (UTF-8, ≤ 10 MiB). Paso 2: vista previa de las primeras 50 filas con el mapeo de columnas. Paso 3: validación por fila con las mismas reglas de S-CAT-02; resumen "{n} válidas · {m} con errores" y descarga de las filas con error y su motivo. Paso 4: botón "Importar {n} productos". Nada se importa a medias: las filas válidas entran y las inválidas no.

### S-CAT-04 · `/catalog/categories` · Categorías
`catalog:write`. Árbol de hasta 3 niveles. Cada categoría: nombre, categoría superior, **tipo de categoría legal** (General, Restaurante, Comida rápida, Medicamentos, Alcohol, Tabaco, Hospedaje, Alimentos perecederos), tasa de ITBMS sugerida. El tipo legal decide descuentos de ley, edad mínima y vencimiento. Una categoría con productos no se elimina.

### S-CAT-05 · `/catalog/storefront` · Mi tienda en línea
`catalog:listing:manage` · Regla: N-CON-02

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Estado | Tu tienda está {visible / oculta} | Solo negocios `ACTIVE` pueden hacerla visible |
| e2 | Datos | Logo · Portada · Nombre · Descripción · Dirección web `/s/{slug}` | Slug único, minúsculas y guiones |
| e3 | Horario | Por día | — |
| e4 | Entrega | Retiro en tienda · Entrega a domicilio: zonas (corregimientos o radio en km) y costo | Al menos una modalidad |
| e5 | Política de devoluciones | Plazo en días · condiciones | Mínimo el de la plataforma. No admite excluir productos defectuosos |
| e6 | Lista de productos | Interruptor "Publicar" por producto | Refleja `listed_in_marketplace` del producto y se puede cambiar aunque la tienda esté oculta (no se ve hasta mostrarla). Rechazo con el motivo si le faltan datos obligatorios (`LISTING_INCOMPLETE`) |
| e7 | `PPButton.primary` | Guardar | — |

## Inventario

### S-INV-01 · `/inventory` · Existencias
`inventory:read` · `/v1/inventory/stock`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Tarjetas de alerta | {n} por agotarse · {n} agotados · {n} lotes por vencer | Filtran la lista. F16.10: «lotes por vencer» cuenta los lotes con existencia vencidos o que vencen dentro de los días de aviso del comercio (`GET /v1/inventory/lots?only_expiring=true`) y deja en la lista los productos de esos lotes |
| e2 | Selector | Bodega | "Todas" suma |
| e3 | Buscador y escáner | — | — |
| e4 | Tabla | Producto · Disponible · Reservado · Bloqueado · En camino · Mínimo · Días de cobertura | Cantidades con su unidad SI. Negativo en `error`. F16.10: «Bloqueado» solo si es mayor que 0; el disponible ya lo descuenta |
| e5 | Menú | Ajustar · Transferir · Órdenes de compra · Proveedores · Sugerencias de reorden · Aviso de vencimiento · Exportar | Según permiso: `inventory:adjust`, `inventory:purchase:manage` o `inventory:receive` (órdenes), `inventory:purchase:manage` (proveedores), `inventory:read` (sugerencias), `inventory:adjust` (aviso). *Pendiente*: Exportar |
| e6 | Diálogo «Aviso de vencimiento» (F16.10) | «Avisar cuando un lote venza en» · campo «Días» · «Cancelar» · «Guardar» | Entero de 1 a 365 (sin fijar: 30). `PUT /v1/inventory/settings`. Fuera de rango: «Indica de 1 a 365 días.» |

### S-INV-02 · `/inventory/:variant` · Detalle de existencias
Interruptor "Mostrar en el marketplace" del producto (mismo comportamiento que S-CAT-02, con `catalog:listing:manage`). Existencias por bodega; lotes con fecha de vencimiento (F16.4: «Lote {código}» · bodega · «Vence el {fecha con mes en texto}» o «Sin vencimiento» · existencia; vencidos con la etiqueta "Vencido" en `error` y los que vencen en 30 días con "Vence pronto" en `warning`, nunca solo color; sin lotes: "Sin lotes con existencia."); cada movimiento muestra su lote; movimientos con fecha, tipo (Recepción, Venta, Ajuste, Transferencia, Devolución, Baja, Bloqueo, Desbloqueo), cantidad con signo, saldo, documento de origen enlazado y usuario; cobertura en días según velocidad de venta.

**Existencia bloqueada (F16.10).** Cada bodega muestra «Reservado {n}» y, si hay, «Bloqueado {n}»; cada lote, «Bloqueado {n}» si hay. «Vence pronto» usa los días de aviso del comercio (S-INV-01 e6), no un valor fijo. Con `inventory:adjust`, tocar una bodega (producto sin lotes) o un lote (producto con lotes: bloquear exige el lote) abre un menú:

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| b1 | Menú | Bloquear · Desbloquear · Dar de baja lo bloqueado | Las dos últimas solo si hay algo bloqueado |
| b2 | Diálogo: campo | Cantidad | Mayor que 0; hasta lo disponible (bloquear) o lo bloqueado (desbloquear y baja). Lo bloqueado no se vende, no se reserva ni se transfiere |
| b3 | Diálogo: selector | Motivo | Daño, En revisión, Retiro del fabricante, Vencimiento, Otro + texto. Obligatorio |
| b4 | Diálogo: acción | Bloquear · Desbloquear · Dar de baja | La baja pide confirmación (C-05: «Una baja no se edita ni se borra.»). Errores: `OUT_OF_STOCK` «No hay existencia suficiente.», `EXCEEDS_BLOCKED` «No hay tanta existencia bloqueada.» |

### S-INV-03 · `/inventory/adjust` · Ajuste
`inventory:adjust`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Selector | Bodega | — |
| e2 | Líneas | Producto · Sistema {n} · Contado · Diferencia | Se puede escanear (cámara o lector) para elegir el producto (C-27) |
| e2b | Lote (F16.4) | Entrada: "Lote del proveedor" y "Vencimiento" (calendario; vacío = sin vencimiento) · Salida: "Lote que sale" con "Automático (primero lo que vence antes)" o un lote | Solo si el producto controla lotes. Entrada sin lote: `LOT_REQUIRED`; vencimiento pasado: `LOT_EXPIRED`; lote ajeno a la bodega: `LOT_NOT_FOUND`. Para desechar lo vencido se elige su lote |
| e3 | Selector | Motivo | Conteo físico, Daño, Vencimiento, Robo o pérdida, Error de registro, Otro + texto. Obligatorio |
| e4 | Adjunto opcional | Evidencia | — |
| e5 | `PPButton.primary` | Aplicar ajuste | C-05 con el número de líneas y el valor al costo |

Un ajuste no se edita ni se borra: se corrige con otro ajuste.

### S-INV-04 · `/inventory/transfer` · Transferencia
`inventory:adjust`. Origen, destino (distinto), producto (se puede escanear, C-27), líneas con cantidad ≤ disponible en origen, lote si aplica (se propone el de vencimiento más próximo). Estados: En tránsito → Recibida. La bodega destino confirma la recepción con cantidades; una diferencia genera un ajuste con motivo "Diferencia de transferencia".

### S-INV-05 · `/inventory/purchases` · Órdenes de compra
`inventory:purchase:manage` (listar también con `inventory:receive`). Lista con `StatusChip` (Borrador, Enviada, Recibida parcial, Recibida, Cancelada) y filtro por estado. Editor: proveedor, bodega de destino, fecha esperada, líneas (producto, cantidad, costo unitario), total calculado por el servidor. Acciones: "Guardar borrador", "Marcar como enviada", "Cancelar" (solo Borrador o Enviada, C-05), "Recibir" (Enviada o Recibida parcial → S-INV-06). *Pendiente*: ITBMS por línea y el envío al proveedor por correo con PDF (notifications, F20).

### S-INV-06 · `/inventory/receive/:po` · Recepción
`inventory:receive`

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | Orden {número} · {proveedor} | — |
| e2 | Líneas | Producto · Pedido {n} · Recibido antes {m} · Recibido ahora | No se recibe más de lo pedido: `RECEIPT_EXCEEDS_ORDERED` "Estás recibiendo más de lo pedido." F16.11: botón «Escanear código» en la barra y lector (C-27); la primera lectura de una línea reemplaza la cantidad propuesta por 1 y las siguientes suman 1; un producto que no está en la orden: «Ese producto no está en la orden.» |
| e3 | Por línea | Lote del proveedor · Vencimiento | F16.8: obligatorio si el producto controla lotes (`LOT_REQUIRED`); vencimiento pasado bloqueado (`LOT_EXPIRED`). Un mismo producto puede recibirse en varios lotes (una línea por lote vía API; en la app, un lote por recepción) |
| e4 | Campo | Factura del proveedor (número) | Opcional, hasta 60 caracteres |
| e5 | `PPButton.primary` | Registrar recepción | Genera los movimientos y actualiza el estado de la orden |

### S-INV-07 · `/inventory/suppliers` · Proveedores
`inventory:purchase:manage`. Lista y editor: razón social, RUC + DV (validados, N-FMT-06), teléfono (N-FMT-07), correo, días de entrega (lo usa la sugerencia de reorden, por defecto 7) y activo. *Pendiente*: contacto, condiciones de pago y productos que suministra.

### S-INV-08 · `/inventory/suggestions` · Sugerencias de reorden
`inventory:read`. Tabla: producto, disponible, en camino, venta diaria promedio, días de cobertura, cantidad sugerida, clase ABC y proveedor habitual (el de la última orden con ese producto). Casillas de selección y botón primario "Crear orden de compra" (`inventory:purchase:manage`) que abre S-INV-05 con las líneas del primer proveedor elegido; las demás quedan seleccionadas para la siguiente.

### S-INV-09 · `/inventory/warehouses` · Bodegas
Lista y editor: nombre, sucursal, dirección, tipo (Tienda, Bodega, Tránsito), activa. Una bodega con existencias no se desactiva.
