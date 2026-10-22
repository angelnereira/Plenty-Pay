//! Casos de uso de payments-core (SPEC §4–§6). Orquesta store, ledger, identity e
//! infra-management. Reglas: R1 (idempotencia), R2 (negocio ACTIVE), R3 (comisiones), R4 (splits),
//! R5 (step-up), R6 (ninguna transacción de BD abarca una llamada externa), R7 (UNKNOWN), R8/R9
//! (captura con asiento y outbox), R13 (sandbox), R14 (expiración), R15 (límites), R16, R17.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::clients::{Clients, DependencyError, EntryLine, Leg, TENANT_ACTIVE};
use crate::domain::errors::DomainError;
use crate::domain::fees::{FeeBearer, FeeBreakdown, FeeTerms};
use crate::domain::request;
use crate::domain::state::PaymentStatus;
use crate::observability::Metrics;
use crate::pb::ledger::AccountType;
use crate::rails;
use crate::store::{
    Capture, ConfirmStart, FeePolicyRow, FrozenFees, IntentRow, NewFeePolicy, NewIntent,
    PaymentFilter, PaymentRow, PendingPosting, PgPayments, ReceiveCodeRow, Scope, SplitFees, SplitJson,
    StoreError, TerminalRow,
};

/// Party de la plataforma (domain-model §2): dueña de PLATFORM_FEES y TAX_PAYABLE.
pub const PLATFORM_PARTY: &str = "00000000-0000-0000-0000-000000000001";
/// Riel WALLET (`common.PaymentRail`).
pub const RAIL_WALLET: i16 = 1;
/// `common.Reference.type` de una recarga (domain-model §9, R10).
pub const REF_TOPUP: &str = "topup";
/// `common.Reference.type` de una transferencia entre personas (R10, T4, F11.10).
pub const REF_TRANSFER: &str = "transfer";
/// Vigencia de un código personal para recibir (S-WAL-04: rota cada 24 h).
pub const RECEIVE_CODE_TTL_HOURS: i64 = 24;
/// Con menos de esto por delante, pedir el código emite uno nuevo (quien lo muestra no queda con
/// un QR a punto de vencer).
pub const RECEIVE_CODE_MIN_LEFT_MINUTES: i64 = 60;

/// Nombre que ve quien envía (N-DAT-12, mínimo necesario): primer nombre e inicial del último
/// apellido. «Ana María Pérez Gómez» → «Ana G.»; un solo nombre queda igual.
pub fn short_name(full: &str) -> String {
    let words: Vec<&str> = full.split_whitespace().collect();
    let out = match words.as_slice() {
        [] => String::new(),
        [only] => (*only).to_string(),
        [first, .., last] => match last.chars().next() {
            Some(c) => format!("{first} {}.", c.to_uppercase()),
            None => (*first).to_string(),
        },
    };
    out.chars().take(80).collect()
}

/// A quién lleva un código de un enlace `/t/`: un punto de cobro (comercio) o una persona.
pub enum PayCode {
    Terminal(TerminalRow, String),
    Person(ReceiveCodeRow),
}

fn platform_party() -> Uuid {
    Uuid::from_u128(1)
}

/// Σ total cobrado de los splits.
pub fn total_charged(fees: &FrozenFees) -> Result<i64, DomainError> {
    fees.splits
        .iter()
        .try_fold(0i64, |acc, s| acc.checked_add(s.total_charged_minor))
        .ok_or(DomainError::Overflow)
}

/// T1 (domain-model §5.2): D RAIL_RECEIVABLE(PLATFORM, riel) g · C WALLET(u) g.
pub fn topup_entries(rail: rails::RailSpec, payer: Uuid, amount_minor: i64) -> Vec<EntryLine> {
    vec![
        EntryLine {
            party_id: PLATFORM_PARTY.into(),
            account_type: AccountType::RailReceivable as i32,
            scope_id: rail.name.into(),
            debit: true,
            amount_minor,
        },
        EntryLine {
            party_id: payer.to_string(),
            account_type: AccountType::Wallet as i32,
            scope_id: String::new(),
            debit: false,
            amount_minor,
        },
    ]
}

