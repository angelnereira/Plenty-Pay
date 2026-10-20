# ledger

Libro mayor de doble entrada: cuentas, asientos inmutables, saldos y holds. Especificación completa: [`SPEC.md`](SPEC.md).

| | |
|---|---|
| Tecnología | Rust (toolchain fijo en `rust-toolchain.toml`: 1.97.0) |
| Puerto | gRPC `50061`, administración `9100` (`/healthz`, `/readyz`, `/metrics`) |
| Fase del roadmap | F10 |

## Estado
| Aspecto | Estado | Evidencia |
|---|---|---|
| Dominio (cuentas, plantillas T1–T10, R8, R12, R13) | ✅ | `src/domain/`; `cargo test` 14 unitarias + 8 de `Money` |
| Store (post, reverso, holds, saldos, extracto, I7) | ✅ L2 | `src/store/`; 25 pruebas L2 con `./ledger/test/test_l2.sh` (2026-10-20) |
| gRPC (11 RPCs de `ledger.proto`) | ✅ L2 | `src/grpc/`; las pruebas L2 pasan por los manejadores reales con metadatos `x-pp-*` |
| Outbox + relay a NATS (ADR 0012) | ✅ código · ⏳ en vivo | `src/events/`; L2 verifica la fila de outbox en la misma transacción. Publicación en `PP_LEDGER` aún no ejecutada en este entorno |
| Jobs R9 (expiración, 30 s) y R11 (I7, cada hora) | ✅ L2 | `main.rs`; `r9_expired_hold_*`, `r11_*` |
| Observabilidad | ◐ parcial | logs JSON (`tracing`), métricas `pp_ledger_invariant_violations_total`, `pp_ledger_holds_expired_total`, `pp_ledger_job_failures_total{job}`, prueba de no-fuga (`obs_defect_does_not_leak_its_cause`). **Faltan**: trazas OTel con propagación de `traceparent`, `request_id` en INTERNAL, captura de pánico, métricas de latencia (`pp_ledger_post_duration_seconds`, `pp_ledger_lock_wait_seconds`) |
| Imagen Docker | ✅ | `Dockerfile` según `rust-standards.md` §10 (distroless `cc-debian12:nonroot`) |
| Despliegue en producción | ⏳ | registrado en `docker-compose.yml`; requiere reiniciar el esquema (ver abajo) |
| Carga (F10.8) | 📝 | k6 no instalado: no ejecutado |

## Pruebas
```bash
cd ledger && cargo clippy --all-targets -- -D warnings && cargo test   # unitarias; las L2 aparecen "ignored"
./ledger/test/test_l2.sh                                              # desde la raíz: L2 contra base efímera
```
`test_l2.sh` **nunca toca la base `plentypay`**: crea `plentypay_l2_ledger_*` en el clúster, migra con
`migrator_ledger` (dos veces, para probar idempotencia), conecta como `ledger_svc` (RLS, sin DELETE), corre
todo dentro de `rust:1.97.0-bookworm` en la red `plentypay_data` y borra la base al salir. Las pruebas se niegan
a correr si el DSN no apunta a una base `plentypay_l2_*`.

Cobertura L2: R1–R13 (una prueba por regla, id en el nombre), los casos de referencia de `scripts/ledger-tests`
que aplican al modelo del ledger (`ref_*`: vector B/.100.00, balance, vacía, nace POSTED, monedas, CHECKs, I5 por SQL,
inmutabilidad, captura única con reembolsos parciales, clave única, reverso neto 0), concurrencia SPEC §11.4
(1 000 transferencias cruzadas, 10 billeteras, 50 tareas) y la propiedad §11.3 (400 operaciones pseudoaleatorias con
reversos → I1, I5, I7). Los casos de `scripts/ledger-tests` que dependen del modelo Prisma heredado
(`payment_intents`, `wallets`, `payments.refundedAmountCents`, cuentas de otro tenant) no aplican: esas reglas son de
payments-core (F11).

## Arranque
```bash
docker compose build ledger
docker compose run --rm --no-deps ledger migrate   # PP_MIGRATE_DSN como migrator_ledger
docker compose up -d --no-deps ledger              # nunca reinicia tunnel ni otros contenedores
```
Conecta **directo a `postgres-db:5432`**, no a PgBouncer: sqlx usa sentencias preparadas y PgBouncer está en
modo `transaction` sin `max_prepared_statements`.

## Limitaciones conocidas
- El esquema `ledger` de producción tiene restos de una prueba de carga de 2026-10-19 (6 252 `PAYMENT` sin
  referencia, tablas de `postgres` con DELETE para `ledger_svc`). Las migraciones nuevas no aplican sobre él: hay que
  respaldarlo y recrearlo (script preparado fuera del repo; requiere autorización del responsable).
- Nadie llama aún al ledger: el gateway no tiene rutas hacia él y payments-core se conecta en F11.3.
- Observabilidad parcial (fila de arriba).
