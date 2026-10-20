//! Casos de uso de payments-core (SPEC §4–§6). Orquesta store, ledger, identity e
//! infra-management. Reglas: R1 (idempotencia), R2 (negocio ACTIVE), R3 (comisiones), R4 (splits),
//! R5 (step-up), R6 (ninguna transacción de BD abarca una llamada externa), R7 (UNKNOWN), R8/R9
//! (captura con asiento y outbox), R13 (sandbox), R14 (expiración), R15 (límites), R16, R17.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::clients::{Clients, DependencyError, Leg, TENANT_ACTIVE};
use crate::domain::errors::DomainError;
use crate::domain::fees::{FeeBearer, FeeBreakdown, FeeTerms};
use crate::domain::request;
use crate::observability::Metrics;
use crate::pb::ledger::AccountType;
use crate::store::{
    ConfirmStart, FeePolicyRow, FrozenFees, IntentRow, NewFeePolicy, NewIntent, PaymentFilter,
    PaymentRow, PgPayments, Scope, SplitFees, SplitJson, StoreError, TerminalRow,
};

/// Party de la plataforma (domain-model §2): dueña de PLATFORM_FEES y TAX_PAYABLE.
pub const PLATFORM_PARTY: &str = "00000000-0000-0000-0000-000000000001";
/// Riel WALLET (`common.PaymentRail`).
pub const RAIL_WALLET: i16 = 1;
/// Operaciones con que se pide el reto de step-up (security-standards §4).
pub const STEP_UP_CREATE: &str = "payments.intent.create";
pub const STEP_UP_CONFIRM: &str = "payments.intent.confirm";
/// Vida del hold de wallet (domain-model §8.4: 15 min); la captura es inmediata.
const HOLD_TTL_SECONDS: i32 = 900;
const MAX_INTENT_TTL_SECONDS: i64 = 86_400;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Store(#[from] StoreError),
    #[error(transparent)]
    Dependency(#[from] DependencyError),
    #[error("permission denied")]
    PermissionDenied,
    #[error("not found")]
    NotFound,
    #[error("tenant not active")]
    TenantNotActive,
    #[error("step-up required")]
    StepUpRequired,
    #[error("step-up invalid: {0}")]
    StepUpInvalid(String),
    #[error("rail disabled")]
    RailDisabled,
    #[error("terminal inactive")]
    TerminalInactive,
    #[error("insufficient funds")]
    InsufficientFunds,
    #[error("invalid expiration")]
    InvalidExpiration,
    #[error("invalid label")]
    InvalidLabel,
}

/// Quién llama, desde los metadatos (ADR 0011): nunca del cuerpo.
#[derive(Debug, Clone, Default)]
pub struct Actor {
    pub service: String,
    pub user_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub permissions: Vec<String>,
    pub request_id: String,
    /// Token de step-up de `x-pp-step-up` (cabecera `X-Step-Up-Token` en el gateway).
    pub step_up: String,
}

impl Actor {
    pub fn has(&self, perm: &str) -> bool {
        self.permissions.iter().any(|p| p == perm)
    }

    /// Servicios internos que crean cobros a nombre del negocio del contexto (SPEC §8).
    fn is_internal_charger(&self) -> bool {
        matches!(self.service.as_str(), "orders" | "pos" | "payroll")
    }

    fn user(&self) -> Result<Uuid, Error> {
        self.user_id.ok_or(Error::PermissionDenied)
    }

    /// Alcance de lectura: el negocio con `payments:read`/`payments:charge`, y lo que pagó la persona.
    fn read_scope(&self) -> Scope {
        if self.is_internal_charger() {
            return Scope::service();
        }
        Scope {
            service: false,
            tenant_id: match self.tenant_id {
                Some(t) if self.has("payments:read") || self.has("payments:charge") => {
                    t.to_string()
                }
                _ => String::new(),
            },
            party_id: match self.user_id {
                Some(u) if self.has("wallet:pay") || self.has("wallet:read") => u.to_string(),
                _ => String::new(),
            },
        }
    }
}

/// Un split pedido (R4).
#[derive(Debug, Clone)]
pub struct SplitInput {
    pub merchant_party_id: Uuid,
    pub amount_minor: i64,
    pub reference_type: String,
    pub reference_id: String,
}

#[derive(Debug, Clone)]
pub struct CreateIntent {
    pub idempotency_key: String,
    pub request_hash: Vec<u8>,
    pub amount_minor: i64,
    pub currency: String,
    pub rail: i16,
    pub terminal_code: String,
    pub splits: Vec<SplitInput>,
    pub reference_type: String,
    pub reference_id: String,
    pub metadata: BTreeMap<String, String>,
    pub expires_in_seconds: i32,
    pub step_up_token: String,
}

/// Intent con su pago, tal como se devuelve.
#[derive(Debug, Clone)]
pub struct IntentView {
    pub intent: IntentRow,
    pub payment: Option<PaymentRow>,
}

pub struct PaymentsCore {
    store: PgPayments,
    clients: Arc<Clients>,
    metrics: Arc<Metrics>,
    default_ttl: Duration,
}

fn rail_name(rail: i16) -> &'static str {
    match rail {
        1 => "WALLET",
        2 => "YAPPY",
        3 => "TELERED_CLAVE",
        4 => "CARD",
        5 => "APPLE_PAY",
        6 => "GOOGLE_PAY",
        7 => "QR_INTEROP",
        _ => "UNSPECIFIED",
    }
}

