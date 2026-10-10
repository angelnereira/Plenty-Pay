# SPEC — nosql-db

## 1. Responsabilidad
**ScyllaDB** (compatible con Cassandra, licencia OSS — ver ADR 0008; fijar una versión publicada bajo licencia OSI en F07 y registrar la licencia en el README) para datos de alto volumen sin transacciones cruzadas.

## 2. Ficha
Puerto 9042 (CQL), red `data`. Compose: 1 nodo (`--smp 1 --memory 1G --developer-mode 1`). Kubernetes: Scylla Operator, 3 nodos, RF=3. Fase F07. Capa L0.

## 3. Keyspaces
| Keyspace | Dueño | Tablas | TTL |
|---|---|---|---|
| `catalog_attrs` | catalog | `product_attributes` | — |
| `geo_tracks` | geolocation | `points` | 90 días |
| `analytics_events` | analytics-bi | `events` | 25 meses |
Un rol CQL por dueño con permisos solo sobre su keyspace. Esquemas CQL versionados dentro de cada contenedor dueño (`<contenedor>/cql/NNNN_*.cql`), aplicados por su job de migración.

## 4. Reglas
- **R1** Diseño por consulta (partición acotada: ningún partition > 100 MB; claves con día/tenant).
- **R2** Consistencia `LOCAL_QUORUM` en prod; `ONE` permitido solo en ingestión de geo.
- **R3** Backups con Scylla Manager (prod) a object-storage.

## 5. Plan
F07.1 contenedor + healthcheck → F07.2 roles y keyspaces → F07.3 monitoreo y procedimiento de backup (Scylla Manager en F27).
