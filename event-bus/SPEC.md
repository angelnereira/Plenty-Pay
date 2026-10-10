# SPEC — event-bus

## 1. Responsabilidad
**NATS con JetStream** (Apache 2.0): transporte de eventos de dominio (outbox → streams) y almacén KV para flags/config/rate limits (ADR 0012).

## 2. Ficha
Puertos 4222 (clientes), 8222 (monitoreo, interno), 6222 (cluster). Red `services` + `data`. Compose: 1 nodo con JetStream en volumen. Kubernetes: 3 nodos (chart oficial). Fase F07. Capa L0.

## 3. Configuración versionada
```
event-bus/
├── nats.conf          # jetstream { store_dir, max_mem, max_file }, cuentas y permisos por servicio
├── streams/*.json     # definición de streams (aplicada por job `nats stream add --config`)
└── kv/*.json          # buckets KV: pp_flags, pp_config, pp_ratelimit (TTL 1 min)
```
| Stream | Subjects | Retención | Réplicas (prod) |
|---|---|---|---|
| `PP_IDENTITY` | `pp.identity.>` | 7 días | 3 |
| `PP_PAYMENTS` | `pp.payments.>` | 30 días | 3 |
| `PP_LEDGER` | `pp.ledger.>` | 30 días | 3 |
| `PP_SETTLEMENT` | `pp.settlement.>` | 30 días | 3 |
| `PP_FISCAL` | `pp.fiscal.>` | 30 días | 3 |
| `PP_COMMERCE` | `pp.catalog.>`, `pp.inventory.>`, `pp.orders.>`, `pp.pos.>` | 14 días | 3 |
| `PP_LOGISTICS` | `pp.logistics.>`, `pp.geo.>` | 7 días | 3 |
| `PP_PAYROLL` | `pp.payroll.>` | 30 días | 3 |
| `PP_AUDIT` | `pp.audit.>` | 30 días (security persiste) | 3 |
| `PP_ANALYTICS` | `pp.analytics.>` | 7 días | 3 |

## 4. Reglas
- **R1** Permisos por usuario NATS: cada servicio solo publica en `pp.<su-dominio>.>` y `pp.audit.<su-nombre>.>`; suscribe solo a lo que consume (`events-and-messaging.md` §7).
- **R2** Consumidores durables con nombre `<servicio>-<propósito>`, `ack_wait` 30 s, `max_deliver` 10, luego DLQ (`pp.dlq.<servicio>`) con alerta.
- **R3** TLS y autenticación por nkeys en prod.

## 5. Plan
F07.4 nodo + JetStream → F07.5 streams y KV como código → F07.6 cuentas/permisos → F07.7 exporter y alertas de lag/DLQ.
