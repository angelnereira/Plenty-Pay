# Estándares de datos

## 1. Propiedad
- **Cada tabla pertenece a exactamente un contenedor**: esquema PostgreSQL propio (`identity`, `ledger`, `payments`, `settlement`, `fiscal`, `catalog`, `orders`, `inventory`, `pos`, `logistics`, `geo`, `payroll`, `notifications`, `analytics`, `security`, `infra`) y **rol de BD propio** (`<esquema>_svc`) con `GRANT` solo sobre su esquema (ADR 0014).
- **Ningún contenedor lee ni escribe tablas de otro**, ni "solo lectura": se pide por gRPC o se consume un evento (ADR 0002).
- `ledger` es el único con `INSERT` sobre `ledger.*`; su rol no tiene `UPDATE`/`DELETE` sobre `ledger_entries` y solo la transición controlada de estado sobre `ledger_transactions` (`ledger/SPEC.md`).

## 2. Identificadores (ADR 0013)
- **UUIDv7 generado por la aplicación** (ordenable, no enumerable, existe antes del INSERT → idempotencia). Go `uuid.NewV7()`, Rust `uuid::Uuid::now_v7()` (detrás del trait `IdGen`). Columna `uuid` nativa. Con PostgreSQL ≥ 18, `DEFAULT uuidv7()` como respaldo.
- Códigos públicos (terminales, seguimiento, invitaciones, reset) **no son UUID**: aleatorios ≥ 128 bits (`crypto/rand`) en base64url, guardados **hasheados** (SHA-256) cuando otorgan acceso (seguimiento, reset, invitación); el código de terminal se guarda en claro porque es un identificador público, no una credencial.
- Nunca se exponen enteros secuenciales.

## 3. Dinero, cantidades y tiempo (reglas absolutas)
| Qué | Tipo SQL | Notas |
|---|---|---|
| Dinero | `bigint` (unidad menor) + `currency char(3)` | prohibido `numeric` con decimales, `float`, `money` |
| Cantidad de inventario | `bigint` (milésimas) | |
| Tasas | `integer` (bps) | 700 = 7,00 % |
| Instante | `timestamptz` (UTC) | `created_at`, `updated_at` en toda tabla mutable |
| Fecha de negocio | `date` | en `America/Panama` (UTC−5, sin horario de verano) |
| Texto | `text` + `CHECK (char_length(...) <= N)` | límites explícitos |
| Estados | `text` + `CHECK (status IN (...))` | valores 1:1 con los enums del `.proto` (sin prefijo) |
| JSON | `jsonb` | solo datos realmente variables; nunca campos que se filtran o unen |

**Redondeo**: enteros *half-up* (`(v*bps + 5000) / 10000` para v ≥ 0) con residuo asignado a una parte designada, de modo que las sumas son **exactas** (`domain-model.md` §4, con vectores de prueba). Nunca coma flotante con dinero, ni "temporalmente".

