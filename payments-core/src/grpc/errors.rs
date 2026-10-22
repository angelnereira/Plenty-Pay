//! Único punto que traduce errores a `tonic::Status` con `ErrorInfo.reason` (grpc-conventions §4).
//! Un defecto se registra UNA vez aquí (borde) con su `request_id` y el cliente solo recibe
//! `INTERNAL` genérico; la causa queda en la telemetría (AGENTS.md §2.14, §2.15).

use std::collections::HashMap;

use tonic::{Code, Status};
use tonic_types::{ErrorDetails, StatusExt};

use crate::clients::DependencyError;
use crate::domain::errors::DomainError;
use crate::service::Error;
use crate::store::StoreError;

pub fn status(code: Code, reason: &str, message: &str) -> Status {
    Status::with_error_details(
        code,
        message,
        ErrorDetails::with_error_info(reason, "plentypay", HashMap::new()),
    )
}

fn domain(d: DomainError) -> Status {
    use DomainError as D;
    match d {
        D::AmountOutOfRange => status(
            Code::FailedPrecondition,
            "AMOUNT_OUT_OF_RANGE",
            "monto fuera del rango permitido",
        ),
        D::CurrencyMismatch => status(
            Code::InvalidArgument,
            "CURRENCY_MISMATCH",
            "moneda no admitida",
        ),
        D::AmountBelowFees => status(
            Code::FailedPrecondition,
            "AMOUNT_BELOW_FEES",
            "el monto no cubre las comisiones",
        ),
        D::SplitsMismatch => status(
            Code::InvalidArgument,
            "SPLITS_MISMATCH",
            "los repartos no suman el monto",
        ),
        D::FeePolicyMissing => status(
            Code::FailedPrecondition,
            "FEE_POLICY_MISSING",
            "no hay política de comisión vigente",
        ),
        D::InvalidFeePolicy => status(
            Code::InvalidArgument,
            "INVALID_FEE_POLICY",
            "política de comisión inválida",
        ),
        D::InvalidStateTransition => status(
            Code::FailedPrecondition,
            "INVALID_STATE_TRANSITION",
            "el cobro no admite esa operación en su estado",
        ),
        D::InvalidMetadata => status(
            Code::InvalidArgument,
            "INVALID_METADATA",
            "metadatos inválidos",
        ),
        D::InvalidReference => status(
            Code::InvalidArgument,
            "INVALID_REFERENCE",
            "referencia inválida",
        ),
        D::IdempotencyKeyRequired => status(
            Code::InvalidArgument,
            "IDEMPOTENCY_KEY_REQUIRED",
            "falta la clave de idempotencia (16 a 100 caracteres)",
        ),
        D::RefundExceedsCaptured => status(
            Code::FailedPrecondition,
            "REFUND_EXCEEDS_CAPTURED",
            "el reembolso supera lo capturado",
        ),
        D::Overflow => status(
            Code::FailedPrecondition,
            "AMOUNT_OUT_OF_RANGE",
            "monto fuera del rango permitido",
        ),
    }
}

fn internal(
    rpc: &'static str,
    request_id: &str,
    kind: &'static str,
    err: &dyn std::fmt::Display,
) -> Status {
    tracing::error!(rpc, request_id, error.type = kind, err = %err, "rpc failed");
    Status::internal("internal error")
}

