# network-contracts

**La única carpeta que otros contenedores SÍ pueden leer** — contiene interfaces, nunca implementación (ADR 0004).
Ningún contenedor importa código de otro: todos hablan contra los `.proto` de `proto/`.

| Archivo | Servicio | Dueño |
|---|---|---|
| `common.proto` | tipos compartidos (`Money`, `PageRequest`, `Reference`, `PaymentRail`, ...) | — |
| `events.proto` | `EventEnvelope` (sobre de eventos del bus) | — |
| `identity.proto` | `Identity` | identity |
| `ledger.proto` | `Ledger` | ledger |
| `payments.proto` | `Payments` | payments-core |
| `settlement.proto` | `Settlement` | settlement |
| `fiscal_invoicing.proto` | `FiscalInvoicing` | fiscal-invoicing |
| `catalog.proto` | `Catalog` | catalog |
| `orders.proto` | `Orders` | orders |
| `inventory.proto` | `Inventory` | inventory |
| `pos.proto` | `Pos` | pos |
| `logistics.proto` | `Logistics` | logistics |
| `geolocation.proto` | `Geolocation` | geolocation |
| `payroll.proto` | `Payroll` | payroll |
| `notifications.proto` | `Notifications` | notifications |
| `analytics.proto` | `Analytics` | analytics-bi |
| `security.proto` | `Security` | security |
| `infra_management.proto` | `InfraManagement` | infra-management |

Cada `.proto` define, al final, los **mensajes de eventos** que su dueño publica (`docs/standards/events-and-messaging.md` §7).

## Cobertura SPEC ↔ proto (F03.1)

Revisión RPC por RPC de los 231 RPC contra la sección §4 del SPEC de cada contenedor dueño.
Tabla completa (una fila por RPC) y los 53 hallazgos con el paso que cierra cada uno:
[`docs/architecture/rpc-coverage.md`](../docs/architecture/rpc-coverage.md).

| Contenedor | RPC | Con fila en §4 | Permiso documentado | Con observaciones |
|---|---|---|---|---|
| identity | 30 | 30 | 30 | 18 |
| security | 13 | 13 | 13 | 11 |
| infra-management | 9 | 9 | 9 | 8 |
| ledger | 11 | 11 | 11 | 2 |
| payments-core | 17 | 17 | 17 | 7 |
| settlement | 11 | 11 | 11 | 6 |
| fiscal-invoicing | 13 | 13 | 13 | 3 |
| orders | 13 | 13 | 13 | 8 |
| pos | 18 | 18 | 18 | 9 |
| catalog | 15 | 15 | 15 | 11 |
| inventory | 17 | 17 | 17 | 6 |
| logistics | 13 | 13 | 13 | 4 |
| notifications | 13 | 13 | 13 | 8 |
| payroll | 16 | 16 | 16 | 8 |
| geolocation | 9 | 9 | 9 | 2 |
| analytics-bi | 14 | 13 | 14 | 6 |
| **Total** | **232** | **231** | **232** | **117** |

Sin huecos: **no falta ningún RPC** por documentar ni por declarar en el contrato (`analytics.AskQuestion`
está documentado y se agrega al `.proto` en F03.2).

## Reglas
- Convenciones completas: `docs/standards/grpc-conventions.md`.
- **Solo cambios aditivos** una vez publicado (nunca reutilizar ni renumerar campos; `reserved` al retirar). Un cambio incompatible exige `v2`.
- `consumers.txt` declara quién consume qué; `../scripts/sync-protos.sh` genera (Go) o copia (Rust) dentro de cada contenedor y `--check` falla en CI si algo quedó desactualizado.
- Verificación mínima obligatoria tras cualquier cambio: `protoc -I proto --descriptor_set_out=/dev/null proto/*.proto` (todos compilan juntos) — en CI además `buf lint` y `buf breaking`.

## Estado
18 archivos, 233 RPC (231 + `Payments.PostMemoEntry` y `Analytics.AskQuestion`) más el evento
`Analytics.AlertTriggered`. Todos compilan juntos con `protoc 29.3`. Implementados de punta a punta:
`Identity.{Register,Login,ValidateToken,GetUserPermissions,RefreshToken}`. El resto es contrato
objetivo, cada uno con su `SPEC.md`.
