//! Máquinas de estado (domain-model.md §8.1 y §8.2). Toda transición fuera de las tablas es
//! `FAILED_PRECONDITION INVALID_STATE_TRANSITION`. Los códigos son los del contrato `payments.proto`.

use crate::domain::errors::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus {
    Created,
    RequiresAction,
    Processing,
    Authorized,
    Captured,
    Failed,
    Cancelled,
    Expired,
    Unknown,
}

impl PaymentStatus {
    pub fn code(self) -> i16 {
        match self {
            PaymentStatus::Created => 1,
            PaymentStatus::RequiresAction => 2,
            PaymentStatus::Processing => 3,
            PaymentStatus::Authorized => 4,
            PaymentStatus::Captured => 5,
            PaymentStatus::Failed => 6,
            PaymentStatus::Cancelled => 7,
            PaymentStatus::Expired => 8,
            PaymentStatus::Unknown => 9,
        }
    }

    pub fn from_code(code: i16) -> Option<Self> {
        Some(match code {
            1 => PaymentStatus::Created,
            2 => PaymentStatus::RequiresAction,
            3 => PaymentStatus::Processing,
            4 => PaymentStatus::Authorized,
            5 => PaymentStatus::Captured,
            6 => PaymentStatus::Failed,
            7 => PaymentStatus::Cancelled,
            8 => PaymentStatus::Expired,
            9 => PaymentStatus::Unknown,
            _ => return None,
        })
    }

    /// Nombre estable para métricas y logs.
    pub fn name(self) -> &'static str {
        match self {
            PaymentStatus::Created => "CREATED",
            PaymentStatus::RequiresAction => "REQUIRES_ACTION",
            PaymentStatus::Processing => "PROCESSING",
            PaymentStatus::Authorized => "AUTHORIZED",
            PaymentStatus::Captured => "CAPTURED",
            PaymentStatus::Failed => "FAILED",
            PaymentStatus::Cancelled => "CANCELLED",
            PaymentStatus::Expired => "EXPIRED",
            PaymentStatus::Unknown => "UNKNOWN",
        }
    }

    /// CAPTURED, FAILED, CANCELLED y EXPIRED no cambian más (CAPTURED admite reembolsos).
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            PaymentStatus::Captured
                | PaymentStatus::Failed
                | PaymentStatus::Cancelled
                | PaymentStatus::Expired
        )
    }

    /// Tabla §8.1.
    pub fn can_transition(self, to: PaymentStatus) -> bool {
        use PaymentStatus::*;
        matches!(
            (self, to),
            (Created, RequiresAction)
                | (Created | RequiresAction, Processing)
                | (Processing, Authorized)
                | (Processing | Authorized, Captured)
                | (Processing | RequiresAction, Failed)
                | (Processing | Authorized, Unknown)
                | (Unknown, Captured | Failed)
                | (Created | RequiresAction | Authorized, Cancelled)
                | (Created | RequiresAction, Expired)
        )
    }

    pub fn transition(self, to: PaymentStatus) -> Result<PaymentStatus, DomainError> {
        if self.can_transition(to) {
            Ok(to)
        } else {
            Err(DomainError::InvalidStateTransition)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttemptStatus {
    Created,
    Processing,
    Authorized,
    Captured,
    Failed,
    Unknown,
}

impl AttemptStatus {
    pub fn code(self) -> i16 {
        match self {
            AttemptStatus::Created => 1,
            AttemptStatus::Processing => 2,
            AttemptStatus::Authorized => 3,
            AttemptStatus::Captured => 4,
            AttemptStatus::Failed => 5,
            AttemptStatus::Unknown => 6,
        }
    }

    pub fn from_code(code: i16) -> Option<Self> {
        Some(match code {
            1 => AttemptStatus::Created,
            2 => AttemptStatus::Processing,
            3 => AttemptStatus::Authorized,
            4 => AttemptStatus::Captured,
            5 => AttemptStatus::Failed,
            6 => AttemptStatus::Unknown,
            _ => return None,
        })
    }

    /// Tabla §8.2.
    pub fn can_transition(self, to: AttemptStatus) -> bool {
        use AttemptStatus::*;
        matches!(
            (self, to),
            (Created, Processing)
                | (Processing, Authorized | Failed | Unknown | Captured)
                | (Authorized, Captured | Unknown)
                | (Unknown, Captured | Failed)
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [PaymentStatus; 9] = [
        PaymentStatus::Created,
        PaymentStatus::RequiresAction,
        PaymentStatus::Processing,
        PaymentStatus::Authorized,
        PaymentStatus::Captured,
        PaymentStatus::Failed,
        PaymentStatus::Cancelled,
        PaymentStatus::Expired,
        PaymentStatus::Unknown,
    ];

    #[test]
    fn state_codes_match_the_contract() {
        for s in ALL {
            assert_eq!(PaymentStatus::from_code(s.code()), Some(s));
        }
        assert_eq!(PaymentStatus::from_code(0), None);
    }

    /// domain-model §8.1: los estados terminales no salen hacia ningún otro estado.
    #[test]
    fn terminal_states_never_move() {
        for from in ALL.into_iter().filter(|s| s.is_terminal()) {
            for to in ALL {
                assert!(!from.can_transition(to), "{from:?} -> {to:?}");
            }
        }
    }

    /// R7: UNKNOWN nunca se resuelve sin consulta; solo a CAPTURED o FAILED.
    #[test]
    fn r7_unknown_resolves_only_to_captured_or_failed() {
        let to: Vec<_> = ALL
            .into_iter()
            .filter(|t| PaymentStatus::Unknown.can_transition(*t))
            .collect();
        assert_eq!(to, vec![PaymentStatus::Captured, PaymentStatus::Failed]);
        assert_eq!(
            PaymentStatus::Created.transition(PaymentStatus::Captured),
            Err(DomainError::InvalidStateTransition)
        );
    }
}
