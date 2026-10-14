# event-bus

Eventos de dominio (outbox) y KV de flags/configuración. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | NATS 2.10 con JetStream (Apache 2.0) |
| Puerto | 4222 (clientes), 8222 (monitoreo interno), 6222 (cluster) |
| Fase del roadmap | F07 (F07.4, F07.5, F07.6, F07.7) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Nodo + JetStream | ✅ | `nats-server` 2.10-alpine en Compose (fijado por digest), JetStream con `store_dir /data/jetstream/jetstream` y `max_mem 512MB` en volumen `nats-data`; healthcheck `nats rtt` en `:4222` |
| Streams como código | ✅ | 11 streams aplicados por `scripts/init-definitions.sh` desde `streams/*.json` (`PP_IDENTITY`, `PP_PAYMENTS`, `PP_LEDGER`, `PP_SETTLEMENT`, `PP_FISCAL`, `PP_COMMERCE`, `PP_LOGISTICS`, `PP_PAYROLL`, `PP_AUDIT`, `PP_ANALYTICS`, `PP_DLQ`) |
| KV como código | ✅ | 3 buckets desde `kv/*.json`: `pp_flags` (historial 5), `pp_config` (historial 5), `pp_ratelimit` (TTL 1 min, historial 1) |
| Idempotencia | ✅ | `scripts/init-definitions.sh` reejecutable: detecta las 14 definiciones ya existentes y no recrea ninguna (fechas de creación inalteradas) |
| Permisos | ✅ | 16 usuarios por servicio en `nats.conf`: cada uno publica solo en `pp.<su-dominio>.>` y `pp.audit.<su-nombre>.>`; suscribe solo lo que consume (SPEC §4 R1) |
| Monitoreo | ✅ | `nats-exporter` (fijado por digest) scrapeado por Prometheus (job `nats`), 5 paneles NATS/JetStream en `pp-platform`, 4 alertas (`NatsDown`, `NatsDLQMessagesDetected`, `NatsConsumerLagHigh`, `NatsSlowConsumers`) con `runbook_url` |
| Persistencia | ✅ | Mensaje publicado sobrevive el reinicio del contenedor (verificado por secuencia con `nats stream get`) |
| Pruebas | ✅ | `./event-bus/test/` — 70 aserciones en verde (ver abajo) |

## Arranque local
Se levanta con el resto del sistema:
```bash
docker compose up -d event-bus      # aplica streams/KV al arrancar (entrypoint.sh)
```

## Pruebas
```bash
./event-bus/test/test_jetstream_persistence.sh   # F07.4 — stream sobrevive reinicio (10/10)
./event-bus/test/test_definitions.sh            # F07.5 — definiciones idempotentes (21/21)
./event-bus/test/test_permissions.sh            # F07.6 — permisos por servicio (27/27)
./event-bus/test/test_monitoring_alerts.sh      # F07.7 — exporter, métricas, alerta DLQ (12/12)
```

## Limitaciones conocidas
- **Contraseñas de desarrollo en texto**: `nats.conf` define usuarios/contraseñas ficticios (`*_nats_secret`) solo para Compose local. En producción se emiten **nkeys** y se exige TLS (SPEC §4 R3, F28).
- Compose corre 1 nodo con 1 réplica; producción (F27) despliega 3 nodos con 3 réplicas por stream según `SPEC.md` §3.
- Los consumidores durables con `max_deliver=10` → DLQ (SPEC §4 R2) los crea cada servicio al llegar a su fase; el patrón de referencia quedará en `ledger` (F10).
