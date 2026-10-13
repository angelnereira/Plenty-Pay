# nosql-db

Datos de alto volumen: atributos de catálogo, trayectorias, eventos analíticos. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | ScyllaDB 6.2 (AGPL-3.0 — ADR 0008) |
| Puerto | 9042 (CQL), 9180 (métricas Prometheus nativas) |
| Fase del roadmap | F07 (F07.1, F07.2, F07.3) |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Contenedor y arranque | ✅ | ScyllaDB 6.2 corriendo en Compose (`nosql-db`), healthcheck nativo con `cqlsh` en `:9042` |
| Roles y Keyspaces | ✅ | 3 keyspaces (`catalog_attrs`, `geo_tracks` con TTL 90 días, `analytics_events` con TTL 25 meses) y 3 roles (`catalog_svc`, `geo_svc`, `analytics_svc`) aislados |
| Monitoreo | ✅ | Prometheus recolectando `:9180`, alertas `ScyllaDBDown` y `ScyllaDBHighCacheUsage`, 5 paneles en Grafana (`pp-platform`) |
| Respaldos | ✅ | `/usr/local/bin/scripts/backup.sh` crea snapshots por keyspace, comprime en `tar.gz` y genera `metadata.json` con SHA-256 |
| Pruebas | ✅ | `./nosql-db/test/test_cql_isolation.sh` (14/14) y `./nosql-db/test/test_monitoring_and_backup.sh` (11/11) pasando |

## Arranque local
Se levanta automáticamente con Docker Compose en la red interna `data`:
```bash
docker compose up -d nosql-db
```

## Pruebas de integración
```bash
./nosql-db/test/test_cql_isolation.sh
./nosql-db/test/test_monitoring_and_backup.sh
```