/// Próxima consulta de un pago a medio camino (domain-model §6.3): 30 s, 1, 2, 5, 15, 30 min,
/// 1 h y luego cada hora.
pub fn next_check(unknown_since: Option<DateTime<Utc>>, now: DateTime<Utc>) -> DateTime<Utc> {
    const STEPS: [i64; 7] = [30, 60, 120, 300, 900, 1800, 3600];
    let age = unknown_since
        .map(|s| now.signed_duration_since(s).num_seconds())
        .unwrap_or(0);
    let mut elapsed = 0i64;
    for step in STEPS {
        elapsed = elapsed.saturating_add(step);
        if age < elapsed {
            return now
                .checked_add_signed(chrono::Duration::seconds(step))
                .unwrap_or(now);
        }
    }
    now.checked_add_signed(chrono::Duration::seconds(3600))
        .unwrap_or(now)
}

/// Términos de una política guardada.
pub fn terms(p: &FeePolicyRow) -> Result<FeeTerms, DomainError> {
    let bps = |v: i32| u32::try_from(v).map_err(|_| DomainError::InvalidFeePolicy);
    let t = FeeTerms {
        fixed_fee_minor: p.fixed_fee_minor,
        percentage_bps: bps(p.percentage_bps)?,
        tax_rate_bps: bps(p.tax_rate_bps)?,
        rail_fixed_fee_minor: p.rail_fixed_fee_minor,
        rail_percentage_bps: bps(p.rail_percentage_bps)?,
        bearer: FeeBearer::from_code(p.bearer).ok_or(DomainError::InvalidFeePolicy)?,
    };
    t.validate()?;
    Ok(t)
}

/// Piernas de crédito del asiento T3 (domain-model §5.2): neto a cada comercio, comisión e
/// impuesto a la plataforma. Σ piernas = total cobrado (= monto retenido). Las piernas en 0 se omiten.
pub fn wallet_legs(fees: &FrozenFees) -> Result<(Vec<Leg>, i64), DomainError> {
    let mut legs = Vec::new();
    let (mut pf, mut tax, mut total) = (0i64, 0i64, 0i64);
    for s in &fees.splits {
        if s.rail_fee_minor != 0 {
            return Err(DomainError::InvalidFeePolicy);
        }
        if s.merchant_net_minor > 0 {
            legs.push(Leg {
                party_id: s.merchant_party_id.to_string(),
                account_type: AccountType::MerchantPayable as i32,
                amount_minor: s.merchant_net_minor,
            });
        }
        pf = pf
            .checked_add(s.platform_fee_minor)
            .ok_or(DomainError::Overflow)?;
        tax = tax.checked_add(s.tax_minor).ok_or(DomainError::Overflow)?;
        total = total
            .checked_add(s.total_charged_minor)
            .ok_or(DomainError::Overflow)?;
    }
    for (kind, amount) in [
        (AccountType::PlatformFees, pf),
        (AccountType::TaxPayable, tax),
    ] {
        if amount > 0 {
            legs.push(Leg {
                party_id: PLATFORM_PARTY.into(),
                account_type: kind as i32,
                amount_minor: amount,
            });
        }
    }
    let sum = legs
        .iter()
        .try_fold(0i64, |acc, l| acc.checked_add(l.amount_minor))
        .ok_or(DomainError::Overflow)?;
    if sum != total {
        return Err(DomainError::SplitsMismatch);
    }
    Ok((legs, total))
}

/// `public_code` de una terminal: 22 caracteres base64url de 128 bits aleatorios (SPEC §4).
pub fn new_public_code() -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let bytes = *Uuid::new_v4().as_bytes();
    let extra = *Uuid::new_v4().as_bytes();
    let mut bits: u128 = u128::from_be_bytes(bytes) ^ u128::from_be_bytes(extra).rotate_left(64);
    let mut out = String::with_capacity(22);
    for _ in 0..22 {
        let idx = usize::try_from(bits & 63).unwrap_or(0);
        out.push(char::from(*ALPHABET.get(idx).unwrap_or(&b'A')));
        bits >>= 6;
    }
    out
}

