# Entregas: tienda, repartidor y cliente

Módulo `logistics`. Paso F18.7 salvo indicación. Convenciones: [`README.md`](README.md). Regla de diseño estricta: [`../../gravital-experience-ui.md`](../../gravital-experience-ui.md). Estados: [`../../domain/domain-model.md`](../../domain/domain-model.md) §8.11. En el contrato las entidades son `Carrier` (transportista) y `Driver` (repartidor).

El módulo articula tres roles conectados en tiempo real:
- **Tienda / Comercio** (`logistics:manage`, `logistics:read`, `logistics:geofence:manage`): configura zonas y tarifas de entrega, administra su flota (`Driver` y `Carrier`), despacha entregas de pedidos del marketplace (`orders`) y de ventas en caja con envío a domicilio (`pos`), e imprime etiquetas QR de bultos.
- **Repartidor** (`courier` con permiso `logistics:deliver`): controla su disponibilidad en turno (`SetDriverAvailability`), recibe entregas asignadas, escanea paquetes al recoger, navega en ruta y registra la prueba de entrega o intento fallido (`RecordCheckpoint`).
- **Cliente / Destinatario** (`CUSTOMER` con permiso `orders:read:self`, o enlace público `/track/:token`): consulta todas sus entregas en curso e históricas (`S-LOG-07` y `S-MKT-07`), sigue al repartidor en el mapa en vivo, ve su hora estimada de llegada (ETA) y presenta el código de confirmación de 6 dígitos al recibir.

---

## 1. Tienda / Comercio

### S-LOG-01 · `/logistics` · Despacho
`logistics:manage` · `GET /v1/logistics/deliveries`, `POST /v1/logistics/deliveries`, `POST /v1/logistics/deliveries/{id}/assign` · Reglas: N-LOG-03, N-LOG-05

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Mapa | Marcadores de entregas y repartidores en turno | Ocupa la mitad derecha en ≥ 1024 dp (`Expanded` / `Large`); pestaña aparte en móvil (`Compact`) |
| e2 | Pestañas | Sin asignar · Asignadas · En camino · Con problema · Finalizadas | Con contador en cifras tabulares |
| e3 | Tarjeta | Entrega {número} · Origen ({pedido o venta POS}) · {corregimiento} · {distancia} · desde hace {tiempo} | Toca → S-LOG-02. Muestra insignia "+18" si `age_restricted=true` |
| e4 | `PPButton.secondary` | Asignar al más cercano | Envía `auto_assign=true`: asigna al repartidor activo y en turno más cercano al origen con licencia y póliza vigentes (`geolocation.FindNearby`) |
| e5 | `PPButton.primary` | Nueva entrega | Abre hoja para entrega manual o desde venta: sucursal de origen, dirección y punto de destino, receptor (nombre y teléfono), bultos, restricción +18, nota. Cotiza tarifa con `POST /v1/logistics/quote` |

Fuera de cobertura al crear entrega: `OUT_OF_DELIVERY_ZONE` "Esta sucursal no entrega en esa zona." Sin repartidores disponibles al auto-asignar: `DRIVER_NOT_AVAILABLE` "No hay repartidores disponibles en turno con documentos vigentes."

### S-LOG-02 · `/logistics/:id` · Detalle de entrega
`logistics:read` (`logistics:manage` para acciones) · `GET /v1/logistics/deliveries/{id}`, WebSocket `delivery` · Reglas: N-LOG-03, N-LOG-04, N-DAT-12

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Cabecera | Entrega {número} · `StatusChip` · Intento {n} de 3 | — |
| e2 | Mapa | Ruta, repartidor en vivo, hora estimada | Suscrito a WS `delivery` (`id=delivery_id`) |
| e3 | Línea de tiempo | Creada · Asignada · Recogida · En camino · Llegó · Entregada | Cada hito con fecha/hora (mes en texto, C-09) y ubicación. Checkpoint a más de 300 m del destino: etiqueta `warning` "Requiere revisión (> 300 m)" |
| e4 | Datos | Origen (enlace a sub-pedido S-ORD-02 o venta S-POS-07) · Destino · Receptor · Bultos (`package_code`) · Tarifa de envío · Restricción de edad | Contacto del cliente visible según permiso y mientras la entrega está activa |
| e5 | Prueba de entrega | Código / Foto / Firma · Recibido por {nombre} · Documento +18 verificado | Visible tras `DELIVERED`; en intento fallido muestra motivo (`DeliveryFailureReason`) y foto de evidencia |
| e6 | Acciones | Asignar o reasignar · Imprimir etiqueta QR · Reintentar · Cancelar | "Cancelar" solo en `PENDING` o `ASSIGNED` (C-05). "Reintentar" tras `FAILED` cuando `attempt_number < 3` |

Asignar a un repartidor con documentos vencidos: `DRIVER_DOCS_EXPIRED` "Este repartidor tiene documentos vencidos." Al 3.er intento fallido la entrega queda en `FAILED` definitivo y el pedido origen se cancela y reembolsa automáticamente.

