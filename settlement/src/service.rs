//! Casos de uso de settlement (SPEC §4). El negocio y la persona salen de los metadatos (ADR 0011);
//! los montos de los lotes salen del extracto de `MERCHANT_PAYABLE` del ledger, que ya trae los
//! repartos del marketplace y los reembolsos; settlement solo pide los asientos T6/T6b.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use prost::Message;
use uuid::Uuid;

use crate::clients::{DependencyError, Deps};
use crate::domain::{
    self, BatchStatus, DomainError, Frequency, ItemKind, Line, DEST_BANK, DEST_WALLET,
};
use crate::events;
use crate::observability::Metrics;
use crate::pb;
use crate::store::{
    BatchRow, DestinationUpdate, NewBatch, OutboxEvent, PgSettlement, ScheduleRow, ScheduleUpdate,
    Scope, StoreError,
};

/// Operación del catálogo de confirmación fuerte para cambiar el destino (identity domain/stepup.go).
pub const STEP_UP_DESTINATION: &str = "settlement.destination.update";
pub const CURRENCY: &str = "USD";
/// El ledger no da extractos de más de 366 días.
const MAX_LOOKBACK_DAYS: i64 = 365;

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
    #[error("step-up required")]
    StepUpRequired,
    #[error("step-up invalid: {0}")]
    StepUpInvalid(String),
    #[error("not found")]
    NotFound,
}

/// Quién llama, desde los metadatos (ADR 0011): nunca del cuerpo.
#[derive(Debug, Clone, Default)]
pub struct Actor {
    pub service: String,
    pub user_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub permissions: Vec<String>,
    pub request_id: String,
    pub step_up: String,
}

impl Actor {
    pub fn has(&self, perm: &str) -> bool {
        self.permissions.iter().any(|p| p == perm)
    }

    fn tenant_with(&self, perms: &[&str]) -> Result<Uuid, Error> {
        let t = self.tenant_id.ok_or(Error::PermissionDenied)?;
        if perms.iter().any(|p| self.has(p)) {
            Ok(t)
        } else {
            Err(Error::PermissionDenied)
        }
    }

    fn platform(&self) -> bool {
        self.has("platform:reconcile")
    }
}

/// Calendario tal como se muestra (sin calendario guardado: billetera, manual).
#[derive(Debug, Clone)]
pub struct ScheduleView {
    pub configured: bool,
    pub row: ScheduleRow,
}

fn default_schedule(tenant: Uuid, now: DateTime<Utc>) -> ScheduleRow {
    ScheduleRow {
        tenant_id: tenant,
        frequency: Frequency::Manual as i16,
        weekday: 0,
        minimum_payout_minor: 100,
        hold_days: 1,
        destination_kind: DEST_WALLET.into(),
        destination_bank: String::new(),
        destination_account_type: String::new(),
        destination_last4: String::new(),
        destination_holder: String::new(),
        has_ciphertext: false,
        payouts_blocked_until: None,
        idempotency_key: String::new(),
        updated_at: now,
        version: 0,
    }
}

/// Lo que la persona pide al configurar el calendario.
#[derive(Debug, Clone, Default)]
pub struct ScheduleInput {
    pub frequency: i32,
    pub weekday: i32,
    pub minimum_payout_minor: i64,
    pub destination: Option<DestinationInput>,
    pub step_up_token: String,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, Default)]
pub struct DestinationInput {
    pub kind: String,
    pub bank: String,
    pub account_type: String,
    pub account_number: String,
    pub holder: String,
}

/// Cabecera de S-FIN-05.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Summary {
    pub pending_minor: i64,
    pub processing_minor: i64,
    pub next_payout_at: Option<DateTime<Utc>>,
}

pub struct Settlement {
    store: PgSettlement,
    deps: Arc<dyn Deps>,
    metrics: Arc<Metrics>,
    now: fn() -> DateTime<Utc>,
}

fn outbox<M: Message>(
    subject: &str,
    tenant: Uuid,
    aggregate: Uuid,
    msg: &M,
    at: DateTime<Utc>,
) -> OutboxEvent {
    OutboxEvent {
        id: Uuid::now_v7(),
        tenant_id: tenant,
        aggregate_id: aggregate,
        event_type: subject.to_string(),
        payload: msg.encode_to_vec(),
        at,
    }
}

fn ts(t: DateTime<Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp {
        seconds: t.timestamp(),
        nanos: i32::try_from(t.timestamp_subsec_nanos()).unwrap_or(0),
    }
}

