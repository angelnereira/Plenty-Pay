#!/usr/bin/env sh
set -e

mkdir -p /etc/pgbouncer
cat <<EOF > /etc/pgbouncer/userlist.txt
"postgres" "${POSTGRES_PASSWORD:-postgres_dev_master_password_32ch}"
"readonly_ops" "${READONLY_OPS_PASSWORD:-readonly_ops_dev_pass}"
EOF

chmod 0600 /etc/pgbouncer/userlist.txt
chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt

exec su-exec pgbouncer pgbouncer /etc/pgbouncer/pgbouncer.ini
