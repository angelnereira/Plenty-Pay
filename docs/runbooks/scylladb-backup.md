# Runbook — Procedimiento de Respaldo y Restauración de ScyllaDB (F07.3, R3)

Este documento describe el procedimiento operativo de respaldo (*nodetool snapshot*) y restauración para **ScyllaDB** en PlentyPay, en cumplimiento de la regla **R3** de [`nosql-db/SPEC.md`](../../nosql-db/SPEC.md).

---

## 1. Estrategia de Respaldo

| Entorno | Mecanismo | Destino | Frecuencia |
|---|---|---|---|
| **Local / Compose** | `nodetool snapshot` + tarball comprimido | `/var/lib/scylla/backup/` | Script manual / programado |
| **Producción (K8s)** | **Scylla Manager** | Object Storage (Garage / S3) | Diario a las 03:00 UTC |

Keyspaces respaldados:
- `catalog_attrs` (atributos variables de productos)
- `geo_tracks` (series temporales de geolocalización)
- `analytics_events` (eventos crudos de analítica)

---

## 2. Procedimiento de Respaldo Manual

Ejecutar el script automatizado:
```bash
docker compose exec -T nosql-db /usr/local/bin/scripts/backup.sh
```

El script realiza los siguientes pasos:
1. `nodetool snapshot -t <tag> <keyspace>` para cada keyspace dueño.
2. Recolección de los directorios de snapshot de SSTables.
3. Empaquetado comprimido en `snapshot.tar.gz`.
4. Cálculo de checksum SHA-256 y generación de `metadata.json`.
5. Limpieza de snapshots temporales (`nodetool clearsnapshot`).

---

## 3. Procedimiento de Restauración

1. **Detener escrituras** en las tablas objetivo o utilizar un nodo de contingencia.
2. Extraer el archivo `snapshot.tar.gz` correspondiente a la fecha deseada:
```bash
tar -xzf /var/lib/scylla/backup/<TAG>/snapshot.tar.gz -C /tmp/restore_scylla/
```
3. Copiar las SSTables extraídas al directorio de datos de cada tabla:
```bash
cp /tmp/restore_scylla/<keyspace>/<table_dir>/* /var/lib/scylla/data/<keyspace>/<table_dir>/
```
4. Ejecutar `nodetool refresh <keyspace> <table>` para que ScyllaDB reconozca las nuevas SSTables inmediatamente sin necesidad de reiniciar el nodo:
```bash
nodetool refresh catalog_attrs product_attributes
nodetool refresh geo_tracks points
nodetool refresh analytics_events events
```
5. Verificar integridad con consultas CQL:
```bash
cqlsh -u cassandra -p cassandra -e "SELECT count(*) FROM geo_tracks.points;"
```
