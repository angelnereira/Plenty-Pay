//! Adaptadores de riel (SPEC §6). Sin credenciales de un riel en security, el riel corre en
//! **sandbox** (R13): no mueve dinero real y todo pago que pasa por él lleva `sandbox=true`.
//! Hoy ningún riel externo tiene credenciales (Q-02, Q-03), así que todos son sandbox.
//!
//! El sandbox es determinista para poder probar cada camino (domain-model §6.3) con un monto:
//! - centavos `13`: el riel no responde a tiempo (ambiguo) y la consulta posterior lo aprueba;
//! - centavos `66`: el riel rechaza (`SANDBOX_DECLINED`);
//! - centavos `99`: ambiguo y la consulta lo rechaza;
//! - cualquier otro monto: aprobado.

use sha2::{Digest, Sha256};

/// Resultado de un riel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RailOutcome {
    Approved { external_ref: String },
    Declined { code: String },
}

/// Fallo al hablar con el riel.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RailError {
    /// Timeout o respuesta ambigua: puede haber cobrado (R7 → UNKNOWN).
    #[error("rail ambiguous: {0}")]
    Ambiguous(String),
}

/// Riel externo por código de `common.PaymentRail`, con la flag que lo habilita (R17).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RailSpec {
    pub code: i16,
    pub name: &'static str,
    pub flag: &'static str,
}

/// Rieles externos conocidos. CARD, APPLE_PAY, GOOGLE_PAY y QR_INTEROP no tienen flag sembrada en
/// infra-management: quedan deshabilitados (`RAIL_DISABLED`) hasta tener PSP (N-PAG-01, Q-03, Q-05).
pub const EXTERNAL_RAILS: &[RailSpec] = &[
    RailSpec {
        code: 2,
        name: "YAPPY",
        flag: "rail.yappy.enabled",
    },
    RailSpec {
        code: 3,
        name: "TELERED_CLAVE",
        flag: "rail.ach.enabled",
    },
    RailSpec {
        code: 4,
        name: "CARD",
        flag: "rail.card.enabled",
    },
    RailSpec {
        code: 5,
        name: "APPLE_PAY",
        flag: "rail.apple_pay.enabled",
    },
    RailSpec {
        code: 6,
        name: "GOOGLE_PAY",
        flag: "rail.google_pay.enabled",
    },
    RailSpec {
        code: 7,
        name: "QR_INTEROP",
        flag: "rail.qr_interop.enabled",
    },
];

pub fn external(code: i16) -> Option<RailSpec> {
    EXTERNAL_RAILS.iter().copied().find(|r| r.code == code)
}

/// Doble sandbox del trait `RailAdapter` (SPEC §6): `start` y `query` con la misma clave de
/// idempotencia del riel (`pay:<payment_id>`) dan siempre el mismo resultado.
#[derive(Debug, Clone, Copy, Default)]
pub struct SandboxRail;

fn external_ref(rail: &str, key: &str) -> String {
    let digest = Sha256::digest(format!("{rail}:{key}").as_bytes());
    let hex: String = digest.iter().take(8).map(|b| format!("{b:02x}")).collect();
    format!("sbx_{hex}")
}

impl SandboxRail {
    /// Inicia el cobro.
    pub fn start(
        &self,
        rail: RailSpec,
        key: &str,
        amount_minor: i64,
    ) -> Result<RailOutcome, RailError> {
        match amount_minor.rem_euclid(100) {
            13 | 99 => Err(RailError::Ambiguous("sandbox timeout".into())),
            66 => Ok(RailOutcome::Declined {
                code: "SANDBOX_DECLINED".into(),
            }),
            _ => Ok(RailOutcome::Approved {
                external_ref: external_ref(rail.name, key),
            }),
        }
    }

    /// Consulta activa de un cobro ambiguo (protocolo UNKNOWN).
    pub fn query(
        &self,
        rail: RailSpec,
        key: &str,
        amount_minor: i64,
    ) -> Result<RailOutcome, RailError> {
        match amount_minor.rem_euclid(100) {
            66 | 99 => Ok(RailOutcome::Declined {
                code: "SANDBOX_DECLINED".into(),
            }),
            _ => Ok(RailOutcome::Approved {
                external_ref: external_ref(rail.name, key),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const YAPPY: RailSpec = RailSpec {
        code: 2,
        name: "YAPPY",
        flag: "rail.yappy.enabled",
    };

    #[test]
    fn r7_sandbox_timeout_is_ambiguous_and_query_resolves() {
        let r = SandboxRail;
        assert!(matches!(
            r.start(YAPPY, "pay:1", 1013),
            Err(RailError::Ambiguous(_))
        ));
        assert!(matches!(
            r.query(YAPPY, "pay:1", 1013),
            Ok(RailOutcome::Approved { .. })
        ));
        assert!(matches!(
            r.query(YAPPY, "pay:1", 1099),
            Ok(RailOutcome::Declined { .. })
        ));
    }

    #[test]
    fn r13_sandbox_is_deterministic_per_key() {
        let r = SandboxRail;
        assert_eq!(r.start(YAPPY, "pay:1", 1000), r.query(YAPPY, "pay:1", 1000));
        assert_ne!(r.start(YAPPY, "pay:1", 1000), r.start(YAPPY, "pay:2", 1000));
        assert_eq!(
            r.start(YAPPY, "pay:1", 1066),
            Ok(RailOutcome::Declined {
                code: "SANDBOX_DECLINED".into()
            })
        );
    }

    #[test]
    fn r17_every_external_rail_has_a_flag() {
        assert_eq!(external(2).map(|r| r.flag), Some("rail.yappy.enabled"));
        assert_eq!(external(1), None, "WALLET no es un riel externo");
    }
}
