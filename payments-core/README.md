# payments-core

Orquestador de cobros: intents, pagos, intentos por riel, comisiones, reembolsos y UNKNOWN. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Rust (toolchain fijo en `rust-toolchain.toml`: 1.97.0) |
| Puerto | gRPC `50062`, administración `9100` (`/healthz`, `/readyz`, `/metrics`) |
| Fase del roadmap | F11 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio: comisiones §4, máquinas de estado §8.1/§8.2, validación de entradas | ✅ L1 | `src/domain/`; 15 vectores literales y propiedades en `tests/fees_vectors.rs`, unitarias en cada módulo |
| Migración `0001_initial.sql`: RLS en 10 tablas, sin DELETE, triggers de congelado | ✅ L2 | `test/test_l2.sh` migra dos veces y comprueba privilegios, RLS y dueño (2026-10-20) |
| Intents y pagos wallet con hold y captura T3 (F11.3, R1–R9, R13–R15) | ✅ L2 · ⏳ L4 | 32 pruebas L2 contra ledger, identity e infra-management reales y efímeros, entre ellas la prueba de aceptación 1 del SPEC |
| Terminales y ResolveTerminal (F11.5, R16) | ✅ L2 | `f11_5_resolve_terminal_shows_verified_name`: nombre verificado en identity; inactiva → `TERMINAL_INACTIVE` |
| Políticas de comisión y QuoteFees | ✅ L2 | `r3_*` |
| Outbox y relay a NATS (ADR 0012) | ✅ código · ⏳ en vivo | L2 verifica que cada fila arma el `EventEnvelope` del contrato. Aún no se publicó en `PP_PAYMENTS` en este entorno |
| Proyección de `TenantStatusChanged` (R2) | ✅ L2 · ⏳ en vivo | `r2_tenant_projection_suspends_charges`; el consumidor durable de NATS aún no corre en producción |
| Rieles externos sandbox, recargas T1, cobros T2, job UNKNOWN, ResolveUnknownPayment (F11.7) | ✅ L2 · ✅ producción | `f11_7_*` y `chain_topup_then_pay_*` en L2; recorrido real por el gateway el 2026-10-20 (ver `status.md`) |
| Worker de asiento R8 (F11.4) | ✅ L2 | T1/T2 con clave determinista; idempotente al repetirse |
| Reembolsos, webhooks, P2P, PostMemoEntry | 📋 | responden `UNIMPLEMENTED`. Un webhook nunca se acepta (fail-closed, R12) |
| Observabilidad | ◐ parcial | logs JSON, métricas de SPEC §10, prueba de no-fuga (`obs_defect_does_not_leak_its_cause`). **Faltan**: trazas OTel con `traceparent`, reglas de alerta y `pp_payments_unknown_age_seconds_max` |
| Imagen Docker | ✅ | distroless `cc-debian12:nonroot`, 53 MB. Probada con migración, arranque en solo lectura sin capabilities, healthcheck rc=0 y apagado ordenado con exit 0 |
| Despliegue en producción | ✅ 2026-10-20 | esquema recreado con respaldo (`payments-reset.sh`), migraciones 0001–0002, política global de comisión 3 % + ITBMS 7 % (MERCHANT) creada por `PUT /v1/fee-policies` |

## Pruebas
```bash
cd payments-core && cargo clippy --all-targets -- -D warnings && cargo test   # unitarias y vectores; las L2 aparecen "ignored"
./payments-core/test/test_l2.sh                                              # desde la raíz: L2 contra servicios efímeros
```
`test_l2.sh` **nunca toca la base `plentypay` ni los contenedores en servicio**:
- crea `plentypay_l2_payments_*` con los roles y esquemas de `postgres-db/init`;
- construye desde el repo y levanta, con nombres propios, ledger, identity e infra-management conectados a esa base;
- migra payments-core dos veces;
- corre las pruebas en `rust:1.97.0-bookworm`, dentro de la red `plentypay_data`;
- al salir borra los contenedores y la base.

Las pruebas se niegan a correr contra una base que no sea `plentypay_l2_*`. Los negocios se dan de alta y se aprueban en identity, las billeteras se recargan en el ledger (T1) y los saldos se leen del ledger.

## Arranque
```bash
docker compose build payments-core
docker compose run --rm --no-deps payments-core migrate   # PP_MIGRATE_DSN como migrator_payments
docker compose up -d --no-deps payments-core              # nunca reinicia tunnel ni otros contenedores
```
Conecta **directo a `postgres-db:5432`**, como el ledger.

Para que un negocio pueda cobrar debe cumplir tres condiciones:
- estar ACTIVE en identity;
- tener una política de comisión vigente (`UpsertFeePolicy` con `platform:flags:manage`). No hay política por defecto en código;
- tener `payments.enabled` encendida en infra-management.

## Limitaciones conocidas
- **Rieles**: todos son sandbox (R13); no se mueve dinero real. Tarjeta, Apple Pay, Google Pay y QR interoperable están deshabilitados.
- **Puntos de cobro**: ningún tipo de negocio trae encendida por defecto la capacidad `finance.terminals`. El dueño la enciende en «Módulos y funciones».
- **Tiempo real**: `payment.status` por WebSocket aún no existe (F20/F23.4); la app consulta el intent.
- **Observabilidad**: parcial (ver la fila de arriba).
