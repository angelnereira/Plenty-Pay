# ADR 0016 — Unidades de despliegue con procesos de respaldo y carpetas no-contenedor

- **Estado**: Aceptada (enmienda ADR 0002)
- **Fecha**: 2026-10-10
- **Decisores**: dirección técnica de PlentyPay

## Contexto
Algunos contenedores necesitan un proceso de terceros junto al servicio propio (p. ej. `security` = servicio Go + OpenBao; `postgres-db` = PostgreSQL + PgBouncer; `web` = servidor Go + bundle Flutter Web), y algunas carpetas no son contenedores.

## Decisión
1. Una carpeta raíz es una **unidad de despliegue**: puede definir más de un proceso (varios servicios en compose / varios contenedores en un Pod), siempre construidos desde **su** carpeta.
2. `web` sirve el bundle Flutter Web que CI construye y coloca en `web/static/app/` (no versionado) — el Dockerfile de `web` nunca hace `COPY ../`.
3. Lista oficial de carpetas no-contenedor: `docs/`, `scripts/`, `network-contracts/`, `infra/`, `flutter_app/`, `output/`, `_legacy-typescript-reference/`.

## Consecuencias
+ Se respeta el aislamiento con componentes compuestos.
− `check-isolation.sh` mantiene la lista de no-contenedores.

## Alternativas consideradas
Una carpeta por proceso (fragmenta componentes que siempre van juntos).
