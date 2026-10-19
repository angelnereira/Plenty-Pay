use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SettlementError {
    #[error("nothing to settle")]
    NothingToSettle,
    #[error("below minimum payout")]
    BelowMinimum,
    #[error("invalid state transition")]
    InvalidStateTransition,
    #[error("invalid destination")]
    InvalidDestination,
    #[error("evidence required")]
    EvidenceRequired,
    #[error("already imported")]
    AlreadyImported,
    #[error("unsupported format")]
    UnsupportedFormat,
    #[error("not found")]
    NotFound,
}