## 4. Multi-tenencia (ADR 0014)
- Toda tabla de negocio: `tenant_id uuid NOT NULL` (salvo tablas globales de plataforma documentadas) y **todo índice relevante empieza por `tenant_id`**.
- Toda consulta filtra por el `x-pp-tenant-id` del contexto. **Defensa en profundidad con RLS**:
```sql
ALTER TABLE t ENABLE ROW LEVEL SECURITY;
ALTER TABLE t FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON t
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
  y el servicio ejecuta `SET LOCAL app.tenant_id = '<uuid>'` al inicio de cada transacción. Operaciones de plataforma (jobs globales) usan un rol con `BYPASSRLS` **separado**, solo en jobs auditados.
- Prueba estándar por contenedor: sin el filtro de la aplicación, RLS impide leer/escribir filas de otro tenant.
- El **marketplace público** se sirve desde vistas/tablas de lectura explícitas; nunca relajando RLS en tablas base.

## 5. Migraciones
- SQL puro en `<contenedor>/migrations/NNNN_descripcion.up.sql` (4 dígitos, orden estricto), **solo hacia adelante**, con `golang-migrate` (Go) o `sqlx migrate` (Rust). El contenedor **no** migra al arrancar en producción: un Job `migrate-<contenedor>` las aplica antes del despliegue (`delivery-pipeline.md` §4).
- **Expand/contract**: añadir compatible → migrar código → retirar en un despliegue posterior, de modo que la versión N−1 del servicio funcione con el esquema N (*rolling updates*).
- Prohibido: `DROP` en el mismo cambio que deja de usar algo, bloqueos largos (usar `CREATE INDEX CONCURRENTLY`, migraciones en lotes), datos de prueba.
- Toda migración trae su prueba contra **PostgreSQL real** (modelo: `scripts/ledger-tests`, 27 casos sobre PGlite).
- **Semillas** (roles de sistema, cuentas de plataforma, plantillas) = migraciones idempotentes (`INSERT ... ON CONFLICT DO NOTHING`).

## 6. Tablas estándar (todo contenedor con mutaciones reintentables o eventos)
```sql
CREATE TABLE idempotency_keys (
  tenant_id     uuid        NOT NULL,      -- '00000000-0000-0000-0000-000000000000' si no hay tenant
  rpc           text        NOT NULL,
  key           text        NOT NULL,
  request_hash  bytea       NOT NULL,      -- SHA-256 del request canónico (proto serializado determinista)
  response      bytea,                     -- NULL mientras corre
  resource_id   uuid,
  state         text        NOT NULL CHECK (state IN ('IN_PROGRESS','DONE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rpc, key)
);
CREATE TABLE outbox (                      -- events-and-messaging.md §4
  id            uuid PRIMARY KEY,          -- = event_id del sobre
  event_type    text        NOT NULL,
  aggregate_id  uuid        NOT NULL,
  tenant_id     uuid,
  payload       bytea       NOT NULL,      -- EventEnvelope serializado
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX outbox_pending ON outbox (created_at) WHERE published_at IS NULL;
CREATE TABLE processed_events (            -- consumidores idempotentes
  consumer      text        NOT NULL,
  event_id      uuid        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);
```
Purga por job del contenedor: `idempotency_keys` > 72 h, `outbox` publicado > 7 d, `processed_events` > 14 d.

## 7. Concurrencia
- **Bloqueo optimista** (`version integer`) en agregados con escrituras concurrentes: `UPDATE ... WHERE id=$1 AND version=$2` — 0 filas ⇒ `ABORTED`.
- Pesimista (`SELECT ... FOR UPDATE`) solo en secciones cortas justificadas en el SPEC (folios fiscales, saldo de wallet, cuentas del ledger).
- Aislamiento por defecto `READ COMMITTED`; el ledger serializa por cuenta con bloqueos explícitos y orden determinista de bloqueo (evita *deadlocks*): siempre en orden ascendente de `account_id`.
- **Una transacción de BD nunca abarca una llamada de red** a otro contenedor ni a un riel externo.

## 8. Retención, PII y borrado
- Cédulas, cuentas destino, plantillas biométricas, credenciales: **cifradas con `security.Encrypt`** (`bytea` + `key_version`), nunca en claro ni en logs.
- **Nada financiero se borra** (ledger, pagos, facturas, auditoría). "Eliminar" un producto/usuario = `status`/`active = false`.
- Retención orientativa (a confirmar con asesoría legal, `docs/open-questions.md` Q-08): fiscal y contable ≥ 5 años; auditoría ≥ 5 años; geolocalización detallada ≤ 90 días (agregados más tiempo); intentos de login ≤ 12 meses.
- Respaldos cifrados con restauración probada trimestralmente (Fases 6, 29, 30).

## 9. SQL vs NoSQL (ADR 0008)
"¿Cuadra el dinero / se rompe algo si dos escriben a la vez?" → PostgreSQL. "Atributos variables de miles de categorías" o "eventos de altísimo volumen sin transacciones cruzadas" → ScyllaDB. En la duda, PostgreSQL. Ninguna entidad tiene dos fuentes de verdad.

## 10. Rendimiento
- Índices declarados en el SPEC de cada tabla, comenzando por `tenant_id`; toda consulta de listado usa **keyset pagination** (`WHERE (created_at, id) < ($1,$2) ORDER BY created_at DESC, id DESC LIMIT n`).
- Tablas de alto volumen (`ledger_entries`, `payment_attempts`, `stock_movements`, `attendance_records`, `geo.locations`, `outbox`) **particionadas por rango de fecha** (mensual) desde su creación.
- `pg_stat_statements` habilitado; consultas > 100 ms p95 se revisan antes de cerrar la fase.
