//! Clientes de los contenedores de los que depende payments-core (SPEC §8): ledger (holds y
//! asientos), identity (estado del negocio, step-up) e infra-management (límites y flags). Cada
//! llamada lleva `x-pp-actor-service = payments-core` y el `x-pp-request-id` de quien la originó, y
//! tiene su propio plazo. Un fallo se clasifica en definitivo (con su `reason`) o ambiguo (R7).

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tonic::metadata::MetadataValue;
use tonic::transport::{Channel, Endpoint};
use tonic::{Code, Request, Status};
use tonic_types::StatusExt;
use uuid::Uuid;

use crate::pb::identity::identity_client::IdentityClient;
use crate::pb::infra::infra_management_client::InfraManagementClient;
use crate::pb::ledger::ledger_client::LedgerClient;
use crate::pb::{identity, infra, ledger, Reference};

/// Fallo de una dependencia.
#[derive(Debug, thiserror::Error)]
pub enum DependencyError {
    /// La dependencia respondió que no: no cambiará al reintentar.
    #[error("{dep} rejected: {reason}")]
    Definitive {
        dep: &'static str,
        code: Code,
        reason: String,
    },
    /// No sabemos qué pasó (caída, plazo vencido, error interno): puede haber surtido efecto.
    #[error("{dep} ambiguous: {code:?} {message}")]
    Ambiguous {
        dep: &'static str,
        code: Code,
        message: String,
    },
    #[error("{dep} invalid address: {message}")]
    Address { dep: &'static str, message: String },
    #[error("{dep} misconfigured: {message}")]
    Misconfigured { dep: &'static str, message: String },
}

impl DependencyError {
    pub fn reason(&self) -> &str {
        match self {
            DependencyError::Definitive { reason, .. } => reason,
            _ => "",
        }
    }

    pub fn is_ambiguous(&self) -> bool {
        matches!(self, DependencyError::Ambiguous { .. })
    }
}

fn classify(dep: &'static str, s: Status) -> DependencyError {
    match s.code() {
        Code::Unavailable
        | Code::DeadlineExceeded
        | Code::Internal
        | Code::Unknown
        | Code::Aborted
        | Code::Cancelled
        | Code::ResourceExhausted
        | Code::DataLoss => DependencyError::Ambiguous {
            dep,
            code: s.code(),
            message: s.message().to_string(),
        },
        code => DependencyError::Definitive {
            dep,
            code,
            reason: s
                .get_error_details()
                .error_info()
                .map(|i| i.reason.clone())
                .unwrap_or_default(),
        },
    }
}

fn channel(dep: &'static str, addr: &str, timeout: Duration) -> Result<Channel, DependencyError> {
    Endpoint::from_shared(addr.to_string())
        .map(|e| e.timeout(timeout).connect_timeout(timeout))
        .map(|e| e.connect_lazy())
        .map_err(|e| DependencyError::Address {
            dep,
            message: e.to_string(),
        })
}

fn request<T>(msg: T, request_id: &str) -> Request<T> {
    let mut r = Request::new(msg);
    r.metadata_mut().insert(
        "x-pp-actor-service",
        MetadataValue::from_static("payments-core"),
    );
    if let Ok(v) = MetadataValue::try_from(request_id) {
        r.metadata_mut().insert("x-pp-request-id", v);
    }
    r
}

/// Estado y nombre comercial verificado de un negocio (R2, R16).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TenantInfo {
    pub status: i32,
    pub trade_name: String,
}

pub const TENANT_ACTIVE: i32 = 2;

/// Valores que payments-core lee de infra-management (R15, R17, N-AML-01). Nunca hay valor por
/// defecto en código: si falta un parámetro, el cobro no se hace (AGENTS.md §2.13).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub max_payment_minor: i64,
    pub step_up_threshold_minor: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Flags {
    pub payments_enabled: bool,
    /// `wallet.real_money` (N-AML-01): hasta el registro ante la SBP la wallet es sandbox.
    pub wallet_real_money: bool,
    /// `rail.<nombre>.enabled` de cada riel externo (R17). Una flag desconocida vale `false`.
    pub rails: HashMap<String, bool>,
}

impl Flags {
    pub fn rail_enabled(&self, flag: &str) -> bool {
        self.rails.get(flag).copied().unwrap_or(false)
    }
}

/// Un asiento a pedir al ledger (plantilla de domain-model §5.2).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntryLine {
    pub party_id: String,
    pub account_type: i32,
    pub scope_id: String,
    pub debit: bool,
    pub amount_minor: i64,
}

