//! Errores de dominio del ledger. Cada uno tiene su `reason` estable (grpc/errors.rs) y nunca
//! lleva datos internos al cliente.

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("unbalanced transaction")]
    Unbalanced,
    #[error("unknown transaction template")]
    UnknownTemplate,
    #[error("entry does not fit the template shape")]
    TemplateShapeMismatch,
    #[error("invalid amount")]
    InvalidAmount,
    #[error("currency mismatch")]
    CurrencyMismatch,
    #[error("invalid currency")]
    InvalidCurrency,
    #[error("unknown account type")]
    UnknownAccountType,
    #[error("invalid entry side")]
    InvalidSide,
    #[error("invalid party id")]
    InvalidParty,
    #[error("platform account used by a non-platform party")]
    PlatformAccountForParty,
    #[error("effective_at out of the allowed window")]
    EffectiveAtOutOfRange,
    #[error("idempotency key required")]
    IdempotencyKeyRequired,
    #[error("hold ttl must be between 1 second and 7 days")]
    InvalidHoldTtl,
    #[error("arithmetic overflow")]
    Overflow,
}
