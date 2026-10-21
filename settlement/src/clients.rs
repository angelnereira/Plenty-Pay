//! Clientes de los contenedores de los que depende settlement (SPEC §7): ledger (extracto, saldo y
//! asientos T6/T6b), payments-core (¿el cobro fue de prueba?), identity (datos del negocio y step-up)
//! y security (cifrado del destino). Cada llamada lleva `x-pp-actor-service = settlement` y el
//! `x-pp-request-id` de quien la originó, con su propio plazo. Un fallo es definitivo (con su
//! `reason`) o ambiguo (puede haber surtido efecto: se reintenta con la misma clave).

use std::time::Duration;

use chrono::{DateTime, Utc};
use tonic::metadata::MetadataValue;
use tonic::transport::{Channel, Endpoint};
use tonic::{Code, Request, Status};
use tonic_types::StatusExt;
use uuid::Uuid;

use crate::domain::{ItemKind, Line, DEST_WALLET};
use crate::pb::identity::identity_client::IdentityClient;
use crate::pb::ledger::ledger_client::LedgerClient;
use crate::pb::payments::payments_client::PaymentsClient;
use crate::pb::security::security_client::SecurityClient;
use crate::pb::{identity, ledger, payments, security, PageRequest, Reference, TimeRange};

/// PLATFORM (domain-model §2): dueño de BANK_CASH.
pub const PLATFORM_PARTY: &str = "00000000-0000-0000-0000-000000000001";

#[derive(Debug, thiserror::Error)]
pub enum DependencyError {
    #[error("{dep} rejected: {reason}")]
    Definitive {
        dep: &'static str,
        code: Code,
        reason: String,
    },
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
    pub fn is_ambiguous(&self) -> bool {
        matches!(self, DependencyError::Ambiguous { .. })
    }

    pub fn reason(&self) -> &str {
        match self {
            DependencyError::Definitive { reason, .. } => reason,
            _ => "",
        }
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
        MetadataValue::from_static("settlement"),
    );
    if let Ok(v) = MetadataValue::try_from(request_id) {
        r.metadata_mut().insert("x-pp-request-id", v);
    }
    r
}

fn ts(t: DateTime<Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp {
        seconds: t.timestamp(),
        nanos: i32::try_from(t.timestamp_subsec_nanos()).unwrap_or(0),
    }
}

fn from_ts(t: Option<&prost_types::Timestamp>) -> Option<DateTime<Utc>> {
    let t = t?;
    DateTime::from_timestamp(t.seconds, u32::try_from(t.nanos).unwrap_or(0))
}

fn merchant_payable(tenant: Uuid, currency: &str) -> ledger::AccountRef {
    ledger::AccountRef {
        party_id: tenant.to_string(),
        r#type: ledger::AccountType::MerchantPayable as i32,
        currency: currency.to_string(),
        scope_id: String::new(),
    }
}

/// Un movimiento del extracto de `MERCHANT_PAYABLE` sin la marca de prueba (la pone el servicio).
#[derive(Debug, Clone)]
pub struct PayableMovement {
    pub ledger_transaction_id: Uuid,
    pub transaction_type: String,
    pub credit: bool,
    pub amount_minor: i64,
    pub reference: Reference,
    pub occurred_at: DateTime<Utc>,
}

impl PayableMovement {
    /// Un cobro acreditado o un reembolso descontado; los pagos al comercio (PAYOUT) y cualquier otro
    /// tipo no son partidas de un lote.
    pub fn as_line(&self, sandbox: bool) -> Option<Line> {
        let kind = match (self.transaction_type.as_str(), self.credit) {
            ("PAYMENT_CAPTURE" | "WALLET_PAYMENT", true) if self.reference.r#type == "payment" => {
                ItemKind::Payment
            }
            ("REFUND", false) if self.reference.r#type == "refund" => ItemKind::Refund,
            _ => return None,
        };
        Some(Line {
            ledger_transaction_id: self.ledger_transaction_id,
            kind,
            reference_type: self.reference.r#type.clone(),
            reference_id: self.reference.id.clone(),
            amount_minor: self.amount_minor,
            occurred_at: self.occurred_at,
            sandbox,
        })
    }
}

#[derive(Clone)]
pub struct Clients {
    ledger: LedgerClient<Channel>,
    payments: PaymentsClient<Channel>,
    identity: IdentityClient<Channel>,
    security: SecurityClient<Channel>,
}

