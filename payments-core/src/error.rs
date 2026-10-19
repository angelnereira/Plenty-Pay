use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PaymentsError {
    #[error("currency mismatch")]
    CurrencyMismatch,
    #[error("overflow")]
    Overflow,
    #[error("amount below fees")]
    AmountBelowFees,
    #[error("fee policy missing")]
    FeePolicyMissing,
    #[error("splits mismatch")]
    SplitsMismatch,
    #[error("refund exceeds captured")]
    RefundExceedsCaptured,
    #[error("merchant balance insufficient")]
    MerchantBalanceInsufficient,
}
