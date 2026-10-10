# SPEC — geolocation

## 1. Responsabilidad
**Hace**: ingesta de ubicaciones de sujetos (repartidores, empleados en marcaje, dispositivos), última ubicación, trayectorias, observación en vivo, búsqueda de cercanos, geocercas y detección de cruce, utilidades (distancia, punto dentro de polígono).
**No hace**: lógica de entregas (logistics), reglas de marcaje (payroll). No guarda ubicaciones de clientes finales salvo consentimiento explícito para seguimiento de su pedido (no requerido en MVP).

## 2. Ficha
Go · 50069 · `geolocation.proto` · PostgreSQL esquema `geo` (PostGIS) para geocercas y última posición; **ScyllaDB** keyspace `geo_tracks` para series · Fase F14 · Capa L2 (hoja).

## 3. Modelo de datos
```sql
CREATE TABLE geo.last_locations (subject_id text PRIMARY KEY, tenant_id uuid NOT NULL, point geography(Point) NOT NULL,
  accuracy_m real, speed_mps real, heading real, recorded_at timestamptz NOT NULL);
CREATE INDEX last_locations_gist ON geo.last_locations USING gist (point);
CREATE TABLE geo.geofences (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name text NOT NULL, kind text NOT NULL, -- CIRCLE|POLYGON
  area geography(Polygon) NOT NULL, purpose text NOT NULL, active boolean NOT NULL DEFAULT true);  -- BRANCH|DELIVERY_ZONE|ATTENDANCE
CREATE INDEX geofences_gist ON geo.geofences USING gist (area);
CREATE TABLE geo.subject_fence_state (subject_id text, geofence_id uuid, inside boolean NOT NULL, changed_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, geofence_id));
```
Scylla: `geo_tracks.points ((tenant_id, subject_id, day), recorded_at) WITH default_time_to_live = 7776000` (90 días).

## 4. RPCs
| RPC | Llamador / permiso | Comportamiento |
|---|---|---|
| IngestLocations (stream) | gateway (`logistics:deliver` o `payroll:attendance:record`) | lotes ≤ 100 pings; descarta precisión > 100 m y saltos imposibles (> 70 m/s); actualiza última posición; detecta cruces de geocerca |
| GetLastLocation / GetTrack | logistics, payroll, gateway (`logistics:read`) | track por rango ≤ 24 h |
| WatchSubject (stream) | gateway / logistics | emite cada nueva ubicación aceptada |
| FindNearby | logistics | sujetos del tenant dentro de radio, ordenados por distancia, solo activos en últimos 5 min |
| IsInside | payroll, logistics | punto dentro de geocerca (con tolerancia = precisión reportada) |
| UpsertGeofence / ListGeofences / DeleteGeofence | `logistics:geofence:manage` | círculo (centro+radio 20 m–50 km) o polígono ≤ 200 vértices |

## 5. Reglas
- **R1** `subject_id` = `user:<uuid>` o `device:<uuid>`; siempre con tenant.
- **R2** Retención: series 90 días (TTL); última posición se borra 30 días sin actualización.
- **R3** Cruce de geocerca: cambio de estado inside/outside con histéresis de 2 pings consecutivos → `GeofenceCrossed`.
- **R4** Frecuencia aceptada: ≥ 5 s entre pings por sujeto (el exceso se descarta).
- **R5** Ubicaciones solo de sujetos en turno/entrega activa (el cliente Flutter deja de enviar fuera de turno; el servidor rechaza si el gateway indica que no hay entrega/turno activo — F18).

## 6. Eventos
Publica `GeofenceCrossed`.

## 11. Pruebas de aceptación
10 000 pings/s sostenidos en carga (F29) con p95 de ingesta ≤ 50 ms; FindNearby correcto contra cálculo haversine de referencia.

## 12. Plan
F14.1 geocercas PostGIS → F14.2 ingesta + última posición → F14.3 Scylla tracks → F14.4 FindNearby/IsInside → F14.5 cruces + eventos → F14.6 WatchSubject → F14.7 editor de geocercas en Flutter.