impl PaymentsCore {
    pub fn new(
        store: PgPayments,
        clients: Arc<Clients>,
        metrics: Arc<Metrics>,
        default_ttl: Duration,
    ) -> Self {
        Self {
            store,
            clients,
            metrics,
            default_ttl,
        }
    }

    pub fn store(&self) -> &PgPayments {
        &self.store
    }

    /// R2: proyección local de `TenantStatusChanged` o, si no existe, identity con caché.
    async fn require_active(&self, request_id: &str, tenant_id: Uuid) -> Result<(), Error> {
        let status = match self.store.tenant_status(tenant_id).await? {
            Some(s) => i32::from(s),
            None => {
                self.clients
                    .tenant(request_id, tenant_id)
                    .await
                    .map_err(|e| match e {
                        DependencyError::Definitive { reason, .. } if reason == "NOT_FOUND" => {
                            Error::TenantNotActive
                        }
                        other => Error::Dependency(other),
                    })?
                    .status
            }
        };
        if status == TENANT_ACTIVE {
            Ok(())
        } else {
            Err(Error::TenantNotActive)
        }
    }

    /// R3/R4: desglose por split con la política vigente de cada comercio. La wallet no tiene
    /// comisión de riel.
    async fn price(
        &self,
        rail: i16,
        splits: &[SplitJson],
        at: DateTime<Utc>,
    ) -> Result<FrozenFees, Error> {
        let mut out = Vec::with_capacity(splits.len());
        let mut first_policy = None;
        for s in splits {
            let policy = self
                .store
                .applicable_fee_policy(s.merchant_party_id, rail, at)
                .await?
                .ok_or(DomainError::FeePolicyMissing)?;
            first_policy.get_or_insert(policy.id);
            let mut t = terms(&policy)?;
            if rail == RAIL_WALLET {
                t = t.without_rail_fee();
            }
            let b = FeeBreakdown::compute(s.amount_minor, &t)?;
            out.push(SplitFees {
                merchant_party_id: s.merchant_party_id,
                gross_minor: b.gross_minor,
                platform_fee_minor: b.platform_fee_minor,
                tax_minor: b.tax_minor,
                rail_fee_minor: b.rail_fee_minor,
                merchant_net_minor: b.merchant_net_minor,
                total_charged_minor: b.total_charged_minor,
            });
        }
        Ok(FrozenFees {
            fee_policy_id: first_policy.ok_or(DomainError::SplitsMismatch)?,
            splits: out,
        })
    }

    async fn step_up(
        &self,
        actor: &Actor,
        token: &str,
        operation: &str,
        amount_minor: i64,
        currency: &str,
    ) -> Result<(), Error> {
        if token.is_empty() {
            return Err(Error::StepUpRequired);
        }
        match self
            .clients
            .consume_step_up(
                &actor.request_id,
                token,
                actor.user()?,
                operation,
                amount_minor,
                currency,
            )
            .await?
        {
            None => Ok(()),
            Some(reason) => Err(Error::StepUpInvalid(reason)),
        }
    }

    async fn view(&self, intent: IntentRow) -> Result<IntentView, Error> {
        let payment = match intent.payment_id {
            Some(id) => Some(self.store.payment(&Scope::service(), id).await?),
            None => None,
        };
        Ok(IntentView { intent, payment })
    }

    // ── CreatePaymentIntent ─────────────────────────────────────────────────────────────────