pub fn to_status(err: Error, rpc: &'static str, request_id: &str) -> Status {
    match err {
        Error::Domain(d) => domain(d),
        Error::Store(StoreError::IdempotencyKeyReused) => status(
            Code::AlreadyExists,
            "IDEMPOTENCY_KEY_REUSED",
            "la clave de idempotencia ya se usó con otra operación",
        ),
        Error::Store(StoreError::NotFound) | Error::NotFound => {
            status(Code::NotFound, "NOT_FOUND", "no encontrado")
        }
        Error::Store(StoreError::InvalidStateTransition) => {
            domain(DomainError::InvalidStateTransition)
        }
        Error::Store(e) => internal(rpc, request_id, "store", &e),
        Error::Dependency(e) if e.is_ambiguous() => {
            tracing::warn!(rpc, request_id, err = %e, "dependency unavailable");
            status(
                Code::Unavailable,
                "DEPENDENCY_UNAVAILABLE",
                "servicio no disponible, intenta de nuevo",
            )
        }
        Error::Dependency(e @ DependencyError::Misconfigured { .. }) => {
            tracing::error!(rpc, request_id, error.type = "config", err = %e, "dependency misconfigured");
            status(
                Code::Unavailable,
                "DEPENDENCY_UNAVAILABLE",
                "servicio no disponible, intenta de nuevo",
            )
        }
        Error::Dependency(e) => internal(rpc, request_id, "dependency", &e),
        Error::PermissionDenied => {
            status(Code::PermissionDenied, "PERMISSION_DENIED", "sin permiso")
        }
        Error::PaymentNotCaptured => status(
            Code::FailedPrecondition,
            "PAYMENT_NOT_CAPTURED",
            "el pago no está capturado",
        ),
        Error::RefundSplitRequired => status(
            Code::InvalidArgument,
            "REFUND_SPLIT_REQUIRED",
            "indica el comercio cuyo split se reembolsa",
        ),
        Error::MerchantBalanceInsufficient => status(
            Code::FailedPrecondition,
            "MERCHANT_BALANCE_INSUFFICIENT",
            "el comercio no tiene saldo para el reembolso",
        ),
        Error::TenantNotActive => status(
            Code::FailedPrecondition,
            "TENANT_NOT_ACTIVE",
            "el negocio no puede cobrar todavía",
        ),
        Error::StepUpRequired => status(
            Code::FailedPrecondition,
            "STEP_UP_REQUIRED",
            "confirma la operación",
        ),
        Error::StepUpInvalid(_) => status(
            Code::FailedPrecondition,
            "STEP_UP_INVALID",
            "la confirmación no es válida",
        ),
        Error::RailDisabled => status(
            Code::FailedPrecondition,
            "RAIL_DISABLED",
            "este medio de pago no está disponible",
        ),
        Error::TerminalInactive => status(
            Code::FailedPrecondition,
            "TERMINAL_INACTIVE",
            "este código de cobro está desactivado",
        ),
        Error::InsufficientFunds => status(
            Code::FailedPrecondition,
            "INSUFFICIENT_FUNDS",
            "saldo insuficiente",
        ),
        Error::InvalidExpiration => status(
            Code::InvalidArgument,
            "INVALID_EXPIRATION",
            "la vigencia debe ser de 1 segundo a 24 horas",
        ),
        Error::EvidenceRequired => status(
            Code::InvalidArgument,
            "EVIDENCE_REQUIRED",
            "la resolución necesita evidencia",
        ),
        Error::SelfTransfer => status(
            Code::InvalidArgument,
            "SELF_TRANSFER",
            "no puedes enviarte dinero a ti mismo",
        ),
        Error::InvalidLabel => status(
            Code::InvalidArgument,
            "INVALID_LABEL",
            "el nombre debe tener de 1 a 60 caracteres",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reason(s: &Status) -> String {
        s.get_error_details()
            .error_info()
            .map(|i| i.reason.clone())
            .unwrap_or_default()
    }

    /// observability-standards §15: un defecto responde INTERNAL genérico; la causa nunca llega
    /// al cliente.
    #[test]
    fn obs_defect_does_not_leak_its_cause() {
        let s = to_status(
            Error::Store(StoreError::Db(sqlx::Error::Protocol(
                "secret column 4111".into(),
            ))),
            "ConfirmPaymentIntent",
            "req-1",
        );
        assert_eq!(s.code(), Code::Internal);
        assert_eq!(s.message(), "internal error");
        assert!(!format!("{s:?}").contains("4111"));
    }

    #[test]
    fn domain_errors_carry_their_reason() {
        let s = to_status(Error::InsufficientFunds, "ConfirmPaymentIntent", "r");
        assert_eq!(s.code(), Code::FailedPrecondition);
        assert_eq!(reason(&s), "INSUFFICIENT_FUNDS");
        assert_eq!(
            reason(&to_status(Error::TenantNotActive, "x", "r")),
            "TENANT_NOT_ACTIVE"
        );
    }

    /// Una dependencia caída es reintentable (UNAVAILABLE), no un defecto.
    #[test]
    fn ambiguous_dependency_is_unavailable() {
        let e = DependencyError::Ambiguous {
            dep: "ledger",
            code: Code::Unavailable,
            message: "connection refused".into(),
        };
        let s = to_status(Error::Dependency(e), "CreatePaymentIntent", "r");
        assert_eq!(s.code(), Code::Unavailable);
        assert_eq!(reason(&s), "DEPENDENCY_UNAVAILABLE");
        assert!(!s.message().contains("refused"));
    }
}
