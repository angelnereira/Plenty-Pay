//! Núcleo contable de PlentyPay (doble partida).
//!
//! Estado: `PARTIAL` — dominio puro IMPLEMENTADO con tests; adaptadores
//! gRPC/PostgreSQL PLANNED (Etapa 2, docs/10).
//!
//! Doctrina (mandato §12 + ADR-0002):
//! - Dinero = entero de unidades menores + moneda explícita. Nunca float/double.
//! - Entradas con monto SIEMPRE positivo; el signo vive en la dirección
//!   (DEBIT/CREDIT) — mismo modelo que `MotorLedgerEntry` (doc 01 §6).
//! - `SUM(DEBIT) == SUM(CREDIT)` por transacción, validado antes de confirmar.
//! - El histórico es append-only: corregir = asentar un REVERSO ligado a la
//!   partida original; la original jamás se edita (doc 00 §3.2).
//! - Idempotencia a nivel de operación: reintentar la misma operación
//!   devuelve el mismo resultado, jamás dos asientos (doc 03 §10.3).

pub mod domain;

pub use domain::{
    Balance, Currency, Direction, EntrySpec, LedgerError, Money, Store, Transaction, TransactionRef,
};
