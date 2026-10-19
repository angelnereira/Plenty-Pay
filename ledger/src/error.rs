use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum LedgerError {
    #[error("currency mismatch: {0} vs {1}")]
    CurrencyMismatch(String, String),
    #[error("overflow in money operation")]
    Overflow,
    #[error("negative amount not allowed")]
    NegativeAmount,
    #[error("division by zero")]
    DivisionByZero,
    #[error("weights must not be empty")]
    EmptyWeights,
    #[error("invalid money amount")]
    InvalidAmount,
}
