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

## Reglas
- Convenciones completas: `docs/standards/grpc-conventions.md`.
- **Solo cambios aditivos** una vez publicado (nunca reutilizar ni renumerar campos; `reserved` al retirar). Un cambio incompatible exige `v2`.
- `consumers.txt` declara quién consume qué; `../scripts/sync-protos.sh` genera (Go) o copia (Rust) dentro de cada contenedor y `--check` falla en CI si algo quedó desactualizado.
- Verificación mínima obligatoria tras cualquier cambio: `protoc -I proto --descriptor_set_out=/dev/null proto/*.proto` (todos compilan juntos) — en CI además `buf lint` y `buf breaking`.

## Estado
18 archivos, 231 RPC. Todos compilan juntos con `protoc 29.3`. Implementados de punta a punta: `Identity.{Register,Login,ValidateToken,GetUserPermissions,RefreshToken}`. El resto es contrato objetivo, cada uno con su `SPEC.md`.