impl Settlement {
    pub fn new(store: PgSettlement, deps: Arc<dyn Deps>, metrics: Arc<Metrics>) -> Self {
        Self::with_clock(store, deps, metrics, Utc::now)
    }

    pub fn with_clock(
        store: PgSettlement,
        deps: Arc<dyn Deps>,
        metrics: Arc<Metrics>,
        now: fn() -> DateTime<Utc>,
    ) -> Self {
        Self {
            store,
            deps,
            metrics,
            now,
        }
    }

    async fn schedule_of(&self, tenant: Uuid) -> Result<ScheduleView, Error> {
        Ok(
            match self.store.schedule(&Scope::tenant(tenant), tenant).await? {
                Some(row) => ScheduleView {
                    configured: true,
                    row,
                },
                None => ScheduleView {
                    configured: false,
                    row: default_schedule(tenant, (self.now)()),
                },
            },
        )
    }

    // ── Calendario (F12.2) ───────────────────────────────────────────────────────────────

    pub async fn get_schedule(&self, a: &Actor) -> Result<ScheduleView, Error> {
        let t = a.tenant_with(&["settlement:read", "settlement:schedule:manage"])?;
        self.schedule_of(t).await
    }

    /// Guarda el calendario. Un destino nuevo exige step-up `settlement.destination.update`, se
    /// valida antes de gastar la confirmación, se cifra en security y, si es bancario, bloquea los
    /// pagos 48 h (R5).
    pub async fn set_schedule(
        &self,
        a: &Actor,
        input: ScheduleInput,
    ) -> Result<ScheduleView, Error> {
        let t = a.tenant_with(&["settlement:schedule:manage"])?;
        let user = a.user_id.ok_or(Error::PermissionDenied)?;
        domain::check_idempotency_key(&input.idempotency_key)?;
        let freq = Frequency::from_code(input.frequency).ok_or(DomainError::InvalidArgument)?;
        let weekday = match freq {
            Frequency::Weekly if (1..=7).contains(&input.weekday) => input.weekday,
            Frequency::Weekly => return Err(DomainError::InvalidArgument.into()),
            _ => 0,
        };
        if !(0..=1_000_000_000).contains(&input.minimum_payout_minor) {
            return Err(DomainError::InvalidArgument.into());
        }
        let prev = self.store.schedule(&Scope::tenant(t), t).await?;
        if let Some(p) = &prev {
            if p.idempotency_key == input.idempotency_key {
                return Ok(ScheduleView {
                    configured: true,
                    row: p.clone(),
                });
            }
        }
        let now = (self.now)();
        let mut event = None;
        let destination = match input.destination {
            None => None,
            Some(d) => {
                let (bank, plain) = match d.kind.as_str() {
                    DEST_WALLET => (None, None),
                    DEST_BANK => {
                        let names = self.deps.tenant_names(&a.request_id, t).await?;
                        let refs: Vec<&str> = names.iter().map(String::as_str).collect();
                        let b = domain::validate_bank(
                            &d.bank,
                            &d.account_type,
                            &d.account_number,
                            &d.holder,
                            &refs,
                        )?;
                        let plain = b.account_number.clone();
                        (Some(b), Some(plain))
                    }
                    _ => return Err(DomainError::InvalidArgument.into()),
                };
                let token = if a.step_up.is_empty() {
                    input.step_up_token.clone()
                } else {
                    a.step_up.clone()
                };
                if token.is_empty() {
                    return Err(Error::StepUpRequired);
                }
                if let Some(reason) = self
                    .deps
                    .consume_step_up(&a.request_id, &token, user, STEP_UP_DESTINATION)
                    .await?
                {
                    return Err(Error::StepUpInvalid(reason));
                }
                let (ciphertext, key_version) = match &plain {
                    Some(p) => {
                        let (c, v) = self
                            .deps
                            .encrypt_destination(&a.request_id, t, p.as_bytes())
                            .await?;
                        (Some(c), v)
                    }
                    None => (None, String::new()),
                };
                let blocked_until = bank
                    .as_ref()
                    .and_then(|_| now.checked_add_signed(domain::destination_lock()));
                let upd = DestinationUpdate {
                    kind: d.kind.clone(),
                    bank: bank.as_ref().map(|b| b.bank.clone()).unwrap_or_default(),
                    account_type: bank
                        .as_ref()
                        .map(|b| b.account_type.clone())
                        .unwrap_or_default(),
                    ciphertext,
                    key_version,
                    last4: bank.as_ref().map(|b| b.last4()).unwrap_or_default(),
                    holder: bank.as_ref().map(|b| b.holder.clone()).unwrap_or_default(),
                    blocked_until,
                };
                event = Some(outbox(
                    events::DESTINATION_CHANGED,
                    t,
                    t,
                    &pb::PayoutDestinationChanged {
                        tenant_id: t.to_string(),
                        destination_kind: upd.kind.clone(),
                        destination_last4: upd.last4.clone(),
                        payouts_blocked_until: blocked_until.map(ts),
                    },
                    now,
                ));
                Some(upd)
            }
        };
        let row = self
            .store
            .upsert_schedule(
                &ScheduleUpdate {
                    tenant_id: t,
                    frequency: freq as i16,
                    weekday: i16::try_from(weekday).unwrap_or(0),
                    minimum_payout_minor: input.minimum_payout_minor,
                    destination,
                    idempotency_key: input.idempotency_key,
                    updated_by: Some(user),
                    at: now,
                },
                event.as_ref(),
            )
            .await?;
        Ok(ScheduleView {
            configured: true,
            row,
        })
    }

