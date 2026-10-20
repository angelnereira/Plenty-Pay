//! Errores de dominio. Cada uno tiene un `reason` estable (SPEC §4, glossary §7.3); la traducción a
//! `tonic::Status` vive solo en `grpc/errors.rs`.

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum DomainError {
    #[error("amount out of range")]
    AmountOutOfRange,
    #[error("unsupported currency")]
    CurrencyMismatch,
    #[error("amount below fees")]
    AmountBelowFees,
    #[error("splits do not add up to the amount")]
    SplitsMismatch,
    #[error("no fee policy applies")]
    FeePolicyMissing,
    #[error("invalid fee policy")]
    InvalidFeePolicy,
    #[error("invalid state transition")]
    InvalidStateTransition,
    #[error("invalid metadata")]
    InvalidMetadata,
    #[error("invalid reference")]
    InvalidReference,
    #[error("idempotency key required")]
    IdempotencyKeyRequired,
    #[error("refund exceeds captured")]
    RefundExceedsCaptured,
    #[error("arithmetic overflow")]
    Overflow,
}
