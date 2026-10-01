# ledger-service — núcleo contable

Doble partida, inmutabilidad, idempotencia, reversos explícitos y dinero exacto (mandato §12; ADR-0002). Contrato: `plentypay.ledger.v1`.

**Estado: PARTIAL**

| Componente | Estado |
|---|---|
| Dominio puro (Money/Currency/Transaction/Store) | IMPLEMENTADO — 15 tests, clippy/fmt limpios |
| Invariante `SUM(debit)==SUM(credit)` pre-confirmación | IMPLEMENTADO (dominio) |
| Idempotencia por clave (webhook duplicado ⇒ un solo asiento) | IMPLEMENTADO (dominio) |
| Reversos ligados al original, único y total (v1) | IMPLEMENTADO (dominio) |
| Persistencia PostgreSQL (sqlx, ADR-0010) + trigger de balanceo + REVOKE UPDATE/DELETE | TODO (Etapa 2) |
| Servidor gRPC `tonic` | TODO (Etapa 2) |
| Holds (HoldFunds/Capture/Release) | TODO (Etapa 3; contrato ya estable) |
| Dockerfile | TODO (con sqlx/tonic) |

## Ejecutar hoy

```bash
cd services/ledger
cargo fmt -- --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## Reglas contables implementadas

1. Montos de entrada SIEMPRE positivos; el signo vive en `DEBIT/CREDIT` (modelo `MotorLedgerEntry`, doc 01 §6).
2. Transacción mono-moneda; montos > 0; no vacía.
3. Balanceo con aritmética checked (overflow ⇒ error, nunca wrap).
4. Store append-only: sin API de mutación; corrección = reverso nuevo ligado (`reverse_of`).
5. Saldo neto firmado (la política "wallet sin sobregiro" es del servicio wallet, ADR-0006).

Las mismas invariantes se re-aplicarán en PostgreSQL (trigger + roles DB) — defensa en profundidad (§13).
