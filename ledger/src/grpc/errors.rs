//! Único punto que traduce errores a `tonic::Status` con `ErrorInfo.reason` (rust-standards.md §5,
//! grpc-conventions.md §4). Un defecto se registra UNA vez aquí (borde) y el cliente solo recibe
//! `INTERNAL` genérico; la causa queda en la telemetría.

use std::collections::HashMap;

use tonic::{Code, Status};
use tonic_types::{ErrorDetails, StatusExt};

use crate::domain::errors::DomainError;
use crate::store::StoreError;

pub fn status(code: Code, reason: &str, message: &str) -> Status {
    Status::with_error_details(
        code,
        message,
        ErrorDetails::with_error_info(reason, "plentypay", HashMap::new()),
    )
}

pub fn to_status(err: StoreError, rpc: &'static str) -> Status {
    use DomainError as D;
    match err {
        StoreError::Domain(d) => match d {
            D::Unbalanced => status(
                Code::InvalidArgument,
                "UNBALANCED_TRANSACTION",
                "la transacción no balancea",
            ),
            D::UnknownTemplate | D::TemplateShapeMismatch => status(
                Code::InvalidArgument,
                "UNKNOWN_TEMPLATE",
                "el asiento no sigue una plantilla permitida",
            ),
            D::InvalidAmount | D::Overflow => {
                status(Code::InvalidArgument, "INVALID_AMOUNT", "monto inválido")
            }
            D::CurrencyMismatch | D::InvalidCurrency => status(
                Code::InvalidArgument,
                "CURRENCY_MISMATCH",
                "moneda inválida o distinta a la de la transacción",
            ),
            D::UnknownAccountType
            | D::InvalidSide
            | D::InvalidParty
            | D::PlatformAccountForParty => {
                status(Code::InvalidArgument, "INVALID_ACCOUNT", "cuenta inválida")
            }
            D::EffectiveAtOutOfRange => status(
                Code::InvalidArgument,
                "INVALID_EFFECTIVE_AT",
                "fecha efectiva fuera de la ventana permitida",
            ),
            D::IdempotencyKeyRequired => status(
                Code::InvalidArgument,
                "IDEMPOTENCY_KEY_REQUIRED",
                "falta la clave de idempotencia",
            ),
            D::InvalidHoldTtl => status(
                Code::InvalidArgument,
                "INVALID_HOLD_TTL",
                "la retención necesita un plazo entre 1 segundo y 7 días",
            ),
        },
        StoreError::IdempotencyKeyReused => status(
            Code::AlreadyExists,
            "IDEMPOTENCY_KEY_REUSED",
            "la clave de idempotencia ya se usó con otra operación",
        ),
        StoreError::DuplicateCapture => status(
            Code::AlreadyExists,
            "DUPLICATE_CAPTURE",
            "el pago ya fue asentado",
        ),
        StoreError::InsufficientFunds => status(
            Code::FailedPrecondition,
            "INSUFFICIENT_FUNDS",
            "saldo insuficiente",
        ),
        StoreError::NotFound => status(Code::NotFound, "NOT_FOUND", "no encontrado"),
        StoreError::AlreadyReversed => status(
            Code::FailedPrecondition,
            "ALREADY_REVERSED",
            "la transacción ya fue reversada",
        ),
        StoreError::HoldNotActive => status(
            Code::FailedPrecondition,
            "HOLD_NOT_ACTIVE",
            "la retención no está activa",
        ),
        StoreError::Db(e) => {
            // Defecto: registro único en el borde con la causa; al cliente, genérico.
            tracing::error!(rpc, error.type = "sqlx", err = %e, "rpc failed");
            Status::internal("internal error")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// observability-standards §15: un defecto responde INTERNAL genérico; la causa (aquí, el
    /// texto de la base) nunca llega al cliente.
    #[test]
    fn obs_defect_does_not_leak_its_cause() {
        let s = to_status(
            StoreError::Db(sqlx::Error::Protocol("secret column value 4111".into())),
            "PostTransaction",
        );
        assert_eq!(s.code(), Code::Internal);
        assert_eq!(s.message(), "internal error");
        assert!(!format!("{s:?}").contains("4111"));
    }

    #[test]
    fn domain_errors_carry_their_reason() {
        let s = to_status(StoreError::InsufficientFunds, "PostTransaction");
        assert_eq!(s.code(), Code::FailedPrecondition);
        assert_eq!(
            s.get_error_details()
                .error_info()
                .map(|i| i.reason.as_str()),
            Some("INSUFFICIENT_FUNDS")
        );
    }
}
