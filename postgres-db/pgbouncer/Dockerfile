# syntax=docker/dockerfile:1
FROM alpine:3.21

RUN apk add --no-cache pgbouncer su-exec postgresql-client \
    && addgroup -S -g 1001 pgbouncer \
    && adduser -S -u 1001 -G pgbouncer pgbouncer


COPY pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY pgbouncer/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /var/log/pgbouncer /var/run/pgbouncer /etc/pgbouncer \
    && chown -R pgbouncer:pgbouncer /var/log/pgbouncer /var/run/pgbouncer /etc/pgbouncer

EXPOSE 6432
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