    #[tracing::instrument(skip_all, err, fields(pp.rail = cmd.rail))]
    pub async fn create_intent(
        &self,
        actor: &Actor,
        cmd: CreateIntent,
    ) -> Result<IntentView, Error> {
        request::idempotency_key(&cmd.idempotency_key)?;
        request::currency_decimals(&cmd.currency)?;
        if cmd.amount_minor <= 0 {
            return Err(DomainError::AmountOutOfRange.into());
        }
        request::metadata(cmd.metadata.iter().map(|(k, v)| (k.as_str(), v.as_str())))?;
        request::reference(&cmd.reference_type, &cmd.reference_id)?;
        for s in &cmd.splits {
            request::reference(&s.reference_type, &s.reference_id)?;
        }
        // F11.3: solo WALLET. Los rieles externos llegan con su adaptador sandbox (F11.7).
        if cmd.rail != RAIL_WALLET {
            return Err(Error::RailDisabled);
        }
        let ttl = match i64::from(cmd.expires_in_seconds) {
            0 => i64::try_from(self.default_ttl.as_secs()).unwrap_or(900),
            s if (1..=MAX_INTENT_TTL_SECONDS).contains(&s) => s,
            _ => return Err(Error::InvalidExpiration),
        };

        // Quién cobra y quién paga: el comercio de la terminal (paga la persona del contexto) o el
        // negocio del contexto (cobra; el pagador se fija al confirmar).
        let (tenant_id, created_by, payer, terminal) = if !cmd.terminal_code.is_empty() {
            if !actor.has("wallet:pay") {
                return Err(Error::PermissionDenied);
            }
            let user = actor.user()?;
            let t = match self.store.terminal_by_code(&cmd.terminal_code).await {
                Ok(t) => t,
                Err(StoreError::NotFound) => return Err(Error::NotFound),
                Err(e) => return Err(e.into()),
            };
            if !t.active {
                return Err(Error::TerminalInactive);
            }
            (t.tenant_id, user, Some(user), Some(t.id))
        } else if actor.has("payments:charge") || actor.is_internal_charger() {
            let tenant = actor.tenant_id.ok_or(Error::PermissionDenied)?;
            (tenant, actor.user_id.unwrap_or_else(Uuid::nil), None, None)
        } else {
            return Err(Error::PermissionDenied);
        };

        let splits: Vec<SplitJson> = if cmd.splits.is_empty() {
            vec![SplitJson {
                merchant_party_id: tenant_id,
                amount_minor: cmd.amount_minor,
                reference_type: String::new(),
                reference_id: String::new(),
            }]
        } else {
            if terminal.is_some() {
                // Un QR de terminal cobra solo para su comercio.
                return Err(DomainError::SplitsMismatch.into());
            }
            cmd.splits
                .iter()
                .map(|s| SplitJson {
                    merchant_party_id: s.merchant_party_id,
                    amount_minor: s.amount_minor,
                    reference_type: s.reference_type.clone(),
                    reference_id: s.reference_id.clone(),
                })
                .collect()
        };
        request::splits_sum(
            cmd.amount_minor,
            &splits.iter().map(|s| s.amount_minor).collect::<Vec<_>>(),
        )?;

        // R1: replay antes de consumir el step-up (un reintento no gasta otro token).
        if let Some((existing, hash)) = self
            .store
            .intent_by_key(tenant_id, created_by, &cmd.idempotency_key)
            .await?
        {
            if hash != cmd.request_hash {
                return Err(StoreError::IdempotencyKeyReused.into());
            }
            return self.view(existing).await;
        }

        for s in &splits {
            self.require_active(&actor.request_id, s.merchant_party_id)
                .await?;
        }
        let flags = self.clients.flags(&actor.request_id, tenant_id).await?;
        if !flags.payments_enabled {
            return Err(Error::RailDisabled);
        }
        let limits = self.clients.limits(&actor.request_id).await?;
        let now = Utc::now();
        let fees = self.price(cmd.rail, &splits, now).await?;
        let charged = fees
            .splits
            .iter()
            .try_fold(0i64, |acc, s| acc.checked_add(s.total_charged_minor))
            .ok_or(DomainError::Overflow)?;
        if charged > limits.max_payment_minor {
            return Err(DomainError::AmountOutOfRange.into());
        }
        if payer.is_some() && charged >= limits.step_up_threshold_minor {
            let token = if cmd.step_up_token.is_empty() {
                actor.step_up.as_str()
            } else {
                cmd.step_up_token.as_str()
            };
            self.step_up(actor, token, STEP_UP_CREATE, charged, &cmd.currency)
                .await?;
        }

        let (row, hash) = self
            .store
            .insert_intent(NewIntent {
                id: Uuid::now_v7(),
                tenant_id,
                created_by,
                payer_party_id: payer,
                amount_minor: cmd.amount_minor,
                currency: cmd.currency.clone(),
                rail: cmd.rail,
                terminal_id: terminal,
                reference_type: cmd.reference_type,
                reference_id: cmd.reference_id,
                metadata: serde_json::to_value(&cmd.metadata).map_err(StoreError::from)?,
                splits,
                sandbox: !flags.wallet_real_money,
                expires_at: now
                    .checked_add_signed(chrono::Duration::seconds(ttl))
                    .ok_or(DomainError::Overflow)?,
                idempotency_key: cmd.idempotency_key,
                request_hash: cmd.request_hash.clone(),
            })
            .await?;
        if hash != cmd.request_hash {
            return Err(StoreError::IdempotencyKeyReused.into());
        }
        tracing::info!(pp.payment_intent_id = %row.id, pp.tenant_id = %row.tenant_id, pp.amount_minor = row.amount_minor, "payment intent created");
        self.view(row).await
    }

