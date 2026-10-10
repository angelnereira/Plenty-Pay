# SPEC — logistics

## 1. Responsabilidad
**Hace**: transportistas y repartidores (propios o externos), entregas con puntos de control, asignación (manual y sugerida por cercanía), prueba de entrega, reintentos, enlace público de seguimiento sin cuenta, stream de seguimiento.
**No hace**: almacenar series de ubicación (geolocation), cobrar envíos (orders incluye el envío en el pago).

## 2. Ficha
Go · 50068 · `logistics.proto` · esquema `logistics` · object-storage (fotos de prueba) · Fase F18 · Capa L3.

## 3. Modelo de datos
```sql
CREATE TABLE logistics.carriers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, kind text NOT NULL, -- OWN|EXTERNAL
  contact jsonb, active boolean NOT NULL DEFAULT true);
CREATE TABLE logistics.drivers (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, carrier_id uuid,
  vehicle text, plate text, active boolean NOT NULL DEFAULT true, UNIQUE (tenant_id, user_id));
CREATE TABLE logistics.deliveries (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, status smallint NOT NULL, source_type text NOT NULL, source_id text NOT NULL,
  pickup jsonb NOT NULL, dropoff jsonb NOT NULL,         -- Address + GeoPoint + contacto (visible al repartidor solo en ruta)
  driver_id uuid, attempts smallint NOT NULL DEFAULT 0, proof jsonb,   -- {kind: CODE|PHOTO|SIGNATURE, code_hash, object_key}
  delivery_code_hash bytea NOT NULL,                     -- código de 6 dígitos que da el cliente
  tracking_token text NOT NULL UNIQUE,                   -- ≥ 22 chars base64url
  eta timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, source_type, source_id)
);
CREATE TABLE logistics.checkpoints (id uuid PRIMARY KEY, delivery_id uuid NOT NULL, status smallint NOT NULL,
  location geography(Point), scanned_code text, note text, actor_user_id uuid NOT NULL, created_at timestamptz NOT NULL);
-- + outbox, processed_events, idempotency_keys
```

## 4. RPCs
| RPC | Permiso | Comportamiento clave |
|---|---|---|
| UpsertCarrier / ListCarriers / UpsertDriver / ListDrivers | `logistics:manage` / `logistics:read` | repartidor debe ser usuario del tenant con permiso `logistics:deliver` |
| CreateDelivery | `logistics:manage` / orders | genera `tracking_token` y código de entrega (enviado al cliente por notifications) |
| AssignDelivery | `logistics:manage` | manual o `auto=true` → el repartidor activo más cercano (geolocation.FindNearby) |
| RecordCheckpoint | `logistics:deliver` (repartidor asignado) | transiciones §8.11; PICKED_UP exige escanear QR del paquete; DELIVERED exige prueba |
| CancelDelivery | `logistics:manage` | solo PENDING/ASSIGNED |
| GetDelivery / ListDeliveries / ListMyDeliveries | `logistics:read` / `logistics:deliver` | |
| GetPublicTracking | público con token | estado, ETA, ubicación aproximada (redondeada a ~100 m) solo durante IN_TRANSIT; sin nombres completos ni teléfonos |
| StreamDelivery | comercio, repartidor, cliente del pedido (vía gateway) | eventos de estado + ubicación |

## 5. Reglas
- **R1** Transiciones de domain-model §8.11; máximo 3 intentos; luego FAILED terminal y retorno a tienda.
- **R2** DELIVERED requiere prueba: código del cliente (comparado contra hash), foto o firma; código incorrecto 5 veces → bloqueo y aviso al comercio.
- **R3** Cada checkpoint registra ubicación del repartidor; si está a > 300 m del destino al marcar ARRIVED/DELIVERED → `needs_review` (no bloquea).
- **R4** Datos de contacto del cliente visibles para el repartidor solo entre ASSIGNED y DELIVERED.
- **R5** Seguimiento público: token no adivinable, expira 72 h después de terminal; rate limit en gateway.
- **R6** ETA = distancia/velocidad media de geolocation (F18 simple; F21 mejora con históricos).
- **R7** Evento `DeliveryStatusChanged` en cada transición.

## 6. Eventos
Publica `DeliveryStatusChanged`. Consume `GeofenceCrossed` (ARRIVED automático opcional si el repartidor entra a la geocerca del destino).

## 7. Dependencias
geolocation (FindNearby, GetLastLocation, IsInside, WatchSubject; 500 ms), identity (contacto del repartidor).

## 11. Pruebas de aceptación
Entrega completa con código correcto; tercer intento fallido → FAILED terminal; enlace público no revela teléfonos.

## 12. Plan
F18.1 repartidores/transportistas → F18.2 entregas y estados → F18.3 asignación (manual + cercanía) → F18.4 prueba de entrega → F18.5 seguimiento público + stream → F18.6 integración orders + página pública en `web` → F18.7 pantallas Flutter (despacho y app de repartidor).