/// T2 (domain-model §5.2): D RAIL_RECEIVABLE(riel) total · C MERCHANT_PAYABLE(m) neto por split ·
/// C PLATFORM_FEES pf · C TAX_PAYABLE tax · C RAIL_FEES_PAYABLE(riel) rf. Las líneas en 0 se omiten.
pub fn external_capture_entries(
    rail: rails::RailSpec,
    fees: &FrozenFees,
) -> Result<Vec<EntryLine>, DomainError> {
    let total = total_charged(fees)?;
    let mut out = vec![EntryLine {
        party_id: PLATFORM_PARTY.into(),
        account_type: AccountType::RailReceivable as i32,
        scope_id: rail.name.into(),
        debit: true,
        amount_minor: total,
    }];
    let (mut pf, mut tax, mut rf) = (0i64, 0i64, 0i64);
    for s in &fees.splits {
        if s.merchant_net_minor > 0 {
            out.push(EntryLine {
                party_id: s.merchant_party_id.to_string(),
                account_type: AccountType::MerchantPayable as i32,
                scope_id: String::new(),
                debit: false,
                amount_minor: s.merchant_net_minor,
            });
        }
        pf = pf
            .checked_add(s.platform_fee_minor)
            .ok_or(DomainError::Overflow)?;
        tax = tax.checked_add(s.tax_minor).ok_or(DomainError::Overflow)?;
        rf = rf
            .checked_add(s.rail_fee_minor)
            .ok_or(DomainError::Overflow)?;
    }
    for (kind, amount, scope) in [
        (AccountType::PlatformFees, pf, ""),
        (AccountType::TaxPayable, tax, ""),
        (AccountType::RailFeesPayable, rf, rail.name),
    ] {
        if amount > 0 {
            out.push(EntryLine {
                party_id: PLATFORM_PARTY.into(),
                account_type: kind as i32,
                scope_id: scope.into(),
                debit: false,
                amount_minor: amount,
            });
        }
    }
    let credits = out
        .iter()
        .filter(|e| !e.debit)
        .try_fold(0i64, |acc, e| acc.checked_add(e.amount_minor))
        .ok_or(DomainError::Overflow)?;
    if credits != total {
        return Err(DomainError::SplitsMismatch);
    }
    Ok(out)
}
/// Operaciones con que se pide el reto de step-up (security-standards §4).
pub const STEP_UP_CREATE: &str = "payments.intent.create";
pub const STEP_UP_CONFIRM: &str = "payments.intent.confirm";
/// R5: todo reembolso pedido por una persona exige step-up atado a la operación y al monto.
pub const STEP_UP_REFUND: &str = "payments.refund";
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
    #[error("cannot transfer to yourself")]
    SelfTransfer,
    #[error("evidence required")]
    EvidenceRequired,
    #[error("payment not captured")]
    PaymentNotCaptured,
    #[error("refund needs the merchant split")]
    RefundSplitRequired,
    #[error("merchant balance insufficient")]
    MerchantBalanceInsufficient,
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

    /// Servicios que solo leen cobros y reembolsos de cualquier negocio: settlement los necesita para
    /// armar lotes (saber si un cobro fue sandbox). No cobran ni reembolsan.
    fn is_internal_reader(&self) -> bool {
        matches!(self.service.as_str(), "settlement")
    }

    fn user(&self) -> Result<Uuid, Error> {
        self.user_id.ok_or(Error::PermissionDenied)
    }

    /// Alcance de lectura: el negocio con `payments:read`/`payments:charge`, y lo que pagó la persona.
    fn read_scope(&self) -> Scope {
        if self.is_internal_charger() || self.is_internal_reader() {
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

/// Piernas de crédito del asiento T4 (domain-model §5.2): todo a la billetera del destinatario,
/// sin comisión (R10, política P2P en 0). Σ piernas = monto retenido.
pub fn transfer_legs(fees: &FrozenFees) -> Result<(Vec<Leg>, i64), DomainError> {
    let [s] = fees.splits.as_slice() else {
        return Err(DomainError::SplitsMismatch);
    };
    if s.platform_fee_minor != 0 || s.tax_minor != 0 || s.rail_fee_minor != 0 {
        return Err(DomainError::InvalidFeePolicy);
    }
    if s.total_charged_minor <= 0 || s.merchant_net_minor != s.total_charged_minor {
        return Err(DomainError::SplitsMismatch);
    }
    Ok((
        vec![Leg {
            party_id: s.merchant_party_id.to_string(),
            account_type: AccountType::Wallet as i32,
            amount_minor: s.total_charged_minor,
        }],
        s.total_charged_minor,
    ))
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

    /// F11.10: destinatario de una transferencia por su código personal. Solo con saldo
    /// PlentyPay, sin splits ni referencia propia, con `wallet:transfer`, nunca a uno mismo y a una
    /// persona activa con un código vigente.
    async fn transfer_recipient(&self, actor: &Actor, cmd: &CreateIntent) -> Result<Uuid, Error> {
        let rc = match self.store.receive_code(&cmd.terminal_code).await {
            Ok(rc) => rc,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        if rc.expires_at <= Utc::now() {
            return Err(Error::NotFound);
        }
        if !actor.has("wallet:transfer") {
            return Err(Error::PermissionDenied);
        }
        if cmd.rail != RAIL_WALLET || !cmd.reference_type.is_empty() || !cmd.splits.is_empty() {
            return Err(DomainError::InvalidReference.into());
        }
        if rc.user_id == actor.user()? {
            return Err(Error::SelfTransfer);
        }
        if self
            .clients
            .person_name(&actor.request_id, rc.user_id)
            .await?
            .is_none()
        {
            return Err(Error::NotFound);
        }
        Ok(rc.user_id)
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
        let is_topup = cmd.reference_type == REF_TOPUP;
        let intent_id = Uuid::now_v7();
        // F11.10: un código de enlace /t/ que no es de un punto de cobro puede ser el código
        // personal de alguien: entonces es una transferencia (R10, T4) a esa persona.
        let transfer_to = if !is_topup && !cmd.terminal_code.is_empty() {
            match self.store.terminal_by_code(&cmd.terminal_code).await {
                Ok(_) => None,
                Err(StoreError::NotFound) => Some(self.transfer_recipient(actor, &cmd).await?),
                Err(e) => return Err(e.into()),
            }
        } else {
            None
        };
        let is_transfer = transfer_to.is_some();
        // R10: la recarga y la transferencia se identifican por su propio intent.
        let reference_type = if is_transfer {
            REF_TRANSFER.to_string()
        } else {
            cmd.reference_type.clone()
        };
        let reference_id = if (is_topup && cmd.reference_id.is_empty()) || is_transfer {
            intent_id.to_string()
        } else {
            cmd.reference_id.clone()
        };
        request::reference(&reference_type, &reference_id)?;
        for s in &cmd.splits {
            request::reference(&s.reference_type, &s.reference_id)?;
        }
        // WALLET o un riel externo conocido (sandbox, F11.7). Una recarga nunca sale de la wallet.
        let external = if cmd.rail == RAIL_WALLET {
            None
        } else {
            Some(rails::external(cmd.rail).ok_or(Error::RailDisabled)?)
        };
        if is_topup && external.is_none() {
            return Err(DomainError::InvalidReference.into());
        }
        let ttl = match i64::from(cmd.expires_in_seconds) {
            0 => i64::try_from(self.default_ttl.as_secs()).unwrap_or(900),
            s if (1..=MAX_INTENT_TTL_SECONDS).contains(&s) => s,
            _ => return Err(Error::InvalidExpiration),
        };

        // Quién cobra y quién paga: el comercio de la terminal (paga la persona del contexto) o el
        // negocio del contexto (cobra; el pagador se fija al confirmar).
        let (tenant_id, created_by, payer, terminal) = if is_topup {
            // R10/T1: la persona se recarga a sí misma; el dueño contable es la plataforma.
            if !actor.has("wallet:topup") || !cmd.terminal_code.is_empty() {
                return Err(Error::PermissionDenied);
            }
            let user = actor.user()?;
            (platform_party(), user, Some(user), None)
        } else if is_transfer {
            // La persona que envía paga; el dueño contable es la plataforma, como en T1.
            let user = actor.user()?;
            (platform_party(), user, Some(user), None)
        } else if !cmd.terminal_code.is_empty() {
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
        } else if actor.service == "orders" && actor.tenant_id.is_none() {
            // Pedido del marketplace (orders R3.4): un cobro con un split por comercio que paga la
            // persona del contexto (el comprador). El dueño contable del intent es la plataforma;
            // cada comercio cobra su split. Sin splits no hay a quién cobrar.
            if cmd.splits.is_empty() {
                return Err(DomainError::SplitsMismatch.into());
            }
            let buyer = actor.user()?;
            (platform_party(), buyer, Some(buyer), None)
        } else if actor.has("payments:charge") || actor.is_internal_charger() {
            let tenant = actor.tenant_id.ok_or(Error::PermissionDenied)?;
            (tenant, actor.user_id.unwrap_or_else(Uuid::nil), None, None)
        } else {
            return Err(Error::PermissionDenied);
        };

        let splits: Vec<SplitJson> = if let Some(to) = transfer_to {
            vec![SplitJson {
                merchant_party_id: to,
                amount_minor: cmd.amount_minor,
                reference_type: String::new(),
                reference_id: String::new(),
            }]
        } else if is_topup {
            if !cmd.splits.is_empty() {
                return Err(DomainError::SplitsMismatch.into());
            }
            vec![SplitJson {
                merchant_party_id: created_by,
                amount_minor: cmd.amount_minor,
                reference_type: String::new(),
                reference_id: String::new(),
            }]
        } else if cmd.splits.is_empty() {
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

        // Los splits de un cobro son negocios; el de una transferencia es una persona, ya
        // verificada como activa en `transfer_recipient`.
        if !is_topup && !is_transfer {
            for s in &splits {
                self.require_active(&actor.request_id, s.merchant_party_id)
                    .await?;
            }
        }
        let flags = self.clients.flags(&actor.request_id, tenant_id).await?;
        if !flags.payments_enabled || external.is_some_and(|r| !flags.rail_enabled(r.flag)) {
            return Err(Error::RailDisabled);
        }
        let limits = self.clients.limits(&actor.request_id).await?;
        let now = Utc::now();
        let fees = self
            .fees_for(is_topup || is_transfer, cmd.rail, &splits, now)
            .await?;
        let charged = fees
            .splits
            .iter()
            .try_fold(0i64, |acc, s| acc.checked_add(s.total_charged_minor))
            .ok_or(DomainError::Overflow)?;
        if charged > limits.max_payment_minor {
            return Err(DomainError::AmountOutOfRange.into());
        }
        // El step-up protege el dinero que sale; una recarga trae dinero (N-AML-05 se revisa aparte).
        if payer.is_some() && !is_topup && charged >= limits.step_up_threshold_minor {
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
                id: intent_id,
                tenant_id,
                created_by,
                payer_party_id: payer,
                amount_minor: cmd.amount_minor,
                currency: cmd.currency.clone(),
                rail: cmd.rail,
                terminal_id: terminal,
                reference_type,
                reference_id,
                metadata: serde_json::to_value(&cmd.metadata).map_err(StoreError::from)?,
                splits,
                // R13: sin credenciales, todo riel externo es sandbox; la wallet, hasta N-AML-01.
                sandbox: external.is_some() || !flags.wallet_real_money,
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
        let payer = actor.user()?;
        let intent = match self.store.intent(&Scope::service(), intent_id).await {
            Ok(i) => i,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        let is_topup = intent.reference_type == REF_TOPUP;
        let is_transfer = intent.reference_type == REF_TRANSFER;
        if !actor.has(if is_topup {
            "wallet:topup"
        } else if is_transfer {
            "wallet:transfer"
        } else {
            "wallet:pay"
        }) {
            return Err(Error::PermissionDenied);
        }
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
                self.drive(&actor.request_id, p, true).await?;
            }
            return self
                .view(self.store.intent(&Scope::service(), intent_id).await?)
                .await;
        }
        let external = if intent.rail == RAIL_WALLET {
            None
        } else {
            Some(rails::external(intent.rail).ok_or(Error::RailDisabled)?)
        };
        if is_transfer {
            // F11.10: el destinatario sigue activo al confirmar.
            for s in &intent.splits {
                if self
                    .clients
                    .person_name(&actor.request_id, s.merchant_party_id)
                    .await?
                    .is_none()
                {
                    return Err(Error::NotFound);
                }
            }
        } else if !is_topup {
            for s in &intent.splits {
                self.require_active(&actor.request_id, s.merchant_party_id)
                    .await?;
            }
        }
        let flags = self
            .clients
            .flags(&actor.request_id, intent.tenant_id)
            .await?;
        if !flags.payments_enabled || external.is_some_and(|r| !flags.rail_enabled(r.flag)) {
            return Err(Error::RailDisabled);
        }
        let limits = self.clients.limits(&actor.request_id).await?;
        let now = Utc::now();
        let fees = self
            .fees_for(is_topup || is_transfer, intent.rail, &intent.splits, now)
            .await?;
        let charged = total_charged(&fees)?;
        if charged > limits.max_payment_minor {
            return Err(DomainError::AmountOutOfRange.into());
        }
        // Un cobro creado por el comercio no tenía pagador: la confirmación fuerte va aquí.
        if intent.payer_party_id.is_none() && !is_topup && charged >= limits.step_up_threshold_minor
        {
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
        self.drive(&actor.request_id, p, false).await?;
        self.view(self.store.intent(&Scope::service(), intent_id).await?)
            .await
    }

    /// Lleva un pago a su estado final por su riel. `resume` = el pago ya había llegado al riel
    /// (reintento o job): un riel externo se consulta en vez de iniciarse otra vez.
    pub async fn drive(
        &self,
        request_id: &str,
        p: PaymentRow,
        resume: bool,
    ) -> Result<PaymentRow, Error> {
        if p.rail == RAIL_WALLET {
            self.drive_wallet(request_id, p).await
        } else {
            self.drive_external(request_id, p, resume).await
        }
    }

    /// F11.7: cobro por riel externo (sandbox, R13). Aprobado → CAPTURED con el asiento pendiente
    /// para el worker (R8) e intento de asentarlo ya; rechazado → FAILED; ambiguo → UNKNOWN (R7).
    /// Ninguna transacción de BD abarca la llamada al riel (R6).
    #[tracing::instrument(skip_all, err, fields(pp.payment_id = %p.id))]
    pub async fn drive_external(
        &self,
        request_id: &str,
        p: PaymentRow,
        resume: bool,
    ) -> Result<PaymentRow, Error> {
        if p.status.is_terminal() {
            return Ok(p);
        }
        let spec = rails::external(p.rail).ok_or(Error::RailDisabled)?;
        let key = format!("pay:{}", p.id);
        let sandbox = rails::SandboxRail;
        let (op, r) = if resume || p.status == PaymentStatus::Unknown {
            ("query", sandbox.query(spec, &key, p.amount_minor))
        } else {
            ("start", sandbox.start(spec, &key, p.amount_minor))
        };
        self.metrics
            .rail_requests
            .with_label_values(&[
                spec.name,
                op,
                match &r {
                    Ok(rails::RailOutcome::Approved { .. }) => "ok",
                    Ok(rails::RailOutcome::Declined { .. }) => "declined",
                    Err(_) => "ambiguous",
                },
            ])
            .inc();
        match r {
            Ok(rails::RailOutcome::Approved { external_ref }) => {
                let (done, changed) = self
                    .store
                    .complete_capture(
                        p.id,
                        Capture {
                            external_ref: Some(&external_ref),
                            ..Default::default()
                        },
                    )
                    .await?;
                if changed {
                    self.metrics
                        .payments
                        .with_label_values(&[spec.name, "CAPTURED"])
                        .inc();
                    self.metrics
                        .amount_minor
                        .with_label_values(&[spec.name, &done.currency])
                        .inc_by(u64::try_from(done.captured_minor).unwrap_or(0));
                    tracing::info!(pp.payment_id = %done.id, pp.rail = spec.name, "payment captured by rail");
                }
                // El asiento se intenta ya para que el saldo refleje el cobro al instante; si el
                // ledger no responde, el worker lo reintenta (R8).
                self.post_pending_payment(request_id, done.id).await?;
                Ok(self.store.payment(&Scope::service(), done.id).await?)
            }
            Ok(rails::RailOutcome::Declined { code }) => {
                let (out, changed) = self.store.fail_payment(p.id, &code).await?;
                if changed {
                    self.metrics
                        .payments
                        .with_label_values(&[spec.name, "FAILED"])
                        .inc();
                }
                Ok(out)
            }
            Err(e) => {
                let since = self.store.unknown_since(p.id).await?;
                let out = self
                    .store
                    .mark_unknown(p.id, next_check(since, Utc::now()))
                    .await?;
                if since.is_none() {
                    self.metrics
                        .payments
                        .with_label_values(&[spec.name, "UNKNOWN"])
                        .inc();
                }
                tracing::warn!(pp.payment_id = %p.id, err = %e, "payment unknown: rail answer ambiguous");
                Ok(out)
            }
        }
    }

    /// R10/R3: una recarga no lleva comisión (T1 no tiene líneas de comisión); un cobro se tarifa
    /// con la política de cada comercio.
    async fn fees_for(
        &self,
        is_topup: bool,
        rail: i16,
        splits: &[SplitJson],
        at: DateTime<Utc>,
    ) -> Result<FrozenFees, Error> {
        if !is_topup {
            return self.price(rail, splits, at).await;
        }
        Ok(FrozenFees {
            fee_policy_id: Uuid::nil(),
            splits: splits
                .iter()
                .map(|s| SplitFees {
                    merchant_party_id: s.merchant_party_id,
                    gross_minor: s.amount_minor,
                    platform_fee_minor: 0,
                    tax_minor: 0,
                    rail_fee_minor: 0,
                    merchant_net_minor: s.amount_minor,
                    total_charged_minor: s.amount_minor,
                })
                .collect(),
        })
    }

    /// R8: pide al ledger el asiento de un pago capturado por riel externo (T1 recarga, T2 cobro)
    /// con su clave determinista; repetirlo no duplica nada. Devuelve si quedó POSTED.
    pub async fn post_pending_payment(
        &self,
        request_id: &str,
        payment_id: Uuid,
    ) -> Result<bool, Error> {
        let Some(pending) = self
            .store
            .posting_pending(500)
            .await?
            .into_iter()
            .find(|p| p.payment.id == payment_id)
        else {
            return Ok(false);
        };
        self.post_one(request_id, &pending).await
    }

    async fn post_one(&self, request_id: &str, pending: &PendingPosting) -> Result<bool, Error> {
        let p = &pending.payment;
        let spec = rails::external(p.rail)
            .ok_or(StoreError::Corrupt("posting for a non-external rail"))?;
        let fees = p
            .fees
            .clone()
            .ok_or(StoreError::Corrupt("payment without fees"))?;
        let is_topup = pending.reference_type == REF_TOPUP;
        let (key, ttype, tenant, entries) = if is_topup {
            let payer = p
                .payer_party_id
                .ok_or(StoreError::Corrupt("topup without payer"))?;
            (
                format!("topup:{}", p.id),
                "WALLET_TOPUP",
                None,
                topup_entries(spec, payer, p.amount_minor),
            )
        } else {
            (
                format!("pay:{}", p.id),
                "PAYMENT_CAPTURE",
                Some(p.tenant_id),
                external_capture_entries(spec, &fees)?,
            )
        };
        let pid = p.id.to_string();
        match self
            .clients
            .post_transaction(
                request_id,
                &key,
                tenant,
                ttype,
                ("payment", &pid),
                &p.currency,
                &entries,
            )
            .await
        {
            Ok(txid) => {
                if self.store.mark_posted(p.id, txid).await? {
                    tracing::info!(pp.payment_id = %p.id, pp.ledger_transaction_id = %txid, pp.transaction_type = ttype, "payment posted to ledger");
                }
                Ok(true)
            }
            Err(e) if e.is_ambiguous() => {
                self.store.note_posting_error(p.id, &e.to_string()).await?;
                tracing::warn!(pp.payment_id = %p.id, err = %e, "ledger posting deferred");
                Ok(false)
            }
            Err(e) => {
                // Un asiento rechazado es un defecto: el pago quedó cobrado sin reflejo contable.
                self.store.mark_posting_failed(p.id, e.reason()).await?;
                tracing::error!(pp.payment_id = %p.id, error.type = "ledger_posting", err = %e, "ledger posting failed");
                Ok(false)
            }
        }
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
        // F11.10: una transferencia acredita la billetera del destinatario (T4, `p2p:<id>`); un
        // pago a comercio, su cuenta por pagar y las comisiones (T3, `pay:<id>`).
        let intent = self.store.intent(&Scope::service(), p.intent_id).await?;
        let (legs, total, ttype, key) = if intent.reference_type == REF_TRANSFER {
            let (legs, total) = transfer_legs(&fees)?;
            (legs, total, "P2P_TRANSFER", format!("p2p:{}", p.id))
        } else {
            let (legs, total) = wallet_legs(&fees)?;
            (legs, total, "WALLET_PAYMENT", format!("pay:{}", p.id))
        };
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
            .capture_hold(
                request_id, p.id, hold_id, p.tenant_id, &p.currency, &legs, ttype, &key,
            )
            .await;
        self.count_rail(rail, "capture_hold", &r);
        match r {
            Ok(txid) => {
                let (done, changed) = self
                    .store
                    .complete_capture(
                        p.id,
                        Capture {
                            ledger_transaction_id: Some(txid),
                            ..Default::default()
                        },
                    )
                    .await?;
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
        if !actor.has("payments:read") && !actor.is_internal_charger() && !actor.is_internal_reader() {
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

    /// R8 (F11.4): asienta los pagos capturados por riel externo que aún no tienen asiento.
    /// Devuelve cuántos quedaron POSTED.
    pub async fn post_pending(&self) -> Result<usize, Error> {
        let mut posted = 0usize;
        for p in self.store.posting_pending(50).await? {
            if self.post_one("job:post_pending", &p).await? {
                posted = posted.saturating_add(1);
            }
        }
        Ok(posted)
    }

    /// R7 (F11.7): consulta al riel los pagos externos UNKNOWN o a medio camino cuyo turno venció.
    pub async fn resume_external_payments(&self) -> Result<usize, Error> {
        let mut resolved = 0usize;
        for p in self.store.due_external_payments(50).await? {
            let id = p.id;
            if !self.store.claim(id).await? {
                continue;
            }
            match self.drive_external("job:resume_external", p, true).await {
                Ok(done) if done.status.is_terminal() => resolved = resolved.saturating_add(1),
                Ok(_) => {}
                Err(e) => {
                    tracing::error!(pp.payment_id = %id, err = %e, "external payment resume failed")
                }
            }
        }
        Ok(resolved)
    }

    /// ResolveUnknownPayment (domain-model §6.3 paso 5): plataforma fija el estado final de un pago
    /// UNKNOWN por riel externo con evidencia obligatoria. CAPTURED deja el asiento al worker (R8).
    /// Un pago de wallet no se resuelve a mano: el ledger es la fuente y el job lo resuelve.
    pub async fn resolve_unknown(
        &self,
        actor: &Actor,
        payment_id: Uuid,
        resolution: PaymentStatus,
        evidence: &str,
    ) -> Result<PaymentRow, Error> {
        if !actor.has("platform:reconcile") {
            return Err(Error::PermissionDenied);
        }
        let user = actor.user()?;
        let evidence = evidence.trim();
        if evidence.is_empty() {
            return Err(Error::EvidenceRequired);
        }
        let p = match self.store.payment(&Scope::service(), payment_id).await {
            Ok(p) => p,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        if p.status == resolution {
            return Ok(p);
        }
        if p.status != PaymentStatus::Unknown || p.rail == RAIL_WALLET {
            return Err(DomainError::InvalidStateTransition.into());
        }
        let out = match resolution {
            PaymentStatus::Captured => {
                let (done, _) = self
                    .store
                    .complete_capture(
                        p.id,
                        Capture {
                            resolution: Some((evidence, user)),
                            ..Default::default()
                        },
                    )
                    .await?;
                self.post_pending_payment(&actor.request_id, done.id)
                    .await?;
                self.store.payment(&Scope::service(), done.id).await?
            }
            PaymentStatus::Failed => {
                self.store
                    .fail_payment_with(p.id, "RESOLVED_FAILED", Some((evidence, user)))
                    .await?
                    .0
            }
            _ => return Err(DomainError::InvalidStateTransition.into()),
        };
        tracing::info!(pp.payment_id = %p.id, resolution = resolution.name(), actor = %user, "unknown payment resolved manually");
        Ok(out)
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

    /// Resuelve el código de un enlace `/t/`: primero un punto de cobro activo de un negocio
    /// activo; si no hay, el código personal vigente de una persona (F11.10). Vencido, inexistente
    /// o de una persona que ya no está activa → NOT_FOUND, sin decir cuál (grpc-conventions §4).
    pub async fn resolve_pay_code(&self, actor: &Actor, code: &str) -> Result<PayCode, Error> {
        match self.resolve_terminal(actor, code).await {
            Ok((t, name)) => return Ok(PayCode::Terminal(t, name)),
            Err(Error::NotFound) => {}
            Err(e) => return Err(e),
        }
        let rc = match self.store.receive_code(code).await {
            Ok(rc) => rc,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        if rc.expires_at <= Utc::now() {
            return Err(Error::NotFound);
        }
        if self
            .clients
            .person_name(&actor.request_id, rc.user_id)
            .await?
            .is_none()
        {
            return Err(Error::NotFound);
        }
        Ok(PayCode::Person(rc))
    }

    /// GetMyReceiveCode (F11.10, S-WAL-04): el código vigente de la persona o uno nuevo de 24 h.
    #[tracing::instrument(skip_all, err)]
    pub async fn receive_code(&self, actor: &Actor) -> Result<ReceiveCodeRow, Error> {
        if !actor.has("wallet:read") {
            return Err(Error::PermissionDenied);
        }
        let user = actor.user()?;
        let full = self
            .clients
            .person_name(&actor.request_id, user)
            .await?
            .ok_or(Error::NotFound)?;
        let mut display = short_name(&full);
        if display.is_empty() {
            display = "PlentyPay".into();
        }
        let now = Utc::now();
        let fresh = ReceiveCodeRow {
            code: new_public_code(),
            user_id: user,
            display_name: display,
            created_at: now,
            expires_at: now
                .checked_add_signed(chrono::Duration::hours(RECEIVE_CODE_TTL_HOURS))
                .ok_or(DomainError::Overflow)?,
        };
        Ok(self
            .store
            .receive_code_for(
                user,
                chrono::Duration::minutes(RECEIVE_CODE_MIN_LEFT_MINUTES),
                fresh,
            )
            .await?)
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

    /// settlement SPEC §7: settlement lee cobros de cualquier negocio, pero no cobra.
    #[test]
    fn settlement_reads_any_tenant_but_never_charges() {
        let a = Actor {
            service: "settlement".into(),
            ..Default::default()
        };
        assert!(a.is_internal_reader());
        assert!(!a.is_internal_charger());
        assert!(a.read_scope().service);
        let other = Actor {
            service: "analytics-bi".into(),
            ..Default::default()
        };
        assert!(!other.is_internal_reader() && !other.read_scope().service);
    }

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

// ── Reembolsos (F11.6, R11, domain-model §4.4, T7) ─────────────────────────────────────────

/// Turno de quien conduce un reembolso antes de que el job lo retome.
const REFUND_LEASE_SECONDS: i64 = 30;

/// T7 (domain-model §5.2): D MERCHANT_PAYABLE(m) merchant_debit · D PLATFORM_FEES pf_r ·
/// D TAX_PAYABLE tax_r · D RAIL_FEES_PAYABLE(riel) rf_r · C WALLET(pagador) o RAIL_RECEIVABLE(riel)
/// lo que vuelve al pagador. Balanceado por construcción.
pub fn refund_entries(ctx: &crate::store::refunds::RefundContext) -> Result<Vec<EntryLine>, Error> {
    let r = &ctx.refund;
    let rail = rails::external(ctx.payment.rail);
    let rail_scope = rail.map(|x| x.name).unwrap_or("");
    let mut out = Vec::new();
    for (party, kind, scope, amount) in [
        (
            r.merchant_party_id.to_string(),
            AccountType::MerchantPayable,
            "",
            r.fee_reversal.merchant_debit,
        ),
        (
            PLATFORM_PARTY.to_string(),
            AccountType::PlatformFees,
            "",
            r.fee_reversal.pf_r,
        ),
        (
            PLATFORM_PARTY.to_string(),
            AccountType::TaxPayable,
            "",
            r.fee_reversal.tax_r,
        ),
        (
            PLATFORM_PARTY.to_string(),
            AccountType::RailFeesPayable,
            rail_scope,
            r.fee_reversal.rf_r,
        ),
    ] {
        if amount > 0 {
            out.push(EntryLine {
                party_id: party,
                account_type: kind as i32,
                scope_id: scope.into(),
                debit: true,
                amount_minor: amount,
            });
        }
    }
    let credit = match (rail, ctx.payment.payer_party_id) {
        (None, Some(payer)) => EntryLine {
            party_id: payer.to_string(),
            account_type: AccountType::Wallet as i32,
            scope_id: String::new(),
            debit: false,
            amount_minor: r.payer_credit_minor,
        },
        (Some(x), _) => EntryLine {
            party_id: PLATFORM_PARTY.into(),
            account_type: AccountType::RailReceivable as i32,
            scope_id: x.name.into(),
            debit: false,
            amount_minor: r.payer_credit_minor,
        },
        (None, None) => return Err(StoreError::Corrupt("wallet payment without payer").into()),
    };
    out.push(credit);
    Ok(out)
}

/// Lo que se devuelve al llamador.
#[derive(Debug, Clone)]
pub struct RefundView {
    pub refund: crate::store::refunds::RefundRow,
    pub currency: String,
}

impl PaymentsCore {
    /// RefundPayment: una persona del comercio dueño del split (`payments:refund` + step-up) o un
    /// servicio interno (orders/pos, reembolso de sistema auditado, sin step-up: orders R4).
    #[tracing::instrument(skip_all, err, fields(pp.payment_id = %payment_id))]
    #[allow(clippy::too_many_arguments)]
    pub async fn refund_payment(
        &self,
        actor: &Actor,
        payment_id: Uuid,
        merchant_party_id: Option<Uuid>,
        amount_minor: i64,
        reason: &str,
        idempotency_key: &str,
        step_up_token: &str,
    ) -> Result<RefundView, Error> {
        use crate::store::refunds::{NewRefund, RefundError};
        request::idempotency_key(idempotency_key)?;
        if amount_minor < 0 || reason.chars().count() > 300 {
            return Err(DomainError::AmountOutOfRange.into());
        }
        let internal = actor.is_internal_charger();
        let merchant = if internal {
            merchant_party_id
        } else {
            if !actor.has("payments:refund") {
                return Err(Error::PermissionDenied);
            }
            // Una persona solo reembolsa el split de su propio negocio y dice cuánto (R5 ata el
            // step-up a ese monto).
            let tenant = actor.tenant_id.ok_or(Error::PermissionDenied)?;
            if merchant_party_id.is_some_and(|m| m != tenant) {
                return Err(Error::PermissionDenied);
            }
            if amount_minor == 0 {
                return Err(DomainError::AmountOutOfRange.into());
            }
            // R1: el reintento devuelve el original antes de gastar otro step-up.
            if self
                .store
                .refund_by_key(tenant, idempotency_key)
                .await?
                .is_none()
            {
                let token = if step_up_token.is_empty() {
                    actor.step_up.as_str()
                } else {
                    step_up_token
                };
                self.step_up(actor, token, STEP_UP_REFUND, amount_minor, "USD")
                    .await?;
            }
            Some(tenant)
        };
        let created = self
            .store
            .create_refund(
                NewRefund {
                    payment_id,
                    merchant_party_id: merchant,
                    amount_minor,
                    reason,
                    idempotency_key,
                    created_by: actor.user_id,
                },
                chrono::Duration::seconds(REFUND_LEASE_SECONDS),
            )
            .await;
        let ctx = match created {
            Ok(c) => c,
            Err(RefundError::NotCaptured) => return Err(Error::PaymentNotCaptured),
            Err(RefundError::SplitRequired) => return Err(Error::RefundSplitRequired),
            Err(RefundError::Domain(d)) => return Err(d.into()),
            Err(RefundError::Store(StoreError::NotFound)) => return Err(Error::NotFound),
            Err(RefundError::Store(e)) => return Err(e.into()),
        };
        let currency = ctx.payment.currency.clone();
        let refund = if ctx.refund.status == crate::store::refunds::REFUND_PENDING {
            self.drive_refund(&actor.request_id, &ctx).await?
        } else {
            ctx.refund.clone()
        };
        if refund.status == crate::store::refunds::REFUND_FAILED
            && refund.failure_code == "MERCHANT_BALANCE_INSUFFICIENT"
            && ctx.created
        {
            return Err(Error::MerchantBalanceInsufficient);
        }
        self.metrics.inc_refund(refund.status);
        Ok(RefundView { refund, currency })
    }

    /// Asienta T7 con la clave `refund:<id>` (idempotente en el ledger) y cierra el reembolso.
    /// Ambiguo → sigue PENDING para el job (nunca se marca fallido sin saberlo).
    async fn drive_refund(
        &self,
        request_id: &str,
        ctx: &crate::store::refunds::RefundContext,
    ) -> Result<crate::store::refunds::RefundRow, Error> {
        let entries = refund_entries(ctx)?;
        let key = format!("refund:{}", ctx.refund.id);
        match self
            .clients
            .post_transaction(
                request_id,
                &key,
                Some(ctx.refund.merchant_party_id),
                "REFUND",
                ("refund", &ctx.refund.id.to_string()),
                &ctx.payment.currency,
                &entries,
            )
            .await
        {
            Ok(tx) => Ok(self.store.refund_succeeded(ctx.refund.id, tx).await?),
            Err(DependencyError::Definitive { reason, .. }) => {
                let code = if reason == "INSUFFICIENT_FUNDS" {
                    "MERCHANT_BALANCE_INSUFFICIENT"
                } else {
                    reason.as_str()
                };
                Ok(self.store.refund_failed(ctx.refund.id, code).await?)
            }
            Err(e) => {
                tracing::warn!(pp.refund_id = %ctx.refund.id, error = %e, "refund posting ambiguous, left pending");
                Ok(ctx.refund.clone())
            }
        }
    }

    /// Job: retoma los reembolsos PENDING cuyo turno venció (mismo asiento, misma clave).
    pub async fn resume_refunds(&self) -> Result<usize, Error> {
        let ids = self
            .store
            .due_refunds(50, chrono::Duration::seconds(60))
            .await?;
        let mut done: usize = 0;
        for id in ids {
            let ctx = self.store.refund_context(id).await?;
            let r = self.drive_refund("job-refunds", &ctx).await?;
            if r.status != crate::store::refunds::REFUND_PENDING {
                done = done.saturating_add(1);
            }
        }
        Ok(done)
    }

    /// GetRefund: el comercio del split (`payments:read`) o un servicio interno.
    pub async fn get_refund(&self, actor: &Actor, id: Uuid) -> Result<RefundView, Error> {
        let scope = if actor.is_internal_charger() || actor.is_internal_reader() {
            Scope::service()
        } else {
            if !actor.has("payments:read") && !actor.has("payments:refund") {
                return Err(Error::PermissionDenied);
            }
            Scope {
                service: false,
                tenant_id: actor.tenant_id.ok_or(Error::PermissionDenied)?.to_string(),
                party_id: String::new(),
            }
        };
        let refund = match self.store.refund(&scope, id).await {
            Ok(r) => r,
            Err(StoreError::NotFound) => return Err(Error::NotFound),
            Err(e) => return Err(e.into()),
        };
        let payment = self
            .store
            .payment(&Scope::service(), refund.payment_id)
            .await?;
        Ok(RefundView {
            refund,
            currency: payment.currency,
        })
    }
}
