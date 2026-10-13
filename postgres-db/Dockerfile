# syntax=docker/dockerfile:1
FROM postgis/postgis@sha256:681931a625df344215e9b8998bf34daf146b6a395ceacee4439eb9c85869239f

COPY init/ /docker-entrypoint-initdb.d/
COPY postgresql.conf /etc/postgresql/postgresql.conf

RUN mkdir -p /var/lib/postgresql/wal_archive && chown -R postgres:postgres /var/lib/postgresql/wal_archive /docker-entrypoint-initdb.d/

EXPOSE 5432
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
