# Runbook — Arranque y parada del sistema (F30.1)

Procedimiento para levantar y detener PlentyPay completo sin perder trabajo en curso.
Cubre `delivery-pipeline.md` §9 (arranque/parada) y es la referencia de la mesa de
ayuda durante una ventana de mantenimiento.

> [!IMPORTANT]
> Parar el sistema **no** detiene la confirmación de pagos en vuelo. Un `UNKNOWN` ya aceptado
> por un comercio debe resolverse antes de parar; ver
> [`payment-unknown.md`](payment-unknown.md).

---

## 1. Orden de arranque

El orden no es negociable: cada servicio espera a que su dependencia esté *lista*, no
solo *viva*. `service-dependencies.md` §2 es la fuente de verdad.

| # | Componente | Espera a | Señal de listo |
|---|---|---|---|
| 1 | `postgres-db` | — | `pg_isready` + migración aplicada |
| 2 | `scylladb` | — | `nodetool status` muestra `UN` |
| 3 | `nats` | — | `/healthz` responde `ok` |
| 4 | `object-storage` (Garage) | — | bucket `pp-*` accesible |
| 5 | `security` | postgres, object-storage | `/healthz` + `SecurityReady` |
| 6 | `identity` | postgres, security, nats | `/healthz` |
| 7 | `ledger` | postgres, nats | `/healthz` |
| 8 | `payments-core` | ledger, security, identity, nats | `/healthz` |
| 9 | `catalog`, `orders`, `inventory`, `pos`, `logistics` | identity, catalog, payments-core, ledger | `/healthz` |
| 10 | `fiscal-invoicing` | payments-core, identity, object-storage | `/healthz` |
| 11 | `settlement` | ledger, payments-core, catalog | `/healthz` |
| 12 | `payroll` | payments-core, security, identity, geolocation | `/healthz` |
| 13 | `notifications` | identity, nats, object-storage | `/healthz` |
| 14 | `analytics-bi` | postgres, scylladb | `/healthz` |
| 15 | `geolocation`, `infra-management` | postgres | `/healthz` |
| 16 | `api-gateway` | identity | `/healthz` |
| 17 | `web` | (ninguna) | `/healthz` |

Comprobación de arranque:

```bash
# Todos los contenedores reportes el mismo estado de salud
docker compose ps --format '{{.Service}}\t{{.Health}}' | grep -v 'healthy' || echo "todos healthy"
```

## 2. Parada

Se detiene **al revés**. Un contenedor que deja de escribir en el libro antes de que
los que le escriban dejen de hacerlo genera huecos.

1. Primero `web` y `api-gateway`: deja de entrar tráfico nuevo.
2. Espera a que las peticiones en vuelo terminen (`pp_http_requests_in_flight` = 0).
3. Detén los productores de eventos (los que publican) antes que los consumidores.
4. Detén los contenedores de dominio.
5. `ledger` **al final de todos**, nunca antes.
6. Infraestructura al final: postgres, nats, scylladb, object-storage.

```bash
# 1. Cerrar el tráfico entrante
docker compose stop web api-gateway

# 2. Confirmar que no hay peticiones en vuelo
curl -s localhost:9100/metrics | grep pp_http_requests_in_flight

# 3-5. El resto, en orden inverso
docker compose stop notifications payroll settlement fiscal-invoicing \
  orders pos logistics inventory catalog payments-core ledger identity \
  security analytics-bi geolocation infra-management
```

## 3. Cuándo hay que parar de verdad

Solo en estos casos:

- Ventana de mantenimiento anunciada (ver `Q-08` para el aviso legal).
- Actualización que lo requiera (F27.5).
- Incidente de seguridad (ver `security-incident.md`).

Para el resto, un contenedor se reinicia solo. **Reiniciar el sistema completo por un
problema de un solo servicio causa más daño que el fallo original.**

## 4. Verificación posterior

```bash
# 1. Salud de todos
docker compose ps --format '{{.Service}}\t{{.Health}}'

# 2. El libro contable cuadra (invariantes de ledger)
cd ledger && DATABASE_URL="$DATABASE_URL" cargo test --test invariants

# 3. Un pago de prueba extremo a extremo
#    (ver payment-unknown.md §4 para el guion de verificación)
```