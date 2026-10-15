# Estándares Rust

Aplica a: **ledger**, **payments-core**, **settlement** (el núcleo de dinero, ADR 0001). Elegido por: ausencia de nulos y de condiciones de carrera de datos, enums exhaustivos para máquinas de estado, aritmética con chequeo de desbordamiento, rendimiento predecible sin GC.

## 1. Toolchain
- `rust-toolchain.toml` en cada contenedor con versión **fijada** (p. ej. `channel = "1.97.0"`, componentes `rustfmt`, `clippy`). Edición 2021 (o 2024 cuando el SPEC lo apruebe).
- Crates base: `tokio` (multi-thread), `tonic` + `prost` (+ `tonic-build` en `build.rs` leyendo **solo** `./proto/`), `sqlx` (postgres, runtime-tokio, tls-rustls, uuid, chrono, macros, migrate), `uuid` (v7), `chrono`, `thiserror`, `tracing` + `tracing-subscriber` (json) + `tracing-opentelemetry`, `opentelemetry-otlp`, `prometheus` o `metrics-exporter-prometheus`, `async-nats`, `serde`, `sha2`, `tower`. Pruebas: `proptest`, `testcontainers`.
- Prohibidos: `f32`/`f64` en dinero, crates con `unsafe` propio no auditado para lógica de negocio, ORMs que oculten SQL.

## 2. Perfil y lints (`Cargo.toml`)
```toml
[profile.release]
overflow-checks = true      # un desbordamiento aborta en vez de corromper un saldo
panic = "abort"
lto = "thin"
codegen-units = 1

[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"
float_arithmetic = "deny"
indexing_slicing = "deny"
arithmetic_side_effects = "warn"   # usar checked_* en dinero
todo = "deny"
```
En pruebas se permite `unwrap/expect` con `#[allow]` a nivel de módulo `tests`.

## 3. Estructura de carpetas (obligatoria)
```
<contenedor>/
├── Cargo.toml / Cargo.lock / rust-toolchain.toml / build.rs
├── Dockerfile / .env.example / README.md / SPEC.md
├── proto/            # COPIA de network-contracts (sync-protos.sh); build.rs compila desde aquí
├── migrations/       # NNNN_descripcion.sql (sqlx migrate)
├── .sqlx/            # metadatos de `cargo sqlx prepare` (versionados: build offline)
├── src/
│   ├── main.rs       # cableado y apagado
│   ├── config.rs
│   ├── domain/       # tipos y reglas puras: money.rs, fees.rs, state.rs, posting.rs ...
│   ├── service/      # casos de uso
│   ├── store/        # sqlx; transacciones
│   ├── grpc/         # impl de los traits tonic; traducción de errores
│   ├── clients/      # clientes a otros contenedores
│   ├── events/       # outbox + relay + consumidores
│   ├── observability.rs
│   └── pb.rs         # include! de lo generado
└── tests/            # integración (L2/L3)
```
`domain` no depende de `tonic`, `sqlx` ni `tokio`.

## 4. Dinero
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Money { amount_minor: i64, currency: Currency }

impl Money {
    pub fn new(amount_minor: i64, currency: Currency) -> Result<Self, MoneyError>;
    pub fn checked_add(self, other: Money) -> Result<Money, MoneyError>; // misma moneda + sin overflow
    pub fn checked_sub(self, other: Money) -> Result<Money, MoneyError>;
    pub fn percent_bps_half_up(self, bps: u32) -> Result<Money, MoneyError>; // (v*bps + 5000) / 10000 en i128
    pub fn allocate(self, weights: &[u64]) -> Result<Vec<Money>, MoneyError>; // suma exacta; residuo según domain-model §4.3
}
```
Cálculos intermedios en `i128`; el resultado vuelve a `i64` con `try_from`. Los vectores A–E de `domain-model.md` §4 son pruebas literales.

## 5. Errores
- `thiserror` para errores de dominio (`enum LedgerError { Unbalanced, AccountNotFound, InsufficientFunds { .. }, ... }`).
- Un único lugar (`grpc/errors.rs`) mapea a `tonic::Status` con `ErrorInfo.reason`.
- Registro de fallos, trazas de pila (`Backtrace`) y OpenTelemetry según `observability-standards.md` §9–§15: `#[tracing::instrument(err)]` en casos de uso y adaptadores; prohibido `unwrap`/`expect`/`println!` fuera de pruebas.
- Nunca `unwrap()` en código de producción; propagar con `?`.

## 6. Máquinas de estado
Enums con transición explícita y exhaustiva:
```rust
impl PaymentStatus {
    pub fn transition(self, ev: PaymentEvent) -> Result<PaymentStatus, StateError> {
        use PaymentStatus::*; use PaymentEvent::*;
        match (self, ev) {
            (Pending, Authorized) => Ok(Authorized),
            // ... tabla completa de domain-model.md §8.1
            (s, e) => Err(StateError::Invalid { from: s, event: e }),
        }
    }
}
```
La persistencia actualiza con guardia (`UPDATE ... WHERE id=$1 AND status=$2`) y valida filas afectadas = 1.

## 7. SQL con sqlx
- `sqlx::query!`/`query_as!` verificadas en compilación; `.sqlx/` versionado para compilar sin BD (`SQLX_OFFLINE=true` en Docker).
- Transacciones explícitas; `SELECT ... FOR UPDATE` ordenado por `account_id` (ledger) para evitar deadlocks.
- `SET LOCAL app.tenant_id` en cada transacción (RLS).

## 8. Asincronía y rendimiento
- Sin bloqueos síncronos en el runtime (`spawn_blocking` para CPU pesado como firmas).
- Pool sqlx dimensionado por réplica (`max_connections` vía env, default 20) detrás de PgBouncer.
- Backpressure: límites de concurrencia por RPC con `tower::limit`.

## 9. Pruebas
- Unidad en el mismo archivo (`#[cfg(test)]`), propiedades con `proptest` en `domain`.
- Integración en `tests/` con testcontainers PostgreSQL 16.
- `cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` en CI.
- El paquete `scripts/ledger-tests` (Node + PGlite) es la **especificación ejecutable de referencia** de las invariantes SQL del ledger: las migraciones Rust deben pasar los mismos 27 casos (portarlos a `tests/invariants.rs` en F10).

## 10. Dockerfile (plantilla)
```dockerfile
FROM rust:1.97-bookworm AS build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler && rm -rf /var/lib/apt/lists/*
COPY . .
ENV SQLX_OFFLINE=true
RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /src/target/release/<binario> /app
USER nonroot:nonroot
EXPOSE 500xx 9100
ENTRYPOINT ["/app"]
```
