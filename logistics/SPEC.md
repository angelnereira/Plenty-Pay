# SPEC — logistics

## 1. Responsabilidad
**Hace**: módulo integral de **entregas y despacho (`delivery`)** para tres roles (**Tienda/Comercio**, **Repartidor** y **Cliente/Comprador**) sobre cualquier producto vendido en PlentyPay — tanto pedidos del **marketplace multi-comercio (`orders`)** como **ventas en tienda con envío a domicilio (`pos`)** o entregas manuales. Gestiona transportistas (`Carrier`) y repartidores (`Driver`, propios con vínculo laboral `EMPLOYEE` en `payroll` o independientes `CONTRACTOR`), vigencia de documentos (licencia y póliza), estado de turno con consentimiento de ubicación, cotización de tarifa y cobertura por geocerca (`QuoteDelivery`), asignación manual y automática por cercanía (`geolocation.FindNearby`), puntos de control escaneando código QR del paquete, prueba de entrega (código de 6 dígitos del cliente, foto o firma + verificación de mayoría de edad), manejo de hasta 3 intentos con retorno a inventario en caso de fallo definitivo, vista de entregas del cliente autenticado y enlace/stream de seguimiento en tiempo real.
**No hace**: almacenar series históricas de ubicación (`geolocation`), procesar el cobro financiero del envío (`orders` y `pos` incluyen `delivery_fee` en el cobro vía `payments-core`), descontar o reingresar existencias directamente (`inventory` lo ejecuta al recibir la orden de `orders`/`pos`).

## 2. Ficha
Go · 50068 · `logistics.proto` · esquema `logistics` · object-storage (fotos de prueba, firmas y documentos de repartidor) · Fase F18 · Capa L3.

## 3. Modelo de datos
```sql
CREATE TABLE logistics.carriers (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, kind text NOT NULL, -- OWN|EXTERNAL
  ruc text, dv text, contact_phone text, contact_email text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE logistics.drivers (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, carrier_id uuid REFERENCES logistics.carriers(id),
  employment_kind text NOT NULL CHECK (employment_kind IN ('EMPLOYEE','CONTRACTOR')),   -- EMPLOYEE se vincula a payroll (N-LAB-16)
  payroll_employee_id uuid,
  vehicle_kind text NOT NULL CHECK (vehicle_kind IN ('MOTORCYCLE','CAR','BICYCLE','WALKING','TRUCK')),
  vehicle text, plate text,
  license_number text, license_kind text, license_expires_on date, license_photo_object_key text,
  insurance_provider text, insurance_number text, insurance_expires_on date, insurance_photo_object_key text,
  active boolean NOT NULL DEFAULT true, available boolean NOT NULL DEFAULT false,
  location_consent_at timestamptz,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  UNIQUE (tenant_id, user_id)
);
CREATE TABLE logistics.delivery_zones (
  geofence_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid,
  base_fee_minor bigint NOT NULL CHECK (base_fee_minor >= 0),
  per_km_fee_minor bigint NOT NULL DEFAULT 0 CHECK (per_km_fee_minor >= 0),
  free_shipping_min_minor bigint, active boolean NOT NULL DEFAULT true
);
CREATE TABLE logistics.deliveries (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, branch_id uuid, warehouse_id uuid,
  status smallint NOT NULL, source_type text NOT NULL, source_id text NOT NULL,         -- 'sub_order' | 'sale' | 'order'
  recipient_user_id uuid,                                                               -- cliente comprador (orders o pos)
  pickup jsonb NOT NULL, dropoff jsonb NOT NULL,                                        -- Address + GeoPoint + contacto (visible al repartidor solo en ruta)
  driver_id uuid REFERENCES logistics.drivers(id), carrier_id uuid REFERENCES logistics.carriers(id),
  packages_count int NOT NULL DEFAULT 1 CHECK (packages_count > 0),
  package_code text NOT NULL,                                                           -- código QR del paquete escaneado al recoger
  notes text, age_restricted boolean NOT NULL DEFAULT false,                            -- N-LOG-04: exige verificar >= 18 años
  delivery_fee_minor bigint NOT NULL DEFAULT 0, currency char(3) NOT NULL DEFAULT 'USD',
  attempts smallint NOT NULL DEFAULT 0, needs_review boolean NOT NULL DEFAULT false,
  proof jsonb,                                                                          -- {kind: CODE|PHOTO|SIGNATURE, object_key, received_by_name, age_verified, birth_date}
  delivery_code_hash bytea NOT NULL, delivery_code_failures smallint NOT NULL DEFAULT 0,-- código de 6 dígitos que muestra el cliente
  tracking_token text NOT NULL UNIQUE,                                                  -- ≥ 22 chars base64url
  eta timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, source_type, source_id)
);
CREATE INDEX deliveries_tenant_status ON logistics.deliveries (tenant_id, status, created_at DESC);
CREATE INDEX deliveries_driver_status ON logistics.deliveries (driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX deliveries_recipient_user ON logistics.deliveries (recipient_user_id, created_at DESC) WHERE recipient_user_id IS NOT NULL;
CREATE TABLE logistics.checkpoints (
  id uuid PRIMARY KEY, delivery_id uuid NOT NULL REFERENCES logistics.deliveries(id), status smallint NOT NULL,
  location geography(Point), scanned_code text, note text,
  needs_review boolean NOT NULL DEFAULT false,
  proof_kind text, proof_object_key text, received_by_name text, age_verified boolean NOT NULL DEFAULT false,
  failure_reason text, actor_user_id uuid NOT NULL, created_at timestamptz NOT NULL
);
-- + outbox, processed_events, idempotency_keys
```
RLS: `carriers`, `drivers`, `delivery_zones`, `deliveries` y `checkpoints` por `tenant_id`; política adicional de lectura en `deliveries` por `recipient_user_id = current_setting('app.user_id')` para las consultas del rol Cliente (`ListCustomerDeliveries` / `GetCustomerDelivery`).