pub const LIMIT_MAX_PAYMENT: &str = "limits.payment.max_minor";
pub const LIMIT_STEP_UP: &str = "stepup.threshold_minor";
pub const FLAG_PAYMENTS: &str = "payments.enabled";
pub const FLAG_WALLET_REAL_MONEY: &str = "wallet.real_money";

const TENANT_TTL: Duration = Duration::from_secs(60);
const CONFIG_TTL: Duration = Duration::from_secs(60);
const FLAGS_TTL: Duration = Duration::from_secs(30);

/// Una pierna de crédito de CaptureHold.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Leg {
    pub party_id: String,
    pub account_type: i32,
    pub amount_minor: i64,
}

pub struct Clients {
    ledger: LedgerClient<Channel>,
    identity: IdentityClient<Channel>,
    infra: InfraManagementClient<Channel>,
    tenants: Mutex<HashMap<Uuid, (TenantInfo, Instant)>>,
    limits: Mutex<Option<(Limits, Instant)>>,
    flags: Mutex<HashMap<Uuid, (Flags, Instant)>>,
}

impl Clients {
    pub fn new(
        ledger_addr: &str,
        identity_addr: &str,
        infra_addr: &str,
        ledger_timeout: Duration,
        dependency_timeout: Duration,
    ) -> Result<Self, DependencyError> {
        Ok(Clients {
            ledger: LedgerClient::new(channel("ledger", ledger_addr, ledger_timeout)?),
            identity: IdentityClient::new(channel("identity", identity_addr, dependency_timeout)?),
            infra: InfraManagementClient::new(channel(
                "infra-management",
                infra_addr,
                dependency_timeout,
            )?),
            tenants: Mutex::new(HashMap::new()),
            limits: Mutex::new(None),
            flags: Mutex::new(HashMap::new()),
        })
    }

    // ── ledger ──────────────────────────────────────────────────────────────────────────────