    // ── ConfirmPaymentIntent ────────────────────────────────────────────────────────────────

    #[tracing::instrument(skip_all, err, fields(pp.payment_intent_id = %intent_id))]
    pub async fn confirm_intent(
        &self,
        actor: &Actor,
        intent_id: Uuid,
        idempotency_key: &str,
        confirmation_data: &BTreeMap<String, String>,
    ) -> Result<IntentView, Error> {
        request::idempotency_key(idempotency_key)?;
        if !actor.has("wallet:pay") {
            return Err(Error::PermissionDenied);
        }
        let payer = actor.user()?;
        let intent = match self.store.intent(&Scope::service(), intent_id).await {
            Ok(i) => i,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        if intent.payer_party_id.is_some_and(|p| p != payer) {
            return Err(Error::NotFound);
        }
        if let Some(pid) = intent.payment_id {
            let p = self.store.payment(&Scope::service(), pid).await?;
            if p.payer_party_id != Some(payer) {
                return Err(Error::NotFound);
            }
            if p.confirm_idempotency_key != idempotency_key {
                return Err(DomainError::InvalidStateTransition.into());
            }
            // Reintento de la misma confirmación: se continúa si quedó a medias y nadie más la está
            // conduciendo; si otro la conduce, se devuelve el estado actual (PROCESSING/UNKNOWN).
            if !p.status.is_terminal() && self.store.claim(p.id).await? {
                self.drive_wallet(&actor.request_id, p).await?;
            }
            return self
                .view(self.store.intent(&Scope::service(), intent_id).await?)
                .await;
        }
        if intent.rail != RAIL_WALLET {
            return Err(Error::RailDisabled);
        }
        for s in &intent.splits {
            self.require_active(&actor.request_id, s.merchant_party_id)
                .await?;
        }
        if !self
            .clients
            .flags(&actor.request_id, intent.tenant_id)
            .await?
            .payments_enabled
        {
            return Err(Error::RailDisabled);
        }
        let limits = self.clients.limits(&actor.request_id).await?;
        let now = Utc::now();
        let fees = self.price(intent.rail, &intent.splits, now).await?;
        let (_, charged) = wallet_legs(&fees)?;
        if charged > limits.max_payment_minor {
            return Err(DomainError::AmountOutOfRange.into());
        }
        // Un cobro creado por el comercio no tenía pagador: la confirmación fuerte va aquí.
        if intent.payer_party_id.is_none() && charged >= limits.step_up_threshold_minor {
            let token = confirmation_data
                .get("step_up_token")
                .map(String::as_str)
                .filter(|t| !t.is_empty())
                .unwrap_or(actor.step_up.as_str());
            self.step_up(actor, token, STEP_UP_CONFIRM, charged, &intent.currency)
                .await?;
        }
        let p = match self
            .store
            .start_payment(intent_id, payer, idempotency_key, &fees, charged, now)
            .await
        {
            Ok(ConfirmStart::Started(p)) => p,
            Ok(ConfirmStart::Existing(p)) => {
                if p.confirm_idempotency_key != idempotency_key || p.payer_party_id != Some(payer) {
                    return Err(DomainError::InvalidStateTransition.into());
                }
                // Otra confirmación simultánea ganó la carrera y conduce el pago.
                return self
                    .view(self.store.intent(&Scope::service(), intent_id).await?)
                    .await;
            }
            Err(StoreError::InvalidStateTransition) => {
                return Err(DomainError::InvalidStateTransition.into())
            }
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        self.drive_wallet(&actor.request_id, p).await?;
        self.view(self.store.intent(&Scope::service(), intent_id).await?)
            .await
    }

    /// R9: retiene en la wallet del pagador y captura con el asiento T3 en una sola llamada al
    /// ledger. Idempotente: se puede repetir (reintento del cliente o job) sin duplicar nada.
    /// Rechazo definitivo → libera y FAILED; respuesta ambigua → UNKNOWN y se reintenta.
    #[tracing::instrument(skip_all, err, fields(pp.payment_id = %p.id))]
    pub async fn drive_wallet(&self, request_id: &str, p: PaymentRow) -> Result<PaymentRow, Error> {
        if p.status.is_terminal() {
            return Ok(p);
        }
        let payer = p
            .payer_party_id
            .ok_or(StoreError::Corrupt("payment without payer"))?;
        let fees = p
            .fees
            .clone()
            .ok_or(StoreError::Corrupt("payment without fees"))?;
        let (legs, total) = wallet_legs(&fees)?;
        let rail = rail_name(p.rail);

        let hold_id = match p.hold_id {
            Some(h) => h,
            None => {
                let r = self
                    .clients
                    .create_hold(
                        request_id,
                        p.id,
                        payer,
                        &p.currency,
                        total,
                        HOLD_TTL_SECONDS,
                    )
                    .await;
                self.count_rail(rail, "create_hold", &r);
                match r {
                    Ok(h) => {
                        self.store.set_hold(p.id, h).await?;
                        h
                    }
                    Err(e) => return self.rail_failed(request_id, p, None, e).await,
                }
            }
        };

        let r = self
            .clients
            .capture_hold(request_id, p.id, hold_id, p.tenant_id, &p.currency, &legs)
            .await;
        self.count_rail(rail, "capture_hold", &r);
        match r {
            Ok(txid) => {
                let (done, changed) = self.store.complete_capture(p.id, txid).await?;
                if changed {
                    self.metrics
                        .payments
                        .with_label_values(&[rail, "CAPTURED"])
                        .inc();
                    self.metrics
                        .amount_minor
                        .with_label_values(&[rail, &done.currency])
                        .inc_by(u64::try_from(done.captured_minor).unwrap_or(0));
                    tracing::info!(pp.payment_id = %done.id, pp.ledger_transaction_id = %txid, "payment captured");
                }
                Ok(done)
            }
            Err(e) => self.rail_failed(request_id, p, Some(hold_id), e).await,
        }
    }

    async fn rail_failed(
        &self,
        request_id: &str,
        p: PaymentRow,
        hold_id: Option<Uuid>,
        e: DependencyError,
    ) -> Result<PaymentRow, Error> {
        let rail = rail_name(p.rail);
        if e.is_ambiguous() {
            let next = next_check(Some(p.created_at), Utc::now());
            let out = self.store.mark_unknown(p.id, next).await?;
            self.metrics
                .payments
                .with_label_values(&[rail, "UNKNOWN"])
                .inc();
            tracing::warn!(pp.payment_id = %p.id, err = %e, "payment unknown: ledger answer ambiguous");
            return Ok(out);
        }
        // Definitivo: no hubo asiento. Se libera lo retenido (si lo hay) y el pago falla.
        if let Some(h) = hold_id {
            if let Err(re) = self.clients.release_hold(request_id, h).await {
                tracing::warn!(pp.hold_id = %h, err = %re, "hold release failed; ledger expiry job frees it");
            }
        }
        let code = match e.reason() {
            "" => "RAIL_ERROR",
            r => r,
        }
        .to_string();
        let (out, changed) = self.store.fail_payment(p.id, &code).await?;
        if changed {
            self.metrics
                .payments
                .with_label_values(&[rail, "FAILED"])
                .inc();
        }
        match code.as_str() {
            "INSUFFICIENT_FUNDS" => Err(Error::InsufficientFunds),
            "HOLD_NOT_ACTIVE" => Ok(out),
            _ => Err(Error::Dependency(e)),
        }
    }

    fn count_rail<T>(&self, rail: &str, op: &str, r: &Result<T, DependencyError>) {
        let result = match r {
            Ok(_) => "ok",
            Err(e) if e.is_ambiguous() => "ambiguous",
            Err(_) => "declined",
        };
        self.metrics
            .rail_requests
            .with_label_values(&[rail, op, result])
            .inc();
    }

    // ── CancelPaymentIntent / lecturas ──────────────────────────────────────────────────────

    pub async fn cancel_intent(&self, actor: &Actor, intent_id: Uuid) -> Result<IntentView, Error> {
        let intent = match self.store.intent(&Scope::service(), intent_id).await {
            Ok(i) => i,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        let is_creator = actor.user_id.is_some_and(|u| u == intent.created_by);
        let is_merchant = actor.tenant_id == Some(intent.tenant_id)
            && (actor.has("payments:charge") || actor.is_internal_charger());
        if !is_creator && !is_merchant {
            return Err(Error::NotFound);
        }
        match self.store.cancel_intent(intent_id).await {
            Ok(i) => self.view(i).await,
            Err(StoreError::InvalidStateTransition) => {
                Err(DomainError::InvalidStateTransition.into())
            }
            Err(e) => Err(e.into()),
        }
    }

    pub async fn get_intent(&self, actor: &Actor, intent_id: Uuid) -> Result<IntentView, Error> {
        match self.store.intent(&actor.read_scope(), intent_id).await {
            Ok(i) => self.view(i).await,
            Err(StoreError::NotFound) => Err(Error::NotFound),
            Err(e) => Err(e.into()),
        }
    }

    pub async fn get_payment(&self, actor: &Actor, payment_id: Uuid) -> Result<PaymentRow, Error> {
        if !actor.has("payments:read") && !actor.is_internal_charger() {
            return Err(Error::PermissionDenied);
        }
        match self.store.payment(&actor.read_scope(), payment_id).await {
            Ok(p) => Ok(p),
            Err(StoreError::NotFound) => Err(Error::NotFound),
            Err(e) => Err(e.into()),
        }
    }

    pub async fn list_payments(
        &self,
        actor: &Actor,
        filter: PaymentFilter,
    ) -> Result<Vec<PaymentRow>, Error> {
        if !actor.has("payments:read") && !actor.is_internal_charger() {
            return Err(Error::PermissionDenied);
        }
        let mut scope = actor.read_scope();
        scope.party_id.clear();
        if !scope.service && scope.tenant_id.is_empty() {
            return Err(Error::PermissionDenied);
        }
        Ok(self.store.list_payments(&scope, &filter).await?)
    }

    // ── Jobs ────────────────────────────────────────────────────────────────────────────────

    /// R14: intents vencidos → EXPIRED.
    pub async fn expire_intents(&self) -> Result<u64, Error> {
        Ok(self.store.expire_intents().await?)
    }

    /// R7/R9: reanuda los pagos de wallet a medio camino. Cada fallo de un pago se registra aquí y
    /// no detiene a los demás. Devuelve cuántos resolvió.
    pub async fn resume_wallet_payments(&self) -> Result<usize, Error> {
        let mut resolved = 0usize;
        for p in self.store.due_wallet_payments(50).await? {
            let id = p.id;
            if !self.store.claim(id).await? {
                continue;
            }
            match self.drive_wallet("job:resume_wallet", p).await {
                Ok(done) if done.status.is_terminal() => resolved = resolved.saturating_add(1),
                Ok(_) => {}
                Err(Error::InsufficientFunds) => resolved = resolved.saturating_add(1),
                Err(e) => {
                    tracing::error!(pp.payment_id = %id, err = %e, "wallet payment resume failed")
                }
            }
        }
        Ok(resolved)
    }

    /// Actualiza los indicadores de pagos UNKNOWN y capturados sin asiento.
    pub async fn refresh_gauges(&self) -> Result<(), Error> {
        let (unknown, unposted) = self.store.gauges().await?;
        self.metrics
            .unknown_current
            .with_label_values(&["WALLET"])
            .set(unknown);
        self.metrics.captured_unposted.set(unposted);
        Ok(())
    }

    // ── Terminales (F11.5) ──────────────────────────────────────────────────────────────────

    fn terminal_tenant(&self, actor: &Actor) -> Result<Uuid, Error> {
        if !actor.has("payments:terminal:manage") {
            return Err(Error::PermissionDenied);
        }
        actor.tenant_id.ok_or(Error::PermissionDenied)
    }

    pub async fn create_terminal(
        &self,
        actor: &Actor,
        label: &str,
        idempotency_key: &str,
    ) -> Result<TerminalRow, Error> {
        let tenant = self.terminal_tenant(actor)?;
        request::idempotency_key(idempotency_key)?;
        let label = label.trim();
        if label.is_empty() || label.chars().count() > 60 {
            return Err(Error::InvalidLabel);
        }
        self.require_active(&actor.request_id, tenant).await?;
        Ok(self
            .store
            .create_terminal(
                tenant,
                actor.user()?,
                label,
                &new_public_code(),
                idempotency_key,
            )
            .await?)
    }

    pub async fn list_terminals(&self, actor: &Actor) -> Result<Vec<TerminalRow>, Error> {
        let tenant = self.terminal_tenant(actor)?;
        let scope = Scope {
            service: false,
            tenant_id: tenant.to_string(),
            party_id: String::new(),
        };
        Ok(self.store.list_terminals(&scope, tenant).await?)
    }

    pub async fn set_terminal_active(
        &self,
        actor: &Actor,
        terminal_id: Uuid,
        active: bool,
    ) -> Result<TerminalRow, Error> {
        let tenant = self.terminal_tenant(actor)?;
        match self
            .store
            .set_terminal_active(tenant, terminal_id, active)
            .await
        {
            Ok(t) => Ok(t),
            Err(StoreError::NotFound) => Err(Error::NotFound),
            Err(e) => Err(e.into()),
        }
    }

    /// R16: solo nombre comercial verificado (de identity), etiqueta y estado.
    pub async fn resolve_terminal(
        &self,
        actor: &Actor,
        public_code: &str,
    ) -> Result<(TerminalRow, String), Error> {
        if actor.user_id.is_none() && actor.service.is_empty() {
            return Err(Error::PermissionDenied);
        }
        let t = match self.store.terminal_by_code(public_code).await {
            Ok(t) => t,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        if !t.active {
            return Err(Error::TerminalInactive);
        }
        let info = self.clients.tenant(&actor.request_id, t.tenant_id).await?;
        if info.status != TENANT_ACTIVE {
            return Err(Error::TerminalInactive);
        }
        Ok((t, info.trade_name))
    }

    // ── Comisiones ──────────────────────────────────────────────────────────────────────────

    /// QuoteFees (§4 sin persistir) con la política del negocio del contexto, o la global.
    pub async fn quote(
        &self,
        actor: &Actor,
        amount_minor: i64,
        currency: &str,
        rail: i16,
    ) -> Result<FeeBreakdown, Error> {
        if !(actor.has("payments:charge") || actor.has("wallet:pay") || actor.is_internal_charger())
        {
            return Err(Error::PermissionDenied);
        }
        request::currency_decimals(currency)?;
        let tenant = actor.tenant_id.unwrap_or_else(Uuid::nil);
        let policy = self
            .store
            .applicable_fee_policy(tenant, rail, Utc::now())
            .await?
            .ok_or(DomainError::FeePolicyMissing)?;
        let mut t = terms(&policy)?;
        if rail == RAIL_WALLET {
            t = t.without_rail_fee();
        }
        Ok(FeeBreakdown::compute(amount_minor, &t)?)
    }

    /// UpsertFeePolicy: nunca edita; crea una política nueva (`platform:flags:manage`).
    pub async fn upsert_fee_policy(
        &self,
        actor: &Actor,
        row: FeePolicyRow,
        idempotency_key: &str,
        request_hash: Vec<u8>,
    ) -> Result<FeePolicyRow, Error> {
        if !actor.has("platform:flags:manage") {
            return Err(Error::PermissionDenied);
        }
        request::idempotency_key(idempotency_key)?;
        terms(&row)?;
        Ok(self
            .store
            .insert_fee_policy(NewFeePolicy {
                row,
                created_by: actor.user()?,
                idempotency_key: idempotency_key.to_string(),
                request_hash,
            })
            .await?)
    }

    pub async fn list_fee_policies(
        &self,
        actor: &Actor,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<FeePolicyRow>, Error> {
        let tenant = if actor.has("platform:flags:manage") {
            tenant_id
        } else if actor.has("payments:fees:read") {
            Some(actor.tenant_id.ok_or(Error::PermissionDenied)?)
        } else {
            return Err(Error::PermissionDenied);
        };
        Ok(self.store.list_fee_policies(tenant).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn split(net: i64, pf: i64, tax: i64, total: i64) -> SplitFees {
        SplitFees {
            merchant_party_id: Uuid::nil(),
            gross_minor: total,
            platform_fee_minor: pf,
            tax_minor: tax,
            rail_fee_minor: 0,
            merchant_net_minor: net,
            total_charged_minor: total,
        }
    }

    /// T3: las piernas suman el monto retenido; las piernas en 0 no se mandan al ledger.
    #[test]
    fn r9_wallet_legs_sum_to_the_hold() {
        let fees = FrozenFees {
            fee_policy_id: Uuid::nil(),
            splits: vec![split(2_432, 63, 5, 2_500)],
        };
        let (legs, total) = wallet_legs(&fees).unwrap_or_default();
        assert_eq!(total, 2_500);
        assert_eq!(legs.len(), 3);
        let promo = FrozenFees {
            fee_policy_id: Uuid::nil(),
            splits: vec![split(2_500, 0, 0, 2_500)],
        };
        assert_eq!(wallet_legs(&promo).map(|(l, _)| l.len()), Ok(1));
    }

    #[test]
    fn unknown_backoff_follows_the_protocol() {
        let now = Utc::now();
        let at = |secs: i64| now - chrono::Duration::seconds(secs);
        assert_eq!(
            next_check(Some(at(0)), now),
            now + chrono::Duration::seconds(30)
        );
        assert_eq!(
            next_check(Some(at(40)), now),
            now + chrono::Duration::seconds(60)
        );
        assert_eq!(
            next_check(Some(at(7_200)), now),
            now + chrono::Duration::seconds(3_600)
        );
    }

    #[test]
    fn terminal_codes_are_22_url_safe_chars() {
        let a = new_public_code();
        let b = new_public_code();
        assert_eq!(a.len(), 22);
        assert_ne!(a, b);
        assert!(a
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }
}