    pub async fn summary(&self, a: &Actor) -> Result<Summary, Error> {
        let t = a.tenant_with(&["settlement:read", "settlement:schedule:manage"])?;
        let s = self.schedule_of(t).await?;
        let available = self
            .deps
            .payable_available(&a.request_id, t, CURRENCY)
            .await?;
        let processing = self.store.processing_net(t).await?;
        let next = Frequency::from_code(i32::from(s.row.frequency))
            .filter(|_| s.configured)
            .and_then(|f| domain::next_payout_at(f, i32::from(s.row.weekday), (self.now)()));
        Ok(Summary {
            pending_minor: available.saturating_sub(processing).max(0),
            processing_minor: processing,
            next_payout_at: next,
        })
    }

    // ── Lotes (F12.3–F12.4) ──────────────────────────────────────────────────────────────

    /// «Liquidar ahora» del comercio (S-FIN-05).
    pub async fn create_batch(&self, a: &Actor, key: &str) -> Result<BatchRow, Error> {
        let t = a.tenant_with(&["settlement:schedule:manage"])?;
        domain::check_idempotency_key(key)?;
        let created_by = a
            .user_id
            .map(|u| u.to_string())
            .unwrap_or_else(|| a.service.clone());
        self.settle(&a.request_id, t, key, &created_by).await
    }

    /// Arma y crea el lote de un negocio (R1–R6). La misma clave devuelve el lote original.
    pub async fn settle(
        &self,
        request_id: &str,
        t: Uuid,
        key: &str,
        created_by: &str,
    ) -> Result<BatchRow, Error> {
        if let Some(b) = self.store.batch_by_key(t, key).await? {
            return Ok(b);
        }
        let s = self.schedule_of(t).await?.row;
        let now = (self.now)();
        let bank = s.destination_kind == DEST_BANK;
        if bank && s.payouts_blocked_until.is_some_and(|u| u > now) {
            return Err(DomainError::PayoutsBlocked.into());
        }
        let cutoff = now
            .checked_sub_signed(Duration::days(i64::from(s.hold_days)))
            .unwrap_or(now);
        let floor = now
            .checked_sub_signed(Duration::days(MAX_LOOKBACK_DAYS))
            .unwrap_or(now);
        let (settled, last) = self.store.settled(t, floor).await?;
        let from = last
            .and_then(|l| l.checked_sub_signed(Duration::days(1)))
            .filter(|f| *f > floor)
            .unwrap_or(floor);
        if cutoff <= from {
            return Err(DomainError::NothingToSettle.into());
        }
        let movements = self
            .deps
            .payable_movements(request_id, t, CURRENCY, from, cutoff)
            .await?;
        let mut sandbox_of: HashMap<String, bool> = HashMap::new();
        let mut lines: Vec<Line> = Vec::new();
        for m in movements {
            if settled.contains(&m.ledger_transaction_id) {
                continue;
            }
            let Some(candidate) = m.as_line(false) else {
                continue;
            };
            let sandbox = match sandbox_of.get(&candidate.reference_id) {
                Some(v) => *v,
                None => match self
                    .deps
                    .is_sandbox(request_id, candidate.kind, &candidate.reference_id)
                    .await
                {
                    Ok(v) => {
                        sandbox_of.insert(candidate.reference_id.clone(), v);
                        v
                    }
                    // Un asiento sin cobro conocido en payments-core no se liquida: se registra y espera.
                    Err(e @ DependencyError::Definitive { .. }) => {
                        tracing::warn!(pp.tenant_id = %t, request_id, reference = %candidate.reference_id, err = %e, "settlement line skipped");
                        continue;
                    }
                    Err(e) => return Err(e.into()),
                },
            };
            lines.push(Line {
                sandbox,
                ..candidate
            });
        }
        let available = self.deps.payable_available(request_id, t, CURRENCY).await?;
        let free = available.saturating_sub(self.store.processing_net(t).await?);
        let sel = domain::select(&lines, free, !bank, s.minimum_payout_minor)?;
        let batch = self
            .store
            .create_batch(&NewBatch {
                id: Uuid::now_v7(),
                tenant_id: t,
                currency: CURRENCY.into(),
                sandbox: sel.sandbox,
                period_start: sel.period_start,
                period_end: sel.period_end,
                gross_minor: sel.gross_minor,
                refunds_minor: sel.refunds_minor,
                net_minor: sel.net_minor,
                destination_kind: s.destination_kind.clone(),
                destination_last4: s.destination_last4.clone(),
                idempotency_key: key.to_string(),
                created_by: created_by.to_string(),
                at: now,
                items: sel.items,
            })
            .await?;
        self.metrics
            .batches
            .with_label_values(&[BatchStatus::Processing.label()])
            .inc();
        if batch.status == BatchStatus::Processing && batch.destination_kind == DEST_WALLET {
            return self.pay_to_wallet(request_id, batch).await;
        }
        Ok(batch)
    }

