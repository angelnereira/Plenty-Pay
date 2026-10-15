# Runbook — Recuperación a un Punto en el Tiempo (PITR) de PostgreSQL (F06.5, R3)

Este documento describe la arquitectura, la estrategia de respaldo y el procedimiento operativo para la recuperación a un punto en el tiempo (*Point-In-Time-Recovery*, PITR) de **PostgreSQL 16 + PostGIS** en PlentyPay, en cumplimiento de la regla **R3** de [`postgres-db/SPEC.md`](../../postgres-db/SPEC.md) (RPO $\le$ 5 min, RTO $\le$ 15 min).

---

## 1. Arquitectura de Respaldo y Garantía de RPO

| Componente | Mecanismo | Frecuencia / Modo | Ubicación |
|---|---|---|---|
| **Respaldo Base** | `pg_basebackup -Ft -z -Xs` | Diario (02:00 UTC) | `/var/lib/postgresql/backup/` (local/compose) / Object storage (prod) |
| **Archivado WAL** | `archive_mode = on` + `archive_command` | Continuo en tiempo real | `/var/lib/postgresql/wal_archive/` (local) / Bucket S3/Garage (prod) |
| **Pooler** | PgBouncer (`pool_mode = transaction`) | Continuo | Puerto 6432 |
| **Monitoreo** | `postgres-exporter` + alertas Prometheus | Cada 15s | `PostgresWALArchivingFailed`, `PostgresDown` |

> [!IMPORTANT]
> **RPO $\le$ 5 min:** Al combinar el respaldo base con el archivado continuo de los segmentos WAL generados desde el momento del respaldo, es posible recuperar el estado exacto de la base de datos hasta cualquier milisegundo previo a un incidente.

---

## 2. Cuándo Ejecutar un PITR

Se debe ejecutar un procedimiento PITR en los siguientes escenarios críticos:
1. **Borrado o modificación accidental de datos:** Ejecución involuntaria de `DROP TABLE`, `TRUNCATE` o `DELETE` sin condición `WHERE` en cualquier esquema de servicio.
2. **Corrupción lógica o ataque:** Inyección de datos anómalos o fallo catastrófico en un job batch.
3. **Prueba periódica de resiliencia:** Validación trimestral obligatoria de recuperación de desastres (F30).

---

## 3. Procedimiento Operativo Paso a Paso

### Paso 1: Determinar el Punto Objetivo de Recuperación (`recovery_target`)

Identificar la marca de tiempo exacta (en UTC) o el nombre del *restore point* anterior al evento destructivo.
Ejemplo:
- Timestamp: `'2026-10-13 14:30:00.000000+00'`
- O un restore point creado preventivamente: `'pitr_target_point'`

### Paso 2: Seleccionar el Respaldo Base Previo

Elegir el último respaldo base generado **antes** del momento del incidente:
```bash
ls -td /var/lib/postgresql/backup/base_backup_* | head -n 1
```
Verificar la integridad del archivo mediante el checksum registrado en `metadata.json`:
```bash
sha256sum base.tar.gz
cat metadata.json | jq .sha256
```

### Paso 3: Extraer el Respaldo Base en el Directorio Objetivo

Detener la base de datos o preparar un directorio aislado de recuperación (por ejemplo `/var/lib/postgresql/recovery_data`):
```bash
mkdir -p /var/lib/postgresql/recovery_data
chmod 0700 /var/lib/postgresql/recovery_data
chown postgres:postgres /var/lib/postgresql/recovery_data

# Extraer el sistema de archivos base
tar -xzf /var/lib/postgresql/backup/<BACKUP_NAME>/base.tar.gz -C /var/lib/postgresql/recovery_data/

# Extraer el WAL del respaldo en pg_wal
mkdir -p /var/lib/postgresql/recovery_data/pg_wal
tar -xzf /var/lib/postgresql/backup/<BACKUP_NAME>/pg_wal.tar.gz -C /var/lib/postgresql/recovery_data/pg_wal/
```

### Paso 4: Configurar los Parámetros de Recuperación

1. Crear la señal de recuperación en la raíz del nuevo `$PGDATA`:
```bash
touch /var/lib/postgresql/recovery_data/recovery.signal
chown postgres:postgres /var/lib/postgresql/recovery_data/recovery.signal
```

2. Configurar `postgresql.auto.conf` o `postgresql.conf`:
```ini
# Comando para que PostgreSQL tome los WAL archivados
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'

# Punto objetivo en el tiempo (UTC) o por nombre
recovery_target_time = '2026-10-13 14:30:00 UTC'
# O: recovery_target_name = 'pitr_target_point'

# Promover la base de datos a lectura/escritura al alcanzar el objetivo
recovery_target_action = 'promote'
```

### Paso 5: Iniciar PostgreSQL y Monitorear la Reproducción de WAL

Iniciar PostgreSQL con el nuevo directorio de datos:
```bash
postgres -D /var/lib/postgresql/recovery_data -c config_file=/etc/postgresql/postgresql.conf
```
En los logs se observará:
- `starting point-in-time recovery to 2026-10-13 14:30:00+00`
- `restored log file "..." from archive`
- `recovery stopping at restore point ... or target time ...`
- `redo done at ...`
- `archive recovery complete`
- `database system is ready to accept connections`

### Paso 6: Verificación y Puesta en Producción

1. Conectarse a la base de datos y verificar que los datos hasta el momento del incidente están intactos:
```bash
psql -h localhost -U readonly_ops -d plentypay -c "SELECT count(*) FROM identity.users;"
```
2. Confirmar que las operaciones posteriores al incidente no existen.
3. Si la recuperación se realizó en una instancia secundaria, conmutar el DNS o la configuración de conexión de PgBouncer hacia la nueva instancia.

---

## 4. Prueba Automatizada de Verificación

La verificación automatizada de PITR se ejecuta localmente mediante:
```bash
./postgres-db/test/test_pitr.sh
```
El script inserta datos antes del respaldo, toma el respaldo base, inserta un registro en un punto de restauración, simula un incidente destructivo con registros posteriores, recupera los datos mediante PITR y valida que los registros previos al objetivo fueron restaurados mientras que el incidente fue descartado.