### S-LOG-03 · `/logistics/drivers`, `/logistics/carriers` · Repartidores y transportistas
`logistics:manage` · `GET/POST /v1/logistics/drivers`, `GET/POST /v1/logistics/carriers` · Reglas: N-LOG-03, N-LAB-16

Repartidor (`Driver`):

| Campo | Validación |
|---|---|
| Usuario | Debe ser usuario del negocio con permiso `logistics:deliver` (`DRIVER_USER_INVALID` si no lo tiene) |
| Vínculo (`employment_kind`) | `Empleado` (`EMPLOYEE`) / `Contratista` (`CONTRACTOR`). Solo "Empleado" se vincula a `employee_id` en nómina (`payroll`, N-LAB-16) |
| Transportista (`carrier_id`) | Propio del comercio o uno externo de la lista |
| Tipo de vehículo (`vehicle_kind`) | Moto (`MOTORCYCLE`), Auto (`CAR`), Camioneta (`VAN`), Camión (`TRUCK`), Bicicleta (`BICYCLE`), A pie (`WALKING`) |
| Placa (`vehicle_plate`) | Obligatoria para vehículos a motor (`MOTORCYCLE`, `CAR`, `VAN`, `TRUCK`) |
| Licencia de conducir | Número (`license_number`), categoría (`license_category`) y vencimiento (`license_expires_on`, selector de fecha con mes en texto). Obligatoria para vehículos a motor |
| Póliza de seguro | Aseguradora (`insurance_provider`), número (`insurance_policy_number`) y vencimiento (`insurance_expires_on`). Obligatoria para vehículos a motor |
| Fotos de respaldo | Foto de licencia (`license_photo_key`) y foto de póliza (`insurance_photo_key`) en almacenamiento de objetos |
| Activo (`active`) | No se puede activar ni asignar con licencia o póliza vencidas (`DRIVER_DOCS_EXPIRED`, N-LOG-03) |

La lista muestra una insignia `warning` 30 días antes de cada vencimiento y `error` si está vencido, además del estado de turno actual (`En turno` / `Fuera de turno`).
Transportista (`Carrier`): nombre, RUC + DV (`INVALID_RUC` si no valida), teléfono de contacto, indicador de transportista externo y estado activo.

### S-LOG-04 · `/logistics/geofences` · Geocercas y zonas de entrega
`logistics:geofence:manage` · `/v1/geolocation/geofences` · Paso F14.7 / F18.7 · Regla: N-LOG-05

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Mapa interactivo | Herramientas de círculo y polígono | Un polígono necesita entre 3 y 100 vértices y no puede cruzarse a sí mismo (`INVALID_POLYGON`) |
| e2 | Lista de geocercas | Nombre · Tipo (`Sucursal`, `Zona de entrega`, `Zona de marcaje`) · Estado | — |
| e3 | Configuración de tarifa (solo `Zona de entrega`) | Tarifa base (`MoneyInput`) · Costo adicional por km (`MoneyInput`) · Envío gratis desde (`MoneyInput` opcional) · Tiempo estimado base (min) | Alimenta `QuoteDelivery` para el checkout del marketplace y ventas POS con envío a domicilio |
| e4 | `PPButton.primary` | Guardar zona | — |

---

## 2. Repartidor (`courier`)

### S-LOG-05 · `/courier` · Mis entregas (repartidor)
`logistics:deliver` · `GET /v1/logistics/my-deliveries`, `POST /v1/logistics/me/availability` · Reglas: N-LOG-03, N-LOG-06, N-DAT-02

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Interruptor | En turno / Fuera de turno | Llama a `POST /v1/logistics/me/availability`. Al activarlo por primera vez exige el consentimiento explícito de ubicación (`CONSENT_REQUIRED`): "Compartimos tu ubicación con el negocio y con el cliente solo mientras estás en turno." Si sus documentos vencieron: `DRIVER_DOCS_EXPIRED` "Tus documentos de conducción o seguro están vencidos. Actualízalos con el comercio." Fuera de turno detiene el envío de ubicación a `geolocation` |
| e2 | Lista ordenada | Entrega {número} · {corregimiento} · {distancia} · ETA {minutos} min | Ordenada por prioridad de ruta. Muestra insignia "+18 Verificar edad" cuando `age_restricted=true`. Toca → S-LOG-06 |
| e3 | Indicador | Sin conexión: {n} registros por enviar | Cola local persistente con `idempotency_key`; sincroniza automáticamente al recuperar red |

Vacío en turno: "Estás en turno. Te avisaremos apenas te asignen una entrega." Vacío fuera de turno: "Activa tu turno para recibir entregas."

### S-LOG-06 · `/courier/:id` · Entrega en curso (repartidor)
`logistics:deliver` · `POST /v1/logistics/deliveries/{id}/checkpoints` · Reglas: N-LOG-04, N-DAT-12

El único botón primario (`PPButton.primary`) cambia según el estado actual de la entrega:

| Estado actual | Botón primario | Requisito y validación |
|---|---|---|
| `ASSIGNED` (Asignada) | Recoger paquete | Abre cámara para escanear el QR de los bultos (`package_code`). Si no coincide: `PACKAGE_CODE_INVALID` "Este paquete no corresponde a la entrega." |
| `PICKED_UP` (Recogida) | Iniciar viaje | Pasa a `IN_TRANSIT` y notifica al cliente que el repartidor va en camino |
| `IN_TRANSIT` (En camino) | Llegué | Botón secundario "Navegar" abre la app de mapas externa con las coordenadas de destino; botón "Llamar" marca al receptor |
| `ARRIVED` (Llegó) | Entregar | Abre la hoja de prueba de entrega (`ProofOfDeliveryKind`) |

**Prueba de entrega (al pulsar "Entregar"):**
1. **Confirmación de recepción** (en este orden):
   - Opción principal (`CODE`): código de 6 dígitos que muestra el cliente en su app (`delivery_code`). Código incorrecto: `DELIVERY_CODE_MISMATCH` "El código no coincide." Tras 5 fallos se bloquea (`DELIVERY_CODE_BLOCKED`) y exige foto o firma.
   - Alternativa (`PHOTO` o `SIGNATURE`) si el receptor no tiene el código: foto del paquete entregado en el punto o firma en pantalla (`proof_photo_key` / `signature_svg_key`), más el campo obligatorio "Nombre de quien recibe" (`received_by_name`). Sin prueba válida: `PROOF_REQUIRED` "Registra el código, la foto o la firma de entrega."
2. **Verificación de mayoría de edad (`age_restricted = true`, N-LOG-04):**
   - Casilla obligatoria (nunca premarcada): "Verifiqué el documento oficial: quien recibe es mayor de 18 años" (`age_verified = true`).
   - Selector de fecha de nacimiento del documento (`recipient_birth_date`, mes en texto). Si es menor de 18 años o no presenta documento: `AGE_REQUIREMENT` "Esta entrega requiere verificar mayoría de edad (18+)." y solo permite registrar intento fallido por `AGE_VERIFICATION_FAILED`.

**Intento fallido (botón secundario "No pude entregar"):**
- Exige seleccionar motivo (`DeliveryFailureReason`: `No había nadie`, `Dirección incorrecta`, `Rechazó el paquete`, `No presentó documento (+18)`, `Zona insegura`, `Otro` + nota) y tomar foto de evidencia (`proof_photo_key`).
- Registra el intento fallido (`FAILED`). Al finalizar la entrega (`DELIVERED`, `FAILED` o `CANCELLED`), el teléfono y la dirección exacta del cliente desaparecen de la pantalla del repartidor (minimización de datos, N-DAT-12).

---

## 3. Cliente / Destinatario

### S-LOG-07 · `/deliveries`, `/deliveries/:id` · Mis entregas y seguimiento en vivo (cliente)
`orders:read:self` · `GET /v1/me/deliveries`, `GET /v1/me/deliveries/{id}`, WebSocket `delivery` · Paso F18.7 · Reglas: N-CON-03, N-LOG-04, N-DAT-12

Vista unificada para el cliente de todas las entregas a domicilio asociadas a su cuenta (tanto compras de `marketplace` como compras presenciales o telefónicas en `pos` con envío a domicilio):

| Id | Componente | Texto visible | Comportamiento y validación |
|---|---|---|---|
| e1 | Filtro (en `/deliveries`) | En curso · Anteriores | Lista tarjetas con comercio, estado (`StatusChip`), ETA o fecha de entrega (mes en texto) |
| e2 | Cabecera (en `/deliveries/:id`) | Entrega de {nombre comercial} · `StatusChip` · Llegada estimada {hora / minutos} | — |
| e3 | Mapa en vivo | Ubicación del repartidor y punto de entrega | Visible en `PICKED_UP`, `IN_TRANSIT` y `ARRIVED` vía WS `delivery`. Coordenadas del repartidor redondeadas a ~100 m por privacidad |
| e4 | Tarjeta de código | Código de recepción: **{6 dígitos}** · "Muéstraselo al repartidor al recibir tu pedido" | Destacado en `surfaceContainerHigh` mientras la entrega está activa |
| e5 | Repartidor | {primer nombre del repartidor} · {tipo de vehículo} · Placa {placa} | Sin datos personales sensibles del repartidor |
| e6 | Aviso +18 | Ten a mano tu cédula o pasaporte: el repartidor debe verificar que eres mayor de 18 años. | Visible solo cuando `age_restricted=true` (N-LOG-04) |
| e7 | Línea de tiempo | Preparando envío · Repartidor asignado · Pedido recogido · En camino · El repartidor llegó · Entregado | Con hora de cada hito; si hubo un intento fallido muestra el motivo y el número de intento (`Intento {n} de 3`) |
| e8 | Acciones | Ver detalle de compra · Tengo un problema | "Ver detalle de compra" abre S-MKT-07 (si proviene de un pedido) o el recibo; "Tengo un problema" abre S-MKT-08 con la entrega precargada |

Vacío: "No tienes entregas en curso." Para destinatarios sin cuenta o que reciben el enlace por WhatsApp/correo, la página pública `S-PUB-02 · /track/:token` (en [`09-admin-platform.md`](09-admin-platform.md)) muestra el mapa y el estado en vivo sin exponer datos personales ni el código de 6 dígitos.