    /// T6b: acredita la billetera del negocio. Si el ledger no responde, el lote queda en proceso y
    /// el job lo reintenta con la misma clave (`payout:<batch_id>`).
    async fn pay_to_wallet(&self, request_id: &str, b: BatchRow) -> Result<BatchRow, Error> {
        match self
            .deps
            .post_payout(
                request_id,
                b.id,
                b.tenant_id,
                &b.currency,
                b.net_minor,
                DEST_WALLET,
            )
            .await
        {
            Ok(tx) => self.paid(b, tx, "").await,
            Err(e) if e.is_ambiguous() => {
                tracing::warn!(pp.batch_id = %b.id, request_id, err = %e, "wallet payout pending");
                Ok(b)
            }
            Err(e) => {
                let reason = format!("el ledger rechazó el pago: {}", e.reason());
                self.failed(b, &reason).await
            }
        }
    }

    async fn paid(
        &self,
        b: BatchRow,
        ledger_tx: Uuid,
        external_ref: &str,
    ) -> Result<BatchRow, Error> {
        let now = (self.now)();
        let ev = outbox(
            events::BATCH_PAID,
            b.tenant_id,
            b.id,
            &pb::BatchPaid {
                batch_id: b.id.to_string(),
                tenant_id: b.tenant_id.to_string(),
                net_payout: Some(pb::Money {
                    amount_minor: b.net_minor,
                    currency: b.currency.clone(),
                }),
            },
            now,
        );
        let row = self
            .store
            .mark_paid(b.id, ledger_tx, external_ref, now, &ev)
            .await?;
        self.metrics
            .batches
            .with_label_values(&[BatchStatus::Paid.label()])
            .inc();
        self.metrics
            .net_minor
            .with_label_values(&[row.currency.as_str()])
            .inc_by(u64::try_from(row.net_minor).unwrap_or(0));
        Ok(row)
    }

    async fn failed(&self, b: BatchRow, reason: &str) -> Result<BatchRow, Error> {
        let now = (self.now)();
        let ev = outbox(
            events::BATCH_FAILED,
            b.tenant_id,
            b.id,
            &pb::BatchFailed {
                batch_id: b.id.to_string(),
                tenant_id: b.tenant_id.to_string(),
                reason: reason.to_string(),
            },
            now,
        );
        let row = self.store.mark_failed(b.id, reason, now, &ev).await?;
        self.metrics
            .batches
            .with_label_values(&[BatchStatus::Failed.label()])
            .inc();
        Ok(row)
    }

    fn scope_for(&self, a: &Actor) -> Result<Scope, Error> {
        if a.platform() {
            return Ok(Scope::service());
        }
        Ok(Scope::tenant(a.tenant_with(&[
            "settlement:read",
            "settlement:schedule:manage",
        ])?))
    }

    pub async fn get_batch(&self, a: &Actor, id: Uuid) -> Result<(BatchRow, Vec<Line>), Error> {
        let scope = self.scope_for(a)?;
        match self.store.batch(&scope, id).await {
            Err(StoreError::NotFound) => Err(Error::NotFound),
            r => Ok(r?),
        }
    }

