# SPEC — infra-management

## 1. Responsabilidad
**Hace**: feature flags (globales, por tenant, por porcentaje), configuración dinámica (límites de montos, umbrales, feriados, rate limits), modo mantenimiento, configuración de cliente para la app (versión mínima, URLs, flags visibles), inventario de servicios y su versión/salud (consola de plataforma).
**No hace**: desplegar (CI/Argo CD), métricas (observability), secretos (security).

## 2. Ficha
Go · 50074 · `infra_management.proto` · esquema `infra` (fuente de verdad y auditoría) + NATS KV `pp_flags`, `pp_config` (distribución) · Fase F05 · Capa L1.

## 3. Modelo de datos
`infra.flags (key text PK, description, default_value jsonb, rules jsonb, updated_by, updated_at, version)`; `infra.config (key text PK, value jsonb, schema jsonb, updated_by, updated_at, version)`; `infra.maintenance (id, active, message, starts_at, ends_at, scope)`; historial `infra.changes` (append-only). Reglas de flag: lista ordenada `[{tenant_ids:[...]} | {percentage: n, salt} | {platform: "ios"}] → value`.

## 4. RPCs
| RPC | Permiso | Comportamiento |
|---|---|---|
| EvaluateFlags | servicios (con contexto tenant/usuario) | evaluación local desde KV en los servicios; este RPC es para clientes sin KV |
| UpsertFlag / ListFlags | `platform:flags:manage` | escribe BD + KV en la misma operación lógica (BD primero, KV desde outbox) |
| GetConfig / SetConfig | servicios / `platform:flags:manage` | valores validados contra `schema` (JSON Schema) |
| SetMaintenanceMode / GetMaintenanceState | `platform:flags:manage` / público vía gateway | |
| ListServices | `platform:support` | consulta `/healthz/ready` y `pp_build_info` de cada servicio conocido (lista de `service-dependencies.md`) |
| GetClientConfig | público | `{min_app_version, latest_app_version, api_base_url, realtime_url, features:{...}, maintenance}` sin datos sensibles |

## 5. Reglas
- **Cumplimiento normativo** (`docs/compliance/regulatory-framework.md`): este contenedor implementa el principio P1 (parámetros `legal.pa.*` con vigencia y doble aprobación) y N-AML-01. Los valores legales se leen de los parámetros `legal.pa.*` de infra-management vigentes en la fecha del hecho, nunca de constantes en código.
- **R1** Cada servicio lee flags/config de NATS KV con caché local y **último valor conocido** si KV cae.
- **R2** Flags iniciales obligatorios: `rail.<rail>.enabled`, `payments.enabled` (por tenant), `marketplace.enabled`, `pos.offline.enabled`, `analytics.ask.enabled`, `signup.business.enabled`.
- **R3** Configs iniciales: `limits.payment.max_minor` (1 000 000), `limits.wallet.max_balance_minor` (500 000), `stepup.threshold_minor` (10 000), `holidays.pa` (lista de fechas), `ratelimits.*`.
- **R4** Todo cambio queda en `infra.changes` + `AuditRecorded` con antes/después.
- **R5** Evaluación por porcentaje determinista: `hash(salt + subject) mod 100`.
- **R6** Pausa de cobros por tenant o riel aplicada en < 5 min (propagación KV < 5 s).

## 11. Pruebas de aceptación
Desactivar `rail.yappy.enabled` → payments-core rechaza Yappy en ≤ 5 s; con NATS caído, servicios siguen con el último valor.

## 12. Plan
F05.7 flags + KV → F05.8 config con esquema → F05.9 GetClientConfig + mantenimiento → F27 ListServices sobre Kubernetes.
