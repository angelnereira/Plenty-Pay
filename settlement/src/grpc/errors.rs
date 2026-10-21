//! Único punto que traduce errores a `tonic::Status` con `ErrorInfo.reason` (grpc-conventions §4).
//! Un defecto se registra UNA vez aquí (borde) con su `request_id` y el cliente solo recibe
//! `INTERNAL` genérico (AGENTS.md §2.14, §2.15).

use std::collections::HashMap;

use tonic::{Code, Status};
use tonic_types::{ErrorDetails, StatusExt};

use crate::domain::DomainError;
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
        D::NothingToSettle => status(
            Code::FailedPrecondition,
            "NOTHING_TO_SETTLE",
            "no hay nada por liquidar",
        ),
        D::BelowMinimum => status(
            Code::FailedPrecondition,
            "BELOW_MINIMUM",
            "lo disponible no alcanza el mínimo de liquidación",
        ),
        D::SandboxFunds => status(
            Code::FailedPrecondition,
            "SANDBOX_FUNDS",
            "los cobros de prueba solo se liquidan a la billetera del negocio",
        ),
        D::PayoutsBlocked => status(
            Code::FailedPrecondition,
            "PAYOUTS_BLOCKED",
            "los pagos están detenidos 48 horas tras cambiar la cuenta de destino",
        ),
        D::InvalidDestination => status(
            Code::InvalidArgument,
            "INVALID_DESTINATION",
            "el titular no coincide con el negocio",
        ),
        D::BankFundsPending => status(
            Code::FailedPrecondition,
            "BANK_FUNDS_PENDING",
            "la cuenta de PlentyPay aún no registra el depósito del riel para este pago",
        ),
        D::InvalidArgument => status(Code::InvalidArgument, "INVALID_ARGUMENT", "datos inválidos"),
        D::InvalidStateTransition => status(
            Code::FailedPrecondition,
            "INVALID_STATE_TRANSITION",
            "el lote no admite esa operación en su estado",
        ),
        D::IdempotencyKeyRequired => status(
            Code::InvalidArgument,
            "IDEMPOTENCY_KEY_REQUIRED",
            "falta la clave de idempotencia (16 a 100 caracteres)",
        ),
        D::Overflow => status(
            Code::FailedPrecondition,
            "AMOUNT_OUT_OF_RANGE",
            "monto fuera de rango",
        ),
    }
}

pub fn to_status(err: Error, rpc: &'static str, request_id: &str) -> Status {
    match err {
        Error::Domain(d) => domain(d),
        Error::PermissionDenied => {
            status(Code::PermissionDenied, "PERMISSION_DENIED", "sin permiso")
        }
        Error::StepUpRequired => status(
            Code::PermissionDenied,
            "STEP_UP_REQUIRED",
            "confirma con tu PIN o tu passkey",
        ),
        Error::StepUpInvalid(_) => status(
            Code::PermissionDenied,
            "STEP_UP_INVALID",
            "la confirmación no es válida",
        ),
        Error::NotFound | Error::Store(StoreError::NotFound) => {
            status(Code::NotFound, "NOT_FOUND", "no encontrado")
        }
        Error::Store(StoreError::InvalidStateTransition) => {
            domain(DomainError::InvalidStateTransition)
        }
        Error::Store(StoreError::IdempotencyKeyReused) => status(
            Code::AlreadyExists,
            "IDEMPOTENCY_KEY_REUSED",
            "la clave de idempotencia ya se usó con otra operación",
        ),
        Error::Store(StoreError::Conflict) => status(
            Code::Aborted,
            "CONCURRENT_BATCH",
            "otro lote tomó estas partidas; intenta de nuevo",
        ),
        Error::Dependency(e) if e.is_ambiguous() => {
            tracing::warn!(rpc, request_id, err = %e, "dependency unavailable");
            status(
                Code::Unavailable,
                "DEPENDENCY_UNAVAILABLE",
                "servicio no disponible, intenta de nuevo",
            )
        }
        Error::Dependency(e) => {
            tracing::error!(rpc, request_id, error.type = "dependency", err = %e, "rpc failed");
            Status::internal("internal error")
        }
        Error::Store(e) => {
            tracing::error!(rpc, request_id, error.type = "store", err = %e, "rpc failed");
            Status::internal("internal error")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tonic_types::StatusExt;

    fn reason(s: &Status) -> String {
        s.get_error_details()
            .error_info()
            .map(|i| i.reason.clone())
            .unwrap_or_default()
    }

    /// observability-standards §10: los rechazos de dominio llevan su `reason`; un defecto, INTERNAL
    /// sin detalle.
    #[test]
    fn obs_errors_carry_stable_reason() {
        for (e, code, r) in [
            (
                Error::Domain(DomainError::NothingToSettle),
                Code::FailedPrecondition,
                "NOTHING_TO_SETTLE",
            ),
            (
                Error::Domain(DomainError::BelowMinimum),
                Code::FailedPrecondition,
                "BELOW_MINIMUM",
            ),
            (
                Error::Domain(DomainError::SandboxFunds),
                Code::FailedPrecondition,
                "SANDBOX_FUNDS",
            ),
            (
                Error::Domain(DomainError::PayoutsBlocked),
                Code::FailedPrecondition,
                "PAYOUTS_BLOCKED",
            ),
            (
                Error::Domain(DomainError::InvalidDestination),
                Code::InvalidArgument,
                "INVALID_DESTINATION",
            ),
            (
                Error::StepUpRequired,
                Code::PermissionDenied,
                "STEP_UP_REQUIRED",
            ),
            (Error::NotFound, Code::NotFound, "NOT_FOUND"),
        ] {
            let s = to_status(e, "Test", "req-1");
            assert_eq!((s.code(), reason(&s).as_str()), (code, r));
        }
        let s = to_status(
            Error::Store(StoreError::Corrupt("detalle interno".into())),
            "Test",
            "req-1",
        );
        assert_eq!(s.code(), Code::Internal);
        assert!(!s.message().contains("detalle"), "AGENTS.md §2.15");
    }
}