/// Lo que settlement necesita de sus dependencias; las pruebas lo implementan con dobles.
#[tonic::async_trait]
pub trait Deps: Send + Sync {
    /// Movimientos de `MERCHANT_PAYABLE(tenant)` en `[from, to)`, en orden cronológico.
    async fn payable_movements(
        &self,
        request_id: &str,
        tenant: Uuid,
        currency: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<PayableMovement>, DependencyError>;
    /// Disponible en `MERCHANT_PAYABLE(tenant)` (asentado − retenido).
    async fn payable_available(
        &self,
        request_id: &str,
        tenant: Uuid,
        currency: &str,
    ) -> Result<i64, DependencyError>;
    /// ¿El cobro de esta partida fue de prueba? (cobro o reembolso de un cobro).
    async fn is_sandbox(
        &self,
        request_id: &str,
        kind: ItemKind,
        reference_id: &str,
    ) -> Result<bool, DependencyError>;
    /// Asiento T6 (banco) o T6b (billetera) idempotente por `payout:<batch_id>`.
    async fn post_payout(
        &self,
        request_id: &str,
        batch_id: Uuid,
        tenant: Uuid,
        currency: &str,
        amount_minor: i64,
        destination_kind: &str,
    ) -> Result<Uuid, DependencyError>;
    /// Razón social y nombre comercial: titulares aceptados del destino bancario.
    async fn tenant_names(
        &self,
        request_id: &str,
        tenant: Uuid,
    ) -> Result<Vec<String>, DependencyError>;
    /// Consume un token de step-up; `Ok(None)` si es válido, `Ok(Some(reason))` si no.
    async fn consume_step_up(
        &self,
        request_id: &str,
        token: &str,
        user: Uuid,
        operation: &str,
    ) -> Result<Option<String>, DependencyError>;
    /// Cifra el número de cuenta con el propósito `payout_destination` (AAD `<tenant>|payout`).
    async fn encrypt_destination(
        &self,
        request_id: &str,
        tenant: Uuid,
        plaintext: &[u8],
    ) -> Result<(Vec<u8>, String), DependencyError>;
}

impl Clients {
    pub fn new(
        ledger_addr: &str,
        payments_addr: &str,
        identity_addr: &str,
        security_addr: &str,
        ledger_timeout: Duration,
        timeout: Duration,
    ) -> Result<Self, DependencyError> {
        Ok(Self {
            ledger: LedgerClient::new(channel("ledger", ledger_addr, ledger_timeout)?),
            payments: PaymentsClient::new(channel("payments-core", payments_addr, timeout)?),
            identity: IdentityClient::new(channel("identity", identity_addr, timeout)?),
            security: SecurityClient::new(channel("security", security_addr, timeout)?),
        })
    }
}

#[tonic::async_trait]
impl Deps for Clients {
    #[tracing::instrument(skip_all, err, fields(pp.tenant_id = %tenant))]
    async fn payable_movements(
        &self,
        request_id: &str,
        tenant: Uuid,
        currency: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<PayableMovement>, DependencyError> {
        let req = ledger::GetStatementRequest {
            account: Some(merchant_payable(tenant, currency)),
            range: Some(TimeRange {
                from: Some(ts(from)),
                to: Some(ts(to)),
            }),
            page: Some(PageRequest {
                page_size: 200,
                page_token: String::new(),
            }),
        };
        let resp = self
            .ledger
            .clone()
            .get_statement(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?
            .into_inner();
        let mut out = Vec::with_capacity(resp.lines.len());
        for l in resp.lines {
            let entry = l.entry.unwrap_or_default();
            let id =
                Uuid::parse_str(&l.transaction_id).map_err(|e| DependencyError::Misconfigured {
                    dep: "ledger",
                    message: format!("transaction_id: {e}"),
                })?;
            out.push(PayableMovement {
                ledger_transaction_id: id,
                transaction_type: l.transaction_type,
                credit: entry.side == ledger::EntrySide::Credit as i32,
                amount_minor: entry.amount_minor,
                reference: l.reference.unwrap_or_default(),
                occurred_at: from_ts(l.effective_at.as_ref()).unwrap_or(from),
            });
        }
        Ok(out)
    }

    #[tracing::instrument(skip_all, err, fields(pp.tenant_id = %tenant))]
    async fn payable_available(
        &self,
        request_id: &str,
        tenant: Uuid,
        currency: &str,
    ) -> Result<i64, DependencyError> {
        let req = ledger::GetBalanceRequest {
            account: Some(merchant_payable(tenant, currency)),
        };
        let b = self
            .ledger
            .clone()
            .get_balance(request(req, request_id))
            .await
            .map_err(|s| classify("ledger", s))?
            .into_inner();
        Ok(b.available_minor)
    }

    #[tracing::instrument(skip_all, err)]
    async fn is_sandbox(
        &self,
        request_id: &str,
        kind: ItemKind,
        reference_id: &str,
    ) -> Result<bool, DependencyError> {
        let payment_id = match kind {
            ItemKind::Payment => reference_id.to_string(),
            ItemKind::Refund => {
                self.payments
                    .clone()
                    .get_refund(request(
                        payments::GetRefundRequest {
                            refund_id: reference_id.to_string(),
                        },
                        request_id,
                    ))
                    .await
                    .map_err(|s| classify("payments-core", s))?
                    .into_inner()
                    .payment_id
            }
        };
        let p = self
            .payments
            .clone()
            .get_payment(request(
                payments::GetPaymentRequest { payment_id },
                request_id,
            ))
            .await
            .map_err(|s| classify("payments-core", s))?
            .into_inner();
        Ok(p.sandbox)
    }

    #[tracing::instrument(skip_all, err, fields(pp.batch_id = %batch_id))]
    async fn post_payout(
        &self,
        request_id: &str,
        batch_id: Uuid,
        tenant: Uuid,
        currency: &str,
        amount_minor: i64,
        destination_kind: &str,
    ) -> Result<Uuid, DependencyError> {
        // T6: D MERCHANT_PAYABLE · C BANK_CASH. T6b: D MERCHANT_PAYABLE · C WALLET(comercio).
        let (transaction_type, credit) = if destination_kind == DEST_WALLET {
            (
                "PAYOUT_TO_WALLET",
                ledger::AccountRef {
                    party_id: tenant.to_string(),
                    r#type: ledger::AccountType::Wallet as i32,
                    currency: currency.to_string(),
                    scope_id: String::new(),
                },
            )
        } else {
            (
                "PAYOUT",
                ledger::AccountRef {
                    party_id: PLATFORM_PARTY.into(),
                    r#type: ledger::AccountType::BankCash as i32,
                    currency: currency.to_string(),
                    scope_id: String::new(),
                },
            )
        };
        let req = ledger::PostTransactionRequest {
            idempotency_key: format!("payout:{batch_id}"),
            tenant_id: tenant.to_string(),
            transaction_type: transaction_type.into(),
            reference: Some(Reference {
                r#type: "settlement_batch".into(),
                id: batch_id.to_string(),
            }),
            currency: currency.to_string(),
            description: String::new(),
            entries: vec![
                ledger::EntryInput {
                    account: Some(merchant_payable(tenant, currency)),
                    side: ledger::EntrySide::Debit as i32,
                    amount_minor,
                },
                ledger::EntryInput {
                    account: Some(credit),
                    side: ledger::EntrySide::Credit as i32,
                    amount_minor,
                },
            ],
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

    #[tracing::instrument(skip_all, err, fields(pp.tenant_id = %tenant))]
    async fn tenant_names(
        &self,
        request_id: &str,
        tenant: Uuid,
    ) -> Result<Vec<String>, DependencyError> {
        let t = self
            .identity
            .clone()
            .get_tenant(request(
                identity::GetTenantRequest {
                    tenant_id: tenant.to_string(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("identity", s))?
            .into_inner();
        Ok(vec![t.legal_name, t.trade_name])
    }

    #[tracing::instrument(skip_all, err)]
    async fn consume_step_up(
        &self,
        request_id: &str,
        token: &str,
        user: Uuid,
        operation: &str,
    ) -> Result<Option<String>, DependencyError> {
        let r = self
            .identity
            .clone()
            .consume_step_up(request(
                identity::ConsumeStepUpRequest {
                    token: token.to_string(),
                    user_id: user.to_string(),
                    operation: operation.to_string(),
                    amount_minor: 0,
                    currency: String::new(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("identity", s))?
            .into_inner();
        Ok((!r.valid).then_some(r.reason))
    }

    #[tracing::instrument(skip_all, err, fields(pp.tenant_id = %tenant))]
    async fn encrypt_destination(
        &self,
        request_id: &str,
        tenant: Uuid,
        plaintext: &[u8],
    ) -> Result<(Vec<u8>, String), DependencyError> {
        let r = self
            .security
            .clone()
            .encrypt(request(
                security::EncryptRequest {
                    key_purpose: "payout_destination".into(),
                    plaintext: plaintext.to_vec(),
                    associated_data: format!("{tenant}|payout").into_bytes(),
                },
                request_id,
            ))
            .await
            .map_err(|s| classify("security", s))?
            .into_inner();
        Ok((r.ciphertext, r.key_version))
    }
}