## 4. RPCs
| RPC | Permiso | Idemp. | Comportamiento clave | Errores (`reason`) |
|---|---|---|---|---|
| UpsertCarrier / ListCarriers | `logistics:manage` / `logistics:read` | sí / — | transportistas propios (`OWN`) o externos (`EXTERNAL`) con RUC+DV y contacto | `INVALID_RUC`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| UpsertDriver / ListDrivers | `logistics:manage` / `logistics:read` | sí / — | repartidor debe ser usuario del tenant con `logistics:deliver`; valida documentos vigentes para vehículos a motor (N-LOG-03) y vínculo `EMPLOYEE`/`CONTRACTOR` (N-LAB-16) | `DRIVER_USER_INVALID`, `DRIVER_DOCS_EXPIRED`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| SetDriverAvailability | `logistics:deliver` | sí | rol repartidor activa/desactiva "En turno / Fuera de turno" (N-LOG-06); exige consentimiento de ubicación (N-DAT-02) y documentos vigentes | `CONSENT_REQUIRED`, `DRIVER_DOCS_EXPIRED`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| QuoteDelivery | `logistics:read`, `pos:sell` o servicio (`orders`, `pos`) | — | verifica que `dropoff` esté dentro de una geocerca `DELIVERY_ZONE` activa (`geolocation.IsInside`), calcula distancia, tarifa en centavos y ETA estimado | `OUT_OF_DELIVERY_ZONE`, `NOT_FOUND` |
| CreateDelivery | `logistics:manage` o servicio (`orders`, `pos`) | sí | crea entrega desde `sub_order` (marketplace), `sale` (POS) o despacho manual; genera `package_code`, `tracking_token` y código de 6 dígitos (enviado al cliente vía `notifications`) | `DELIVERY_ALREADY_EXISTS`, `OUT_OF_DELIVERY_ZONE`, `IDEMPOTENCY_KEY_REUSED` |
| AssignDelivery | `logistics:manage` | sí | manual (`driver_id`) o `auto_assign=true` → elige al repartidor en turno (`available=true`) más cercano con documentos vigentes (`geolocation.FindNearby`) | `DRIVER_NOT_AVAILABLE`, `DRIVER_DOCS_EXPIRED`, `INVALID_STATE_TRANSITION`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| RecordCheckpoint | `logistics:deliver` (repartidor asignado) | sí | transiciones §8.11; `PICKED_UP` exige escanear QR del paquete (`package_code`); `DELIVERED` exige prueba y mayoría de edad si `age_restricted=true`; `FAILED` exige motivo y foto | `DRIVER_NOT_ASSIGNED`, `INVALID_STATE_TRANSITION`, `PACKAGE_CODE_INVALID`, `PROOF_REQUIRED`, `DELIVERY_CODE_MISMATCH`, `DELIVERY_CODE_BLOCKED`, `AGE_REQUIREMENT`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| CancelDelivery | `logistics:manage` o servicio (`orders`, `pos`) | sí | solo en `PENDING` o `ASSIGNED` | `INVALID_STATE_TRANSITION`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` |
| GetDelivery / ListDeliveries | `logistics:read` | — | vista completa de despacho para la tienda | `NOT_FOUND` |
| ListMyDeliveries | `logistics:deliver` | — | cola ordenada de entregas asignadas al repartidor en turno | — |
| ListCustomerDeliveries / GetCustomerDelivery | `orders:read:self` | — | rol cliente: consulta sus entregas (de `orders` y `pos`), ve ubicación en vivo en `IN_TRANSIT`/`ARRIVED`, primer nombre del repartidor y su código de 6 dígitos | `NOT_FOUND` |
| GetPublicTracking | público con token | — | estado, ETA, primer nombre del repartidor y ubicación aproximada (~100 m) solo durante `IN_TRANSIT`; sin nombres completos, direcciones ni teléfonos | `TRACKING_TOKEN_INVALID`, `RATE_LIMITED` |
| StreamDelivery | comercio, repartidor asignado o cliente del pedido (vía gateway) | — | stream de cambios de estado y ubicación en vivo | `TRACKING_TOKEN_INVALID`, `NOT_FOUND` |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa N-LOG-03, N-LOG-04, N-LOG-06, N-LAB-16, N-DAT-02 y N-DAT-12. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Transiciones de `domain-model.md` §8.11 (`PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED`; `ARRIVED/IN_TRANSIT → FAILED`). Máximo **3 intentos**; un intento fallido con `attempts < 3` permite reintentar (`FAILED → ASSIGNED`); al 3.er intento fallido (`attempts = 3`) el estado `FAILED` es **terminal** y dispara el evento `DeliveryStatusChanged` para retorno a tienda, reingreso a inventario (`inventory` movimiento `RETURN`) y reembolso en `orders`/`pos`.
- **R2** `DELIVERED` requiere prueba (`ProofOfDeliveryKind`): código de 6 dígitos del cliente (`CODE`, comparado en tiempo constante contra `delivery_code_hash`), foto del paquete (`PHOTO`) o firma en pantalla con nombre de quien recibe (`SIGNATURE`). Si el código falla 5 veces seguidas → `DELIVERY_CODE_BLOCKED` y alerta inmediata al comercio. Si `age_restricted = true` (N-LOG-04), exige además `age_verified = true` y fecha de nacimiento del documento que acredite ≥ 18 años en la fecha de la entrega (`AGE_REQUIREMENT` si no cumple).
- **R3** Cada checkpoint registra la ubicación del repartidor; si está a > 300 m del punto de entrega al marcar `ARRIVED` o `DELIVERED` → marca `needs_review = true` en el checkpoint y en la entrega (no bloquea la entrega, alerta a la tienda).
- **R4** Minimización de datos personales (N-DAT-12): los datos completos de contacto y dirección del destinatario solo son visibles para el repartidor asignado entre `ASSIGNED` y `ARRIVED`; al pasar a `DELIVERED`, `FAILED` o `CANCELLED` se enmascaran en las respuestas a `logistics:deliver`. Para el cliente (`GetCustomerDelivery` / `PublicTracking`), solo se expone el primer nombre del repartidor y su tipo de vehículo/placa.
- **R5** Seguimiento público (`GetPublicTracking`): token aleatorio ≥ 128 bits en base64url, expira 72 h después de alcanzar un estado terminal; rate limit en `api-gateway`.
- **R6** Cotización y ETA (`QuoteDelivery`): valida cobertura contra geocercas `DELIVERY_ZONE` del comercio en `geolocation`, calcula tarifa base + tramo por distancia en centavos (enteros, jamás flotantes) y ETA = distancia / velocidad media reportada por `geolocation`.
- **R7** En cada transición de estado se escribe en el outbox (en la misma transacción SQL) un evento `DeliveryStatusChanged` con `source` (`sub_order` o `sale`), `recipient_user_id`, `failed_attempts` y `warehouse_id`.
- **R8** Documentos del repartidor (N-LOG-03): para vehículos a motor (`MOTORCYCLE`, `CAR`, `TRUCK`) son obligatorios placa, licencia y póliza de seguro vigentes. Si `license_expires_on < today` o `insurance_expires_on < today`, el repartidor no puede ponerse en turno ni recibir asignaciones (`DRIVER_DOCS_EXPIRED`), y la UI muestra aviso preventivo 30 días antes del vencimiento.
- **R9** Vínculo laboral (N-LAB-16): cada repartidor tiene `employment_kind` (`EMPLOYEE` o `CONTRACTOR`). Solo `EMPLOYEE` se asocia a `payroll_employee_id` para asistencia y corridas de nómina en `payroll`.
- **R10** Ubicación en turno (N-LOG-06): `SetDriverAvailability(available=true)` exige que el repartidor haya otorgado el consentimiento de ubicación; al pasar a `available=false` deja de recibir asignaciones automáticas y `geolocation` rechaza pings fuera de turno.

## 6. Eventos
Publica: `DeliveryStatusChanged` (`pp.logistics.delivery.status_changed.v1`), `AuditRecorded` (`pp.audit.logistics.recorded.v1`).
Consume: `GeofenceCrossed` (`pp.geo.geofence.crossed.v1` — transición o aviso de llegada cuando el repartidor entra en la geocerca del destino).

## 7. Dependencias y vinculación con otros módulos
- **Llama por gRPC a**:
  - `geolocation` (`FindNearby`, `GetLastLocation`, `IsInside`, `WatchSubject`; deadline 500 ms): geocercas de cobertura, asignación al repartidor más cercano, validación de radio de 300 m y stream de posición.
  - `identity` (`GetUserContacts`, validación de usuario del tenant; deadline 500 ms): datos del repartidor y verificación de pertenencia al comercio.
- **Es llamado por gRPC desde**:
  - `api-gateway`: rutas de Tienda (`/v1/logistics/*`), Repartidor (`/v1/logistics/me/availability`, `/v1/logistics/my-deliveries`, `/checkpoints`), Cliente (`/v1/me/deliveries/*`), Público (`/v1/public/tracking/{token}`) y WebSocket `/v1/realtime` (topic `delivery`).
  - `orders`: `QuoteDelivery` en `QuoteCheckout` y `CreateDelivery` cuando el sub-pedido con envío a domicilio es aceptado/preparado (`source.type = "sub_order"`).
  - `pos`: `QuoteDelivery` al agregar envío a domicilio en una venta de mostrador/teléfono y `CreateDelivery` al pagarse la venta (`source.type = "sale"`).
- **Integración por eventos (`DeliveryStatusChanged`)**:
  - `orders`: actualiza `SubOrder.status` (`PICKED_UP`/`IN_TRANSIT` → `IN_DELIVERY`, `DELIVERED` → `COMPLETED`, `FAILED` terminal tras 3 intentos → `CANCELLED` + retorno de stock en `inventory` + reembolso en `payments-core`).
  - `pos`: actualiza el estado de entrega de la venta POS y dispara alerta/reintegro si `FAILED` terminal.
  - `notifications`: avisa al repartidor (nueva asignación), al cliente (en camino, llegó, entregado o intento fallido, con link `/track/<token>` y código de 6 dígitos) y a la tienda (entrega completada, intento fallido o bloqueo de código).
  - `analytics-bi`: proyecta métricas de entregas completadas, tiempos de entrega y tasa de fallos por comercio, sucursal y repartidor.

## 8. Configuración
`LOGISTICS_GRPC_ADDR`, `DATABASE_URL`, `NATS_URL`, `GEOLOCATION_ADDR`, `IDENTITY_ADDR`, `OBJECT_STORAGE_*`.

## 9. Observabilidad
`pp_deliveries_total{status,source_type}`, `pp_delivery_duration_seconds`, `pp_delivery_failed_attempts_total{reason}`, `pp_delivery_needs_review_total`.

## 10. Seguridad
- Dirección exacta y teléfono del destinatario visibles para el repartidor únicamente mientras la entrega está activa (`ASSIGNED`..`ARRIVED`).
- El código de entrega de 6 dígitos se almacena como hash (`delivery_code_hash`) en la tabla principal y solo se revela al cliente comprador autenticado (`GetCustomerDelivery`) y en la notificación transaccional enviada al destinatario.
- Enlace público (`/track/{token}`) sin PII del comprador y con ubicación redondeada a ~100 m.

## 11. Pruebas de aceptación
1. Entrega completa de un sub-pedido (`orders`) y de una venta de tienda (`pos`) con escaneo de paquete y código de 6 dígitos correcto → `DELIVERED` y evento `DeliveryStatusChanged`.
2. Tercer intento fallido → `FAILED` terminal, evento emitido con `failed_attempts=3` y datos de contacto ocultos al repartidor.
3. Asignación a repartidor con licencia o póliza vencida → rechazado con `DRIVER_DOCS_EXPIRED`.
4. Entrega con `age_restricted=true` sin documento de mayor de 18 años → rechazado con `AGE_REQUIREMENT`.
5. Enlace público y vista de cliente nunca exponen teléfono del otro actor ni dirección completa en público.

## 12. Plan
F18.1 repartidores/transportistas (con documentos N-LOG-03 y vínculo N-LAB-16) → F18.2 entregas, cotización por zona y estados → F18.3 asignación (manual + cercanía en turno) → F18.4 prueba de entrega y verificación de edad → F18.5 seguimiento público, vista de cliente y stream → F18.6 integración `orders` + `pos` + página pública en `web` → F18.7 pantallas Flutter (despacho de tienda, app de repartidor y seguimiento del cliente).
