#!/usr/bin/env bash
# Test de Restauración a un Punto en el Tiempo (PITR) (F06.5, L4)
# Criterio: Restauración verificada reproduciendo WALs hasta un restore point exacto,
# comprobando que los datos previos al objetivo se restauran y los posteriores se descartan.
set -euo pipefail

PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected_exit="$2"
  shift 2
  set +e
  output="$("$@" 2>&1)"
  exit_code=$?
  set -e

  if [ "$exit_code" -eq "$expected_exit" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (código esperado: $expected_exit, obtenido: $exit_code)"
    echo "         Salida: $output"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Ejecutando prueba de Point-In-Time-Recovery (PITR) (F06.5) ==="

PG_PASS="postgres_dev_master_password_32ch"

# Limpieza inicial de procesos previos en puerto 5433
docker compose exec -T postgres-db sh -c "
  su-exec postgres pg_ctl stop -D /tmp/pitr_restore_data -m immediate >/dev/null 2>&1 || true
  rm -rf /tmp/pitr_restore_data /tmp/pitr_recovery.log
" >/dev/null 2>&1 || true

# Paso 1: Preparar tabla y estado previo al respaldo
echo "  [*] Preparando datos previos al respaldo base..."
docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -c "
  CREATE TABLE IF NOT EXISTS identity.pitr_audit (
    id serial PRIMARY KEY,
    note text NOT NULL,
    created_at timestamptz DEFAULT clock_timestamp()
  );
  TRUNCATE identity.pitr_audit;
  INSERT INTO identity.pitr_audit (note) VALUES ('record_1_pre_backup');
" >/dev/null

# Paso 2: Ejecutar respaldo base
echo "  [*] Ejecutando respaldo base..."
docker compose exec -T postgres-db /usr/local/bin/scripts/backup.sh >/dev/null
latest_backup=$(docker compose exec -T postgres-db sh -c "ls -td /var/lib/postgresql/backup/base_backup_* | head -n 1" | tr -d '\r')
echo "      Respaldo base generado: $latest_backup"

# Paso 3: Operación válida POST-RESPALDO y creación del restore point
echo "  [*] Insertando registro objetivo..."
docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -c "
  INSERT INTO identity.pitr_audit (note) VALUES ('record_2_target_valid');
" >/dev/null

echo "  [*] Creando punto de restauración 'pitr_gold_target'..."
docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -c "
  SELECT pg_create_restore_point('pitr_gold_target');
" >/dev/null

sleep 1

# Paso 4: Simular incidente catastrófico POSTERIOR al restore point
echo "  [*] Simulando incidente (inyección de registros corruptos posteriores al objetivo)..."
docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -c "
  INSERT INTO identity.pitr_audit (note) VALUES ('record_3_corrupted_disaster');
  INSERT INTO identity.pitr_audit (note) VALUES ('record_4_corrupted_disaster');
  SELECT pg_switch_wal();
" >/dev/null

# Verificar que en el primario actual hay 4 registros
current_count=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -t -c "SELECT count(*) FROM identity.pitr_audit;" | tr -d ' \r\n')
if [ "$current_count" -eq 4 ]; then
  echo "  [PASS] Primario actual tiene 4 registros (incluyendo los 2 del incidente)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Se esperaban 4 registros en primario, encontrados: $current_count"
  FAIL=$((FAIL + 1))
fi

# Paso 5: Preparar directorio de restauración PITR
echo "  [*] Extrayendo respaldo base y configurando PITR hacia 'pitr_gold_target'..."
docker compose exec -T postgres-db sh -c "
  rm -rf /tmp/pitr_restore_data /tmp/pitr_recovery.log
  mkdir -p /tmp/pitr_restore_data/pg_wal
  tar -xzf '${latest_backup}/base.tar.gz' -C /tmp/pitr_restore_data/
  tar -xzf '${latest_backup}/pg_wal.tar.gz' -C /tmp/pitr_restore_data/pg_wal/
  chmod 0700 /tmp/pitr_restore_data
  touch /tmp/pitr_restore_data/recovery.signal
  cat <<'EOF' >> /tmp/pitr_restore_data/postgresql.conf