    /// CreateHold idempotente por `hold:<payment_id>` sobre la wallet del pagador.
    #[tracing::instrument(skip_all, err, fields(pp.payment_id = %payment_id))]
    pub async fn create_hold(
        &self,
        request_id: &str,
        payment_id: Uuid,
        payer: Uuid,
        currency: &str,
        amount_minor: i64,
        ttl_seconds: i32,
    ) -> Result<Uuid, DependencyError> {
        let req = ledger::CreateHoldRequest {
            idempotency_key: format!("hold:{payment_id}"),
            account: Some(ledger::AccountRef {
                party_id: payer.to_string(),
                r#type: ledger::AccountType::Wallet as i32,
                currency: currency.to_string(),
                scope_id: String::new(),
            }),
            amount_minor,
            reference: Some(Reference {
                r#type: "payment".into(),
                id: payment_id.to_string(),
            }),
            ttl_seconds,
        };
        let hold = self
            .ledger
            .clone()
            .create_hold(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?
            .into_inner();
        Uuid::parse_str(&hold.hold_id).map_err(|e| DependencyError::Misconfigured {
            dep: "ledger",
            message: format!("hold_id: {e}"),
        })
    }

    /// CaptureHold con asiento T3 (`WALLET_PAYMENT`) y clave `pay:<payment_id>` (R9): el ledger
    /// debita la wallet y acredita las piernas en una sola transacción. Devuelve el id del asiento.
    #[tracing::instrument(skip_all, err, fields(pp.payment_id = %payment_id))]
    pub async fn capture_hold(
        &self,
        request_id: &str,
        payment_id: Uuid,
        hold_id: Uuid,
        tenant_id: Uuid,
        currency: &str,
        legs: &[Leg],
    ) -> Result<Uuid, DependencyError> {
        let req = ledger::CaptureHoldRequest {
            hold_id: hold_id.to_string(),
            idempotency_key: format!("pay:{payment_id}"),
            tenant_id: tenant_id.to_string(),
            transaction_type: "WALLET_PAYMENT".into(),
            reference: Some(Reference {
                r#type: "payment".into(),
                id: payment_id.to_string(),
            }),
            legs: legs
                .iter()
                .map(|l| ledger::CreditLeg {
                    account: Some(ledger::AccountRef {
                        party_id: l.party_id.clone(),
                        r#type: l.account_type,
                        currency: currency.to_string(),
                        scope_id: String::new(),
                    }),
                    amount_minor: l.amount_minor,
                })
                .collect(),
        };
        let resp = self
            .ledger
            .clone()
            .capture_hold(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?
            .into_inner();
        let tx = resp
            .transaction
            .ok_or_else(|| DependencyError::Misconfigured {
                dep: "ledger",
                message: "capture without transaction".into(),
            })?;
        Uuid::parse_str(&tx.transaction_id).map_err(|e| DependencyError::Misconfigured {
            dep: "ledger",
            message: format!("transaction_id: {e}"),
        })
    }

    /// PostTransaction idempotente por [key] (R8: `topup:<payment_id>` T1, `pay:<payment_id>` T2).
    #[tracing::instrument(skip_all, err, fields(pp.transaction_type = transaction_type))]
    #[allow(clippy::too_many_arguments)]
    pub async fn post_transaction(
        &self,
        request_id: &str,
        key: &str,
        tenant_id: Option<Uuid>,
        transaction_type: &str,
        reference: (&str, &str),
        currency: &str,
        entries: &[EntryLine],
    ) -> Result<Uuid, DependencyError> {
        let req = ledger::PostTransactionRequest {
            idempotency_key: key.to_string(),
            tenant_id: tenant_id.map(|t| t.to_string()).unwrap_or_default(),
            transaction_type: transaction_type.to_string(),
            reference: Some(Reference {
                r#type: reference.0.to_string(),
                id: reference.1.to_string(),
            }),
            currency: currency.to_string(),
            description: String::new(),
            entries: entries
                .iter()
                .map(|e| ledger::EntryInput {
                    account: Some(ledger::AccountRef {
                        party_id: e.party_id.clone(),
                        r#type: e.account_type,
                        currency: currency.to_string(),
                        scope_id: e.scope_id.clone(),
                    }),
                    side: if e.debit {
                        ledger::EntrySide::Debit as i32
                    } else {
                        ledger::EntrySide::Credit as i32
                    },
                    amount_minor: e.amount_minor,
                })
                .collect(),
            effective_at: None,
        };
        let tx = self
            .ledger
            .clone()
            .post_transaction(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?
            .into_inner();
        Uuid::parse_str(&tx.transaction_id).map_err(|e| DependencyError::Misconfigured {
            dep: "ledger",
            message: format!("transaction_id: {e}"),
        })
    }

    /// ReleaseHold idempotente (un hold ya terminado se devuelve sin cambio).
    #[tracing::instrument(skip_all, err, fields(pp.hold_id = %hold_id))]
    pub async fn release_hold(
        &self,
        request_id: &str,
        hold_id: Uuid,
    ) -> Result<(), DependencyError> {
        let req = ledger::ReleaseHoldRequest {
            hold_id: hold_id.to_string(),
            idempotency_key: format!("release:{hold_id}"),
        };
        self.ledger
            .clone()
            .release_hold(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?;
        Ok(())
    }

    // ── identity ────────────────────────────────────────────────────────────────────────────

    /// R2: estado del negocio con caché de 60 s (si no hay proyección local).
    #[tracing::instrument(skip_all, err, fields(pp.tenant_id = %tenant_id))]
    pub async fn tenant(
        &self,
        request_id: &str,
        tenant_id: Uuid,
    ) -> Result<TenantInfo, DependencyError> {
        if let Ok(cache) = self.tenants.lock() {
            if let Some((info, at)) = cache.get(&tenant_id) {
                if at.elapsed() < TENANT_TTL {
                    return Ok(info.clone());
                }
            }
        }
        let t = self
            .identity
            .clone()
            .get_tenant(request(
                identity::GetTenantRequest {
                    tenant_id: tenant_id.to_string(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("identity", s))?
            .into_inner();
        let info = TenantInfo {
            status: t.status,
            trade_name: if t.trade_name.is_empty() {
                t.legal_name
            } else {
                t.trade_name
            },
        };
        if let Ok(mut cache) = self.tenants.lock() {
            cache.insert(tenant_id, (info.clone(), Instant::now()));
        }
        Ok(info)
    }

    /// R5: consume el token de confirmación fuerte atado a la operación exacta. Devuelve el
    /// motivo del rechazo (`EXPIRED`, `ALREADY_USED`, `MISMATCH`, `NOT_FOUND`) o `None` si vale.
    #[tracing::instrument(skip_all, err)]
    pub async fn consume_step_up(
        &self,
        request_id: &str,
        token: &str,
        user_id: Uuid,
        operation: &str,
        amount_minor: i64,
        currency: &str,
    ) -> Result<Option<String>, DependencyError> {
        let r = self
            .identity
            .clone()
            .consume_step_up(request(
                identity::ConsumeStepUpRequest {
                    token: token.to_string(),
                    user_id: user_id.to_string(),
                    operation: operation.to_string(),
                    amount_minor,
                    currency: currency.to_string(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("identity", s))?
            .into_inner();
        Ok(if r.valid { None } else { Some(r.reason) })
    }

    // ── infra-management ────────────────────────────────────────────────────────────────────

    /// R15 y umbral de step-up, con caché de 60 s.
    #[tracing::instrument(skip_all, err)]
    pub async fn limits(&self, request_id: &str) -> Result<Limits, DependencyError> {
        if let Ok(cache) = self.limits.lock() {
            if let Some((l, at)) = cache.as_ref() {
                if at.elapsed() < CONFIG_TTL {
                    return Ok(*l);
                }
            }
        }
        let resp = self
            .infra
            .clone()
            .get_config(request(
                infra::GetConfigRequest {
                    keys: vec![LIMIT_MAX_PAYMENT.into(), LIMIT_STEP_UP.into()],
                    scope: "global".into(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("infra-management", s))?
            .into_inner();
        let value = |key: &str| -> Result<i64, DependencyError> {
            resp.entries
                .iter()
                .find(|e| e.key == key)
                .and_then(|e| e.value.trim().parse::<i64>().ok())
                .filter(|v| *v >= 0)
                .ok_or_else(|| DependencyError::Misconfigured {
                    dep: "infra-management",
                    message: format!("{key} missing or not an integer"),
                })
        };
        let l = Limits {
            max_payment_minor: value(LIMIT_MAX_PAYMENT)?,
            step_up_threshold_minor: value(LIMIT_STEP_UP)?,
        };
        if let Ok(mut cache) = self.limits.lock() {
            *cache = Some((l, Instant::now()));
        }
        Ok(l)
    }

    /// R17 y N-AML-01, con caché de 30 s por negocio. Una flag desconocida vale `false`.
    #[tracing::instrument(skip_all, err)]
    pub async fn flags(&self, request_id: &str, tenant_id: Uuid) -> Result<Flags, DependencyError> {
        if let Ok(cache) = self.flags.lock() {
            if let Some((f, at)) = cache.get(&tenant_id) {
                if at.elapsed() < FLAGS_TTL {
                    return Ok(f.clone());
                }
            }
        }
        let resp = self
            .infra
            .clone()
            .evaluate_flags(request(
                infra::EvaluateFlagsRequest {
                    keys: [FLAG_PAYMENTS, FLAG_WALLET_REAL_MONEY]
                        .into_iter()
                        .chain(crate::rails::EXTERNAL_RAILS.iter().map(|r| r.flag))
                        .map(str::to_string)
                        .collect(),
                    context: Some(infra::FlagContext {
                        tenant_id: tenant_id.to_string(),
                        ..Default::default()
                    }),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("infra-management", s))?
            .into_inner();
        let f = Flags {
            payments_enabled: resp.values.get(FLAG_PAYMENTS).copied().unwrap_or(false),
            wallet_real_money: resp
                .values
                .get(FLAG_WALLET_REAL_MONEY)
                .copied()
                .unwrap_or(false),
            rails: crate::rails::EXTERNAL_RAILS
                .iter()
                .map(|r| {
                    (
                        r.flag.to_string(),
                        resp.values.get(r.flag).copied().unwrap_or(false),
                    )
                })
                .collect(),
        };
        if let Ok(mut cache) = self.flags.lock() {
            cache.insert(tenant_id, (f.clone(), Instant::now()));
        }
        Ok(f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tonic_types::{ErrorDetails, StatusExt};

    /// R7: caída, plazo vencido o error interno de la dependencia son ambiguos (nunca FAILED).
    #[test]
    fn r7_unavailable_and_deadline_are_ambiguous() {
        for code in [Code::Unavailable, Code::DeadlineExceeded, Code::Internal] {
            assert!(classify("ledger", Status::new(code, "x")).is_ambiguous());
        }
    }

    #[test]
    fn definitive_errors_keep_their_reason() {
        let s = Status::with_error_details(
            Code::FailedPrecondition,
            "saldo insuficiente",
            ErrorDetails::with_error_info("INSUFFICIENT_FUNDS", "plentypay", HashMap::new()),
        );
        let e = classify("ledger", s);
        assert!(!e.is_ambiguous());
        assert_eq!(e.reason(), "INSUFFICIENT_FUNDS");
    }
}