    /// Lotes del negocio; la plataforma (`platform:reconcile`) ve los de todos para confirmarlos.
    pub async fn list_batches(
        &self,
        a: &Actor,
        status: Option<BatchStatus>,
        limit: i64,
        before: Option<(DateTime<Utc>, Uuid)>,
    ) -> Result<Vec<BatchRow>, Error> {
        let scope = self.scope_for(a)?;
        let tenant = if scope.service { None } else { a.tenant_id };
        Ok(self
            .store
            .batches(&scope, tenant, status, limit.clamp(1, 200), before)
            .await?)
    }

    /// La plataforma confirma una transferencia bancaria hecha (Q-10: sin conector bancario todavía).
    pub async fn confirm_payout(
        &self,
        a: &Actor,
        id: Uuid,
        external_ref: &str,
    ) -> Result<BatchRow, Error> {
        if !a.platform() {
            return Err(Error::PermissionDenied);
        }
        let external_ref = external_ref.trim();
        if external_ref.is_empty() || external_ref.chars().count() > 100 {
            return Err(DomainError::InvalidArgument.into());
        }
        let (b, _) = self.get_batch(a, id).await?;
        if b.status == BatchStatus::Paid && b.payout_external_ref == external_ref {
            return Ok(b); // reintento
        }
        if b.status != BatchStatus::Processing || b.destination_kind != DEST_BANK {
            return Err(DomainError::InvalidStateTransition.into());
        }
        let tx = match self
            .deps
            .post_payout(
                &a.request_id,
                b.id,
                b.tenant_id,
                &b.currency,
                b.net_minor,
                DEST_BANK,
            )
            .await
        {
            Ok(tx) => tx,
            // T6 acredita BANK_CASH: sin los depósitos del riel asentados (T5) no hay de dónde pagar.
            Err(e) if e.reason() == "INSUFFICIENT_FUNDS" => {
                return Err(DomainError::BankFundsPending.into())
            }
            Err(e) => return Err(e.into()),
        };
        self.paid(b, tx, external_ref).await
    }

    pub async fn fail_payout(&self, a: &Actor, id: Uuid, reason: &str) -> Result<BatchRow, Error> {
        if !a.platform() {
            return Err(Error::PermissionDenied);
        }
        let reason = reason.trim();
        if reason.is_empty() || reason.chars().count() > 200 {
            return Err(DomainError::InvalidArgument.into());
        }
        let (b, _) = self.get_batch(a, id).await?;
        if b.status == BatchStatus::Failed {
            return Ok(b);
        }
        if b.status != BatchStatus::Processing {
            return Err(DomainError::InvalidStateTransition.into());
        }
        self.failed(b, reason).await
    }

    // ── Jobs (F12.7) ─────────────────────────────────────────────────────────────────────

    /// Crea los lotes automáticos que tocan hoy (R9: corte 17:00 en Panamá). Un lote por negocio y
    /// por día (clave `job:<fecha>`). Nada que liquidar, mínimo no alcanzado o pagos bloqueados no
    /// son fallos. Devuelve cuántos lotes creó.
    pub async fn run_schedules(&self) -> Result<usize, Error> {
        let now = (self.now)();
        let mut created = 0usize;
        for s in self.store.automatic_schedules().await? {
            let Some(freq) = Frequency::from_code(i32::from(s.frequency)) else {
                continue;
            };
            let Some(day) = domain::due_today(freq, i32::from(s.weekday), now) else {
                continue;
            };
            let key = format!("job:{}:{day}", s.tenant_id);
            match self
                .settle(&format!("job-{}", Uuid::now_v7()), s.tenant_id, &key, "job")
                .await
            {
                Ok(_) => created = created.saturating_add(1),
                Err(Error::Domain(
                    DomainError::NothingToSettle
                    | DomainError::BelowMinimum
                    | DomainError::SandboxFunds
                    | DomainError::PayoutsBlocked,
                )) => {}
                Err(e) => {
                    tracing::error!(pp.tenant_id = %s.tenant_id, err = %e, "scheduled settlement failed")
                }
            }
        }
        Ok(created)
    }

    /// Reintenta los T6b que quedaron pendientes.
    pub async fn retry_wallet_payouts(&self) -> Result<(), Error> {
        for b in self.store.pending_wallet_batches(50).await? {
            let request_id = format!("job-{}", Uuid::now_v7());
            self.pay_to_wallet(&request_id, b).await?;
        }
        Ok(())
    }

    pub async fn refresh_gauges(&self) -> Result<(), Error> {
        self.metrics
            .processing
            .set(self.store.processing_count().await?);
        Ok(())
    }

    pub fn item_kind_label(k: ItemKind) -> &'static str {
        k.label()
    }
}