data_directory = '/tmp/pitr_restore_data'
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_name = 'pitr_gold_target'
recovery_target_action = 'promote'
archive_mode = off
port = 5433
listen_addresses = '127.0.0.1'
shared_buffers = 32MB
max_connections = 200
EOF
  chown -R postgres:postgres /tmp/pitr_restore_data
"

# Paso 6: Iniciar PostgreSQL en modo recuperación en puerto 5433
echo "  [*] Iniciando instancia de recuperación en puerto 5433..."
docker compose exec -T postgres-db sh -c "su-exec postgres pg_ctl start -D /tmp/pitr_restore_data -l /tmp/pitr_recovery.log -o '-p 5433 -c config_file=/tmp/pitr_restore_data/postgresql.conf'"

# Esperar a que la instancia de recuperación termine el replay y esté lista
READY=0
for i in $(seq 1 30); do
  if docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h 127.0.0.1 -p 5433 -U postgres -d plentypay -c "SELECT 1;" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 1 ]; then
  echo "  [PASS] Instancia de recuperación completó PITR y acepta consultas en puerto 5433"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] La instancia de recuperación no levantó a tiempo"
  docker compose exec -T postgres-db cat /tmp/pitr_recovery.log || true
  FAIL=$((FAIL + 1))
  exit 1
fi

# Paso 7: Comprobar que solo los registros previos a 'pitr_gold_target' fueron restaurados
restored_count=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h 127.0.0.1 -p 5433 -U postgres -d plentypay -t -c "SELECT count(*) FROM identity.pitr_audit;" | tr -d ' \r\n')
if [ "$restored_count" -eq 2 ]; then
  echo "  [PASS] Instancia recuperada contiene exactamente 2 registros (RTO/RPO verificado)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Se esperaban 2 registros restaurados, encontrados: $restored_count"
  FAIL=$((FAIL + 1))
fi

has_rec1=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h 127.0.0.1 -p 5433 -U postgres -d plentypay -t -c "SELECT count(*) FROM identity.pitr_audit WHERE note = 'record_1_pre_backup';" | tr -d ' \r\n')
has_rec2=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h 127.0.0.1 -p 5433 -U postgres -d plentypay -t -c "SELECT count(*) FROM identity.pitr_audit WHERE note = 'record_2_target_valid';" | tr -d ' \r\n')
has_rec3=$(docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h 127.0.0.1 -p 5433 -U postgres -d plentypay -t -c "SELECT count(*) FROM identity.pitr_audit WHERE note = 'record_3_corrupted_disaster';" | tr -d ' \r\n')

if [ "$has_rec1" -eq 1 ] && [ "$has_rec2" -eq 1 ] && [ "$has_rec3" -eq 0 ]; then
  echo "  [PASS] PITR restauró registros pre-backup y post-backup hasta el target; descartó registros corruptos"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Falla en consistencia de registros recuperados (rec1: $has_rec1, rec2: $has_rec2, rec3: $has_rec3)"
  FAIL=$((FAIL + 1))
fi

# Paso 8: Limpieza de la instancia de recuperación
echo "  [*] Limpiando instancia de recuperación y tablas temporales..."
docker compose exec -T postgres-db sh -c "
  su-exec postgres pg_ctl stop -D /tmp/pitr_restore_data -m immediate >/dev/null 2>&1 || true
  rm -rf /tmp/pitr_restore_data /tmp/pitr_recovery.log
" >/dev/null 2>&1 || true

docker compose exec -T -e PGPASSWORD="$PG_PASS" postgres-db psql -h localhost -U postgres -d plentypay -c "
  DROP TABLE IF EXISTS identity.pitr_audit;
" >/dev/null

echo ""
echo "Resultado: $PASS pruebas exitosas, $FAIL fallidas."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
