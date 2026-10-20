//! Persistencia de payments-core (sqlx). Cada cambio de estado ocurre en UNA transacción que
//! incluye la fila del pago, la del intento, la del intent y el outbox (ADR 0012, SPEC R8). Ninguna
//! transacción abarca una llamada al ledger ni a un riel (R6).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::domain::state::{AttemptStatus, PaymentStatus};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("not found")]
    NotFound,
    #[error("idempotency key reused with a different request")]
    IdempotencyKeyReused,
    #[error("invalid state transition")]
    InvalidStateTransition,
    #[error("corrupt row: {0}")]
    Corrupt(&'static str),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

/// Quién lee: el propio servicio (todo) o una lectura desde el gateway acotada por RLS.
#[derive(Debug, Clone, Default)]
pub struct Scope {
    pub service: bool,
    pub tenant_id: String,
    pub party_id: String,
}

impl Scope {
    pub fn service() -> Self {
        Scope {
            service: true,
            ..Default::default()
        }
    }
}

/// Un reparto del intent (R4): `merchant_party_id` es el tenant que cobra esa parte.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SplitJson {
    pub merchant_party_id: Uuid,
    pub amount_minor: i64,
    #[serde(default)]
    pub reference_type: String,
    #[serde(default)]
    pub reference_id: String,
}

/// Desglose de un split, congelado en `payments.fees` (domain-model §4.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SplitFees {
    pub merchant_party_id: Uuid,
    pub gross_minor: i64,
    pub platform_fee_minor: i64,
    pub tax_minor: i64,
    pub rail_fee_minor: i64,
    pub merchant_net_minor: i64,
    pub total_charged_minor: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FrozenFees {
    pub fee_policy_id: Uuid,
    pub splits: Vec<SplitFees>,
}

#[derive(Debug, Clone)]
pub struct TerminalRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub label: String,
    pub public_code: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct FeePolicyRow {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub rail: i16,
    pub fixed_fee_minor: i64,
    pub percentage_bps: i32,
    pub bearer: i16,
    pub tax_rate_bps: i32,
    pub rail_fixed_fee_minor: i64,
    pub rail_percentage_bps: i32,
    pub rail_fee_refundable: bool,
    pub active: bool,
    pub effective_from: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewIntent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub created_by: Uuid,
    pub payer_party_id: Option<Uuid>,
    pub amount_minor: i64,
    pub currency: String,
    pub rail: i16,
    pub terminal_id: Option<Uuid>,
    pub reference_type: String,
    pub reference_id: String,
    pub metadata: serde_json::Value,
    pub splits: Vec<SplitJson>,
    pub sandbox: bool,
    pub expires_at: DateTime<Utc>,
    pub idempotency_key: String,
    pub request_hash: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct IntentRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub created_by: Uuid,
    pub payer_party_id: Option<Uuid>,
    pub amount_minor: i64,
    pub currency: String,
    pub rail: i16,
    pub status: PaymentStatus,
    pub reference_type: String,
    pub reference_id: String,
    pub splits: Vec<SplitJson>,
    pub sandbox: bool,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub payment_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub struct AttemptRow {
    pub id: Uuid,
    pub attempt_number: i32,
    pub rail: i16,
    pub status: AttemptStatus,
    pub external_ref: String,
    pub error_code: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct PaymentRow {
    pub id: Uuid,
    pub intent_id: Uuid,
    pub tenant_id: Uuid,
    pub payer_party_id: Option<Uuid>,
    pub status: PaymentStatus,
    pub rail: i16,
    pub amount_minor: i64,
    pub captured_minor: i64,
    pub refunded_minor: i64,
    pub currency: String,
    pub fees: Option<FrozenFees>,
    pub ledger_posting: i16,
    pub ledger_transaction_id: Option<Uuid>,
    pub hold_id: Option<Uuid>,
    pub sandbox: bool,
    pub confirm_idempotency_key: String,
    pub failure_code: String,
    pub created_at: DateTime<Utc>,
    pub captured_at: Option<DateTime<Utc>>,
    /// Turno del que conduce el pago hasta su estado final (ver `claim`).
    pub next_check_at: Option<DateTime<Utc>>,
    pub attempts: Vec<AttemptRow>,
}

/// Resultado de iniciar la confirmación de un intent.
#[derive(Debug, Clone)]
pub enum ConfirmStart {
    /// Se creó el pago en PROCESSING: hay que llamar al riel.
    Started(PaymentRow),
    /// El intent ya tenía pago (reintento): se continúa o se devuelve su estado.
    Existing(PaymentRow),
}

/// Filtros de ListPayments.
#[derive(Debug, Clone, Default)]
pub struct PaymentFilter {
    pub status: Option<i16>,
    pub rail: Option<i16>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub reference_type: String,
    pub reference_id: String,
    pub after: Option<(DateTime<Utc>, Uuid)>,
    pub limit: i64,
}

const INTENT_COLS: &str = "i.id, i.tenant_id, i.created_by, i.payer_party_id, i.amount_minor, i.currency, i.rail, i.status, i.reference_type, i.reference_id, i.splits, i.sandbox, i.expires_at, i.created_at, p.id AS payment_id";
const PAYMENT_COLS: &str = "id, intent_id, tenant_id, payer_party_id, status, rail, amount_minor, captured_minor, refunded_minor, currency, fees, ledger_posting, ledger_transaction_id, hold_id, sandbox, confirm_idempotency_key, coalesce(failure_code, '') AS failure_code, created_at, captured_at, next_check_at";

fn status_of(code: i16) -> Result<PaymentStatus, StoreError> {
    PaymentStatus::from_code(code).ok_or(StoreError::Corrupt("payment status"))
}

fn intent_row(r: &PgRow) -> Result<IntentRow, StoreError> {
    Ok(IntentRow {
        id: r.try_get("id")?,
        tenant_id: r.try_get("tenant_id")?,
        created_by: r.try_get("created_by")?,
        payer_party_id: r.try_get("payer_party_id")?,
        amount_minor: r.try_get("amount_minor")?,
        currency: r.try_get("currency")?,
        rail: r.try_get("rail")?,
        status: status_of(r.try_get("status")?)?,
        reference_type: r.try_get("reference_type")?,
        reference_id: r.try_get("reference_id")?,
        splits: serde_json::from_value(r.try_get("splits")?)?,
        sandbox: r.try_get("sandbox")?,
        expires_at: r.try_get("expires_at")?,
        created_at: r.try_get("created_at")?,
        payment_id: r.try_get("payment_id")?,
    })
}

fn payment_row(r: &PgRow) -> Result<PaymentRow, StoreError> {
    let fees: Option<serde_json::Value> = r.try_get("fees")?;
    Ok(PaymentRow {
        id: r.try_get("id")?,
        intent_id: r.try_get("intent_id")?,
        tenant_id: r.try_get("tenant_id")?,
        payer_party_id: r.try_get("payer_party_id")?,
        status: status_of(r.try_get("status")?)?,
        rail: r.try_get("rail")?,
        amount_minor: r.try_get("amount_minor")?,
        captured_minor: r.try_get("captured_minor")?,
        refunded_minor: r.try_get("refunded_minor")?,
        currency: r.try_get("currency")?,
        fees: fees.map(serde_json::from_value).transpose()?,
        ledger_posting: r.try_get("ledger_posting")?,
        ledger_transaction_id: r.try_get("ledger_transaction_id")?,
        hold_id: r.try_get("hold_id")?,
        sandbox: r.try_get("sandbox")?,
        confirm_idempotency_key: r.try_get("confirm_idempotency_key")?,
        failure_code: r.try_get("failure_code")?,
        created_at: r.try_get("created_at")?,
        captured_at: r.try_get("captured_at")?,
        next_check_at: r.try_get("next_check_at")?,
        attempts: Vec::new(),
    })
}

fn terminal_row(r: &PgRow) -> Result<TerminalRow, StoreError> {
    Ok(TerminalRow {
        id: r.try_get("id")?,
        tenant_id: r.try_get("tenant_id")?,
        label: r.try_get("label")?,
        public_code: r.try_get("public_code")?,
        active: r.try_get("active")?,
        created_at: r.try_get("created_at")?,
    })
}

fn fee_policy_row(r: &PgRow) -> Result<FeePolicyRow, StoreError> {
    Ok(FeePolicyRow {
        id: r.try_get("id")?,
        tenant_id: r.try_get("tenant_id")?,
        rail: r.try_get("rail")?,
        fixed_fee_minor: r.try_get("fixed_fee_minor")?,
        percentage_bps: r.try_get("percentage_bps")?,
        bearer: r.try_get("bearer")?,
        tax_rate_bps: r.try_get("tax_rate_bps")?,
        rail_fixed_fee_minor: r.try_get("rail_fixed_fee_minor")?,
        rail_percentage_bps: r.try_get("rail_percentage_bps")?,
        rail_fee_refundable: r.try_get("rail_fee_refundable")?,
        active: r.try_get("active")?,
        effective_from: r.try_get("effective_from")?,
    })
}

/// Una política nueva a guardar.
#[derive(Debug, Clone)]
pub struct NewFeePolicy {
    pub row: FeePolicyRow,
    pub created_by: Uuid,
    pub idempotency_key: String,
    pub request_hash: Vec<u8>,
}

#[derive(Clone)]
pub struct PgPayments {
    pool: PgPool,
}

impl PgPayments {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    async fn begin(&self, scope: &Scope) -> Result<Transaction<'static, Postgres>, StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.actor', $1, true), set_config('app.tenant_id', $2, true), set_config('app.party_id', $3, true)")
            .bind(if scope.service { "service" } else { "reader" })
            .bind(&scope.tenant_id)
            .bind(&scope.party_id)
            .execute(tx.as_mut())
            .await?;
        Ok(tx)
    }

    // ── Terminales (F11.5) ──────────────────────────────────────────────────────────────────

    /// CreateTerminal idempotente por (tenant, key): la misma key con otra etiqueta es un error.
    pub async fn create_terminal(
        &self,
        tenant_id: Uuid,
        created_by: Uuid,
        label: &str,
        public_code: &str,
        idempotency_key: &str,
    ) -> Result<TerminalRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        sqlx::query("INSERT INTO payments.terminals (id, tenant_id, label, public_code, created_by, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
            .bind(Uuid::now_v7())
            .bind(tenant_id)
            .bind(label)
            .bind(public_code)
            .bind(created_by)
            .bind(idempotency_key)
            .execute(tx.as_mut())
            .await?;
        let row = sqlx::query("SELECT id, tenant_id, label, public_code, active, created_at FROM payments.terminals WHERE tenant_id = $1 AND idempotency_key = $2")
            .bind(tenant_id)
            .bind(idempotency_key)
            .fetch_one(tx.as_mut())
            .await?;
        let t = terminal_row(&row)?;
        if t.label != label {
            return Err(StoreError::IdempotencyKeyReused);
        }
        tx.commit().await?;
        Ok(t)
    }

    pub async fn list_terminals(
        &self,
        scope: &Scope,
        tenant_id: Uuid,
    ) -> Result<Vec<TerminalRow>, StoreError> {
        let mut tx = self.begin(scope).await?;
        let rows = sqlx::query("SELECT id, tenant_id, label, public_code, active, created_at FROM payments.terminals WHERE tenant_id = $1 ORDER BY created_at, id LIMIT 200")
            .bind(tenant_id)
            .fetch_all(tx.as_mut())
            .await?;
        tx.commit().await?;
        rows.iter().map(terminal_row).collect()
    }

    pub async fn set_terminal_active(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
        active: bool,
    ) -> Result<TerminalRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let row = sqlx::query("UPDATE payments.terminals SET active = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id, tenant_id, label, public_code, active, created_at")
            .bind(terminal_id)
            .bind(tenant_id)
            .bind(active)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        tx.commit().await?;
        terminal_row(&row)
    }

    pub async fn terminal_by_code(&self, public_code: &str) -> Result<TerminalRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let row = sqlx::query("SELECT id, tenant_id, label, public_code, active, created_at FROM payments.terminals WHERE public_code = $1")
            .bind(public_code)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        tx.commit().await?;
        terminal_row(&row)
    }

    // ── Políticas de comisión (domain-model §4.1) ───────────────────────────────────────────

    pub async fn insert_fee_policy(&self, p: NewFeePolicy) -> Result<FeePolicyRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        if let Some(r) = sqlx::query("SELECT request_hash, id, tenant_id, rail, fixed_fee_minor, percentage_bps, bearer, tax_rate_bps, rail_fixed_fee_minor, rail_percentage_bps, rail_fee_refundable, active, effective_from FROM payments.fee_policies WHERE idempotency_key = $1")
            .bind(&p.idempotency_key)
            .fetch_optional(tx.as_mut())
            .await?
        {
            let hash: Vec<u8> = r.try_get("request_hash")?;
            if hash != p.request_hash {
                return Err(StoreError::IdempotencyKeyReused);
            }
            return fee_policy_row(&r);
        }
        let row = p.row;
        sqlx::query("INSERT INTO payments.fee_policies (id, tenant_id, rail, fixed_fee_minor, percentage_bps, bearer, tax_rate_bps, rail_fixed_fee_minor, rail_percentage_bps, rail_fee_refundable, active, effective_from, created_by, idempotency_key, request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)")
            .bind(row.id)
            .bind(row.tenant_id)
            .bind(row.rail)
            .bind(row.fixed_fee_minor)
            .bind(row.percentage_bps)
            .bind(row.bearer)
            .bind(row.tax_rate_bps)
            .bind(row.rail_fixed_fee_minor)
            .bind(row.rail_percentage_bps)
            .bind(row.rail_fee_refundable)
            .bind(row.active)
            .bind(row.effective_from)
            .bind(p.created_by)
            .bind(&p.idempotency_key)
            .bind(&p.request_hash)
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        Ok(row)
    }

    pub async fn list_fee_policies(
        &self,
        tenant_id: Option<Uuid>,
    ) -> Result<Vec<FeePolicyRow>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let rows = sqlx::query("SELECT id, tenant_id, rail, fixed_fee_minor, percentage_bps, bearer, tax_rate_bps, rail_fixed_fee_minor, rail_percentage_bps, rail_fee_refundable, active, effective_from FROM payments.fee_policies WHERE tenant_id IS NOT DISTINCT FROM $1 OR tenant_id IS NULL ORDER BY effective_from DESC, id DESC LIMIT 200")
            .bind(tenant_id)
            .fetch_all(tx.as_mut())
            .await?;
        tx.commit().await?;
        rows.iter().map(fee_policy_row).collect()
    }

    /// §4.1: la vigente más específica: (tenant, rail) > (tenant, *) > (global, rail) > (global, *).
    /// Entre las del mismo nivel manda la de `effective_from` más reciente ≤ `at`; si esa está
    /// inactiva, el nivel no aplica.
    pub async fn applicable_fee_policy(
        &self,
        tenant_id: Uuid,
        rail: i16,
        at: DateTime<Utc>,
    ) -> Result<Option<FeePolicyRow>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let row = sqlx::query(
            "WITH latest AS (
               SELECT DISTINCT ON (tenant_id, rail) *
               FROM payments.fee_policies
               WHERE (tenant_id = $1 OR tenant_id IS NULL) AND rail IN ($2, 0) AND effective_from <= $3
               ORDER BY tenant_id, rail, effective_from DESC, created_at DESC
             )
             SELECT id, tenant_id, rail, fixed_fee_minor, percentage_bps, bearer, tax_rate_bps, rail_fixed_fee_minor, rail_percentage_bps, rail_fee_refundable, active, effective_from
             FROM latest WHERE active
             ORDER BY (tenant_id IS NULL), (rail = 0)
             LIMIT 1",
        )
        .bind(tenant_id)
        .bind(rail)
        .bind(at)
        .fetch_optional(tx.as_mut())
        .await?;
        tx.commit().await?;
        row.as_ref().map(fee_policy_row).transpose()
    }

    // ── Estado del tenant (R2) ──────────────────────────────────────────────────────────────

    pub async fn tenant_status(&self, tenant_id: Uuid) -> Result<Option<i16>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let s =
            sqlx::query_scalar("SELECT status FROM payments.tenant_status WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_optional(tx.as_mut())
                .await?;
        tx.commit().await?;
        Ok(s)
    }

    /// Proyección de `TenantStatusChanged`: idempotente por `event_id`.
    pub async fn project_tenant_status(
        &self,
        event_id: &str,
        tenant_id: Uuid,
        status: i16,
        at: DateTime<Utc>,
    ) -> Result<bool, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let fresh = sqlx::query(
            "INSERT INTO payments.processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
        )
        .bind(event_id)
        .execute(tx.as_mut())
        .await?
        .rows_affected()
            > 0;
        if fresh {
            sqlx::query("INSERT INTO payments.tenant_status (tenant_id, status, updated_at) VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at WHERE payments.tenant_status.updated_at <= EXCLUDED.updated_at")
                .bind(tenant_id)
                .bind(status)
                .bind(at)
                .execute(tx.as_mut())
                .await?;
        }
        tx.commit().await?;
        Ok(fresh)
    }

    // ── Intents ─────────────────────────────────────────────────────────────────────────────

    /// R1: el intent ya creado con la misma key por el mismo creador, si existe, con su hash.
    pub async fn intent_by_key(
        &self,
        tenant_id: Uuid,
        created_by: Uuid,
        idempotency_key: &str,
    ) -> Result<Option<(IntentRow, Vec<u8>)>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let row = sqlx::query(&format!("SELECT {INTENT_COLS}, i.request_hash FROM payments.intents i LEFT JOIN payments.payments p ON p.intent_id = i.id WHERE i.tenant_id = $1 AND i.created_by = $2 AND i.idempotency_key = $3"))
            .bind(tenant_id)
            .bind(created_by)
            .bind(idempotency_key)
            .fetch_optional(tx.as_mut())
            .await?;
        tx.commit().await?;
        match row {
            None => Ok(None),
            Some(r) => Ok(Some((intent_row(&r)?, r.try_get("request_hash")?))),
        }
    }

    /// Crea el intent CREATED. Una carrera con la misma key devuelve el ganador (R1).
    pub async fn insert_intent(&self, n: NewIntent) -> Result<(IntentRow, Vec<u8>), StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        sqlx::query("INSERT INTO payments.intents (id, tenant_id, created_by, payer_party_id, amount_minor, currency, rail, status, terminal_id, reference_type, reference_id, metadata, splits, sandbox, expires_at, idempotency_key, request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (tenant_id, created_by, idempotency_key) DO NOTHING")
            .bind(n.id)
            .bind(n.tenant_id)
            .bind(n.created_by)
            .bind(n.payer_party_id)
            .bind(n.amount_minor)
            .bind(&n.currency)
            .bind(n.rail)
            .bind(n.terminal_id)
            .bind(&n.reference_type)
            .bind(&n.reference_id)
            .bind(&n.metadata)
            .bind(serde_json::to_value(&n.splits)?)
            .bind(n.sandbox)
            .bind(n.expires_at)
            .bind(&n.idempotency_key)
            .bind(&n.request_hash)
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        self.intent_by_key(n.tenant_id, n.created_by, &n.idempotency_key)
            .await?
            .ok_or(StoreError::NotFound)
    }

    pub async fn intent(&self, scope: &Scope, id: Uuid) -> Result<IntentRow, StoreError> {
        let mut tx = self.begin(scope).await?;
        let row = sqlx::query(&format!("SELECT {INTENT_COLS} FROM payments.intents i LEFT JOIN payments.payments p ON p.intent_id = i.id WHERE i.id = $1"))
            .bind(id)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        tx.commit().await?;
        intent_row(&row)
    }

    /// Inicia la confirmación de un intent (R6, paso 1): bloquea el intent, valida su estado y en
    /// la misma transacción crea el pago PROCESSING y su intento. Si ya tenía pago, lo devuelve.
    /// Un intent vencido pasa a EXPIRED aquí mismo.
    pub async fn start_payment(
        &self,
        intent_id: Uuid,
        payer_party_id: Uuid,
        confirm_idempotency_key: &str,
        fees: &FrozenFees,
        charged_minor: i64,
        now: DateTime<Utc>,
    ) -> Result<ConfirmStart, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query("SELECT status, expires_at, payer_party_id, rail, currency, tenant_id, sandbox FROM payments.intents WHERE id = $1 FOR UPDATE")
            .bind(intent_id)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        if let Some(existing) = load_payment_by_intent(&mut tx, intent_id).await? {
            tx.commit().await?;
            return Ok(ConfirmStart::Existing(existing));
        }
        let status = status_of(r.try_get("status")?)?;
        let expires_at: DateTime<Utc> = r.try_get("expires_at")?;
        let stored_payer: Option<Uuid> = r.try_get("payer_party_id")?;
        if stored_payer.is_some_and(|p| p != payer_party_id) {
            return Err(StoreError::NotFound);
        }
        if expires_at <= now && status.can_transition(PaymentStatus::Expired) {
            sqlx::query("UPDATE payments.intents SET status = 8, updated_at = now(), version = version + 1 WHERE id = $1")
                .bind(intent_id)
                .execute(tx.as_mut())
                .await?;
            tx.commit().await?;
            return Err(StoreError::InvalidStateTransition);
        }
        if !status.can_transition(PaymentStatus::Processing) {
            return Err(StoreError::InvalidStateTransition);
        }
        let payment_id = Uuid::now_v7();
        let rail: i16 = r.try_get("rail")?;
        sqlx::query("UPDATE payments.intents SET status = 3, payer_party_id = $2, updated_at = now(), version = version + 1 WHERE id = $1")
            .bind(intent_id)
            .bind(payer_party_id)
            .execute(tx.as_mut())
            .await?;
        sqlx::query("INSERT INTO payments.payments (id, intent_id, tenant_id, payer_party_id, status, rail, amount_minor, currency, fees, fee_policy_id, sandbox, confirm_idempotency_key, next_check_at) VALUES ($1, $2, $3, $4, 3, $5, $6, $7, $8, $9, $10, $11, now() + interval '30 seconds')")
            .bind(payment_id)
            .bind(intent_id)
            .bind(r.try_get::<Uuid, _>("tenant_id")?)
            .bind(payer_party_id)
            .bind(rail)
            .bind(charged_minor)
            .bind(r.try_get::<String, _>("currency")?)
            .bind(serde_json::to_value(fees)?)
            .bind(fees.fee_policy_id)
            .bind(r.try_get::<bool, _>("sandbox")?)
            .bind(confirm_idempotency_key)
            .execute(tx.as_mut())
            .await?;
        sqlx::query("INSERT INTO payments.attempts (id, payment_id, attempt_number, rail, status, rail_idempotency_key) VALUES ($1, $2, 1, $3, 2, $4)")
            .bind(Uuid::now_v7())
            .bind(payment_id)
            .bind(rail)
            .bind(format!("pay:{payment_id}"))
            .execute(tx.as_mut())
            .await?;
        let p = load_payment(&mut tx, payment_id).await?;
        tx.commit().await?;
        Ok(ConfirmStart::Started(p))
    }

    /// Guarda la retención creada en el ledger (paso intermedio de R9).
    pub async fn set_hold(&self, payment_id: Uuid, hold_id: Uuid) -> Result<(), StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        sqlx::query("UPDATE payments.payments SET hold_id = $2, updated_at = now() WHERE id = $1 AND hold_id IS NULL")
            .bind(payment_id)
            .bind(hold_id)
            .execute(tx.as_mut())
            .await?;
        sqlx::query("UPDATE payments.attempts SET external_ref = $2, updated_at = now() WHERE payment_id = $1 AND attempt_number = 1 AND external_ref IS NULL")
            .bind(payment_id)
            .bind(hold_id.to_string())
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// R8: captura confirmada → en UNA transacción: pago CAPTURED con su asiento, intento
    /// CAPTURED, intent CAPTURED y outbox `PaymentCaptured`. Repetirla no tiene efecto.
    pub async fn complete_capture(
        &self,
        payment_id: Uuid,
        ledger_transaction_id: Uuid,
    ) -> Result<(PaymentRow, bool), StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let p = lock_payment(&mut tx, payment_id).await?;
        if p.status == PaymentStatus::Captured {
            tx.commit().await?;
            return Ok((p, false));
        }
        if !p.status.can_transition(PaymentStatus::Captured) {
            return Err(StoreError::InvalidStateTransition);
        }
        sqlx::query("UPDATE payments.payments SET status = 5, captured_minor = amount_minor, ledger_posting = 2, ledger_transaction_id = $2, captured_at = now(), unknown_since = NULL, next_check_at = NULL, updated_at = now(), version = version + 1 WHERE id = $1")
            .bind(payment_id)
            .bind(ledger_transaction_id)
            .execute(tx.as_mut())
            .await?;
        set_attempt(&mut tx, payment_id, AttemptStatus::Captured, None).await?;
        set_intent_status(&mut tx, p.intent_id, PaymentStatus::Captured).await?;
        let intent = load_intent_tx(&mut tx, p.intent_id).await?;
        let splits: Vec<_> = intent
            .splits
            .iter()
            .map(|s| json!({"merchant_party_id": s.merchant_party_id, "amount_minor": s.amount_minor.to_string(), "currency": p.currency, "reference_type": s.reference_type, "reference_id": s.reference_id}))
            .collect();
        outbox(
            &mut tx,
            payment_id,
            "pp.payments.payment.captured.v1",
            p.tenant_id,
            json!({
                "payment_id": payment_id,
                "tenant_id": p.tenant_id,
                "rail": p.rail,
                "gross_minor": p.amount_minor.to_string(),
                "currency": p.currency,
                "reference_type": intent.reference_type,
                "reference_id": intent.reference_id,
                "splits": splits,
                "payment_intent_id": p.intent_id,
            }),
        )
        .await?;
        let out = load_payment(&mut tx, payment_id).await?;
        tx.commit().await?;
        Ok((out, true))
    }

    /// Rechazo definitivo: pago, intento e intent FAILED con su código y outbox `PaymentFailed`.
    pub async fn fail_payment(
        &self,
        payment_id: Uuid,
        failure_code: &str,
    ) -> Result<(PaymentRow, bool), StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let p = lock_payment(&mut tx, payment_id).await?;
        if p.status == PaymentStatus::Failed {
            tx.commit().await?;
            return Ok((p, false));
        }
        if !p.status.can_transition(PaymentStatus::Failed) {
            return Err(StoreError::InvalidStateTransition);
        }
        sqlx::query("UPDATE payments.payments SET status = 6, failure_code = $2, unknown_since = NULL, next_check_at = NULL, updated_at = now(), version = version + 1 WHERE id = $1")
            .bind(payment_id)
            .bind(failure_code)
            .execute(tx.as_mut())
            .await?;
        set_attempt(
            &mut tx,
            payment_id,
            AttemptStatus::Failed,
            Some(failure_code),
        )
        .await?;
        set_intent_status(&mut tx, p.intent_id, PaymentStatus::Failed).await?;
        let intent = load_intent_tx(&mut tx, p.intent_id).await?;
        outbox(
            &mut tx,
            payment_id,
            "pp.payments.payment.failed.v1",
            p.tenant_id,
            json!({
                "payment_id": payment_id,
                "tenant_id": p.tenant_id,
                "failure_code": failure_code,
                "reference_type": intent.reference_type,
                "reference_id": intent.reference_id,
                "payment_intent_id": p.intent_id,
            }),
        )
        .await?;
        let out = load_payment(&mut tx, payment_id).await?;
        tx.commit().await?;
        Ok((out, true))
    }

    /// R7: respuesta ambigua → UNKNOWN (nunca FAILED ni CAPTURED) con la próxima consulta.
    pub async fn mark_unknown(
        &self,
        payment_id: Uuid,
        next_check_at: DateTime<Utc>,
    ) -> Result<PaymentRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let p = lock_payment(&mut tx, payment_id).await?;
        match p.status {
            PaymentStatus::Unknown => {
                sqlx::query("UPDATE payments.payments SET next_check_at = $2, updated_at = now() WHERE id = $1")
                    .bind(payment_id)
                    .bind(next_check_at)
                    .execute(tx.as_mut())
                    .await?;
            }
            s if s.can_transition(PaymentStatus::Unknown) => {
                sqlx::query("UPDATE payments.payments SET status = 9, unknown_since = now(), next_check_at = $2, updated_at = now(), version = version + 1 WHERE id = $1")
                    .bind(payment_id)
                    .bind(next_check_at)
                    .execute(tx.as_mut())
                    .await?;
                set_attempt(&mut tx, payment_id, AttemptStatus::Unknown, None).await?;
                set_intent_status(&mut tx, p.intent_id, PaymentStatus::Unknown).await?;
                let intent = load_intent_tx(&mut tx, p.intent_id).await?;
                outbox(
                    &mut tx,
                    payment_id,
                    "pp.payments.payment.unknown.v1",
                    p.tenant_id,
                    json!({
                        "payment_id": payment_id,
                        "tenant_id": p.tenant_id,
                        "rail": p.rail,
                        "reference_type": intent.reference_type,
                        "reference_id": intent.reference_id,
                    }),
                )
                .await?;
            }
            _ => return Err(StoreError::InvalidStateTransition),
        }
        let out = load_payment(&mut tx, payment_id).await?;
        tx.commit().await?;
        Ok(out)
    }

    /// Toma el turno de conducir un pago PROCESSING/UNKNOWN cuyo turno anterior venció (30 s).
    /// Solo quien lo obtiene llama al ledger: dos confirmaciones simultáneas o el job no se pisan,
    /// sin que ninguna transacción de BD abarque la llamada externa (R6).
    pub async fn claim(&self, payment_id: Uuid) -> Result<bool, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let n = sqlx::query("UPDATE payments.payments SET next_check_at = now() + interval '30 seconds', updated_at = now() WHERE id = $1 AND status IN (3, 9) AND next_check_at <= now()")
            .bind(payment_id)
            .execute(tx.as_mut())
            .await?
            .rows_affected();
        tx.commit().await?;
        Ok(n == 1)
    }

    /// Pagos de wallet a medio camino (PROCESSING tras una caída, o UNKNOWN) cuya consulta toca.
    pub async fn due_wallet_payments(&self, limit: i64) -> Result<Vec<PaymentRow>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let rows = sqlx::query(&format!("SELECT {PAYMENT_COLS} FROM payments.payments WHERE rail = 1 AND status IN (3, 9) AND next_check_at <= now() ORDER BY next_check_at LIMIT $1"))
            .bind(limit)
            .fetch_all(tx.as_mut())
            .await?;
        tx.commit().await?;
        rows.iter().map(payment_row).collect()
    }

    /// R14: intents CREATED/REQUIRES_ACTION vencidos → EXPIRED. Devuelve cuántos.
    pub async fn expire_intents(&self) -> Result<u64, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let n = sqlx::query("UPDATE payments.intents i SET status = 8, updated_at = now(), version = version + 1 WHERE i.status IN (1, 2) AND i.expires_at <= now() AND NOT EXISTS (SELECT 1 FROM payments.payments p WHERE p.intent_id = i.id)")
            .execute(tx.as_mut())
            .await?
            .rows_affected();
        tx.commit().await?;
        Ok(n)
    }

    /// CancelPaymentIntent (domain-model §8.1): CREATED/REQUIRES_ACTION → CANCELLED.
    pub async fn cancel_intent(&self, intent_id: Uuid) -> Result<IntentRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let status: i16 =
            sqlx::query_scalar("SELECT status FROM payments.intents WHERE id = $1 FOR UPDATE")
                .bind(intent_id)
                .fetch_optional(tx.as_mut())
                .await?
                .ok_or(StoreError::NotFound)?;
        let status = status_of(status)?;
        if status != PaymentStatus::Cancelled {
            if !status.can_transition(PaymentStatus::Cancelled) {
                return Err(StoreError::InvalidStateTransition);
            }
            set_intent_status(&mut tx, intent_id, PaymentStatus::Cancelled).await?;
        }
        let out = load_intent_tx(&mut tx, intent_id).await?;
        tx.commit().await?;
        Ok(out)
    }

    // ── Lecturas de pagos ───────────────────────────────────────────────────────────────────

    pub async fn payment(&self, scope: &Scope, id: Uuid) -> Result<PaymentRow, StoreError> {
        let mut tx = self.begin(scope).await?;
        let p = load_payment(&mut tx, id).await?;
        tx.commit().await?;
        Ok(p)
    }

    pub async fn list_payments(
        &self,
        scope: &Scope,
        f: &PaymentFilter,
    ) -> Result<Vec<PaymentRow>, StoreError> {
        let mut tx = self.begin(scope).await?;
        let rows = sqlx::query(&format!(
            "SELECT {PAYMENT_COLS} FROM payments.payments p
             WHERE ($1::smallint IS NULL OR status = $1)
               AND ($2::smallint IS NULL OR rail = $2)
               AND ($3::timestamptz IS NULL OR created_at >= $3)
               AND ($4::timestamptz IS NULL OR created_at < $4)
               AND ($5 = '' OR EXISTS (SELECT 1 FROM payments.intents i WHERE i.id = p.intent_id AND i.reference_type = $5 AND i.reference_id = $6))
               AND ($7::timestamptz IS NULL OR (created_at, id) < ($7, $8))
               AND ($9 = '' OR tenant_id::text = $9)
             ORDER BY created_at DESC, id DESC LIMIT $10"
        ))
        .bind(f.status)
        .bind(f.rail)
        .bind(f.from)
        .bind(f.to)
        .bind(&f.reference_type)
        .bind(&f.reference_id)
        .bind(f.after.map(|a| a.0))
        .bind(f.after.map(|a| a.1).unwrap_or_else(Uuid::nil))
        .bind(if scope.service { "" } else { scope.tenant_id.as_str() })
        .bind(f.limit)
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        rows.iter().map(payment_row).collect()
    }

    /// Para las métricas: pagos en UNKNOWN y capturados sin asiento.
    pub async fn gauges(&self) -> Result<(i64, i64), StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query("SELECT count(*) FILTER (WHERE status = 9) AS unknown, count(*) FILTER (WHERE status = 5 AND ledger_posting = 1) AS unposted FROM payments.payments WHERE status IN (5, 9)")
            .fetch_one(tx.as_mut())
            .await?;
        tx.commit().await?;
        Ok((r.try_get("unknown")?, r.try_get("unposted")?))
    }
}

async fn load_payment_by_intent(
    tx: &mut Transaction<'static, Postgres>,
    intent_id: Uuid,
) -> Result<Option<PaymentRow>, StoreError> {
    let id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM payments.payments WHERE intent_id = $1")
            .bind(intent_id)
            .fetch_optional(tx.as_mut())
            .await?;
    match id {
        None => Ok(None),
        Some(id) => Ok(Some(load_payment(tx, id).await?)),
    }
}

async fn load_payment(
    tx: &mut Transaction<'static, Postgres>,
    id: Uuid,
) -> Result<PaymentRow, StoreError> {
    let r = sqlx::query(&format!(
        "SELECT {PAYMENT_COLS} FROM payments.payments WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(tx.as_mut())
    .await?
    .ok_or(StoreError::NotFound)?;
    let mut p = payment_row(&r)?;
    let attempts = sqlx::query("SELECT id, attempt_number, rail, status, coalesce(external_ref, '') AS external_ref, coalesce(error_code, '') AS error_code, created_at FROM payments.attempts WHERE payment_id = $1 ORDER BY attempt_number")
        .bind(id)
        .fetch_all(tx.as_mut())
        .await?;
    for a in &attempts {
        p.attempts.push(AttemptRow {
            id: a.try_get("id")?,
            attempt_number: a.try_get("attempt_number")?,
            rail: a.try_get("rail")?,
            status: AttemptStatus::from_code(a.try_get("status")?)
                .ok_or(StoreError::Corrupt("attempt status"))?,
            external_ref: a.try_get("external_ref")?,
            error_code: a.try_get("error_code")?,
            created_at: a.try_get("created_at")?,
        });
    }
    Ok(p)
}

async fn lock_payment(
    tx: &mut Transaction<'static, Postgres>,
    id: Uuid,
) -> Result<PaymentRow, StoreError> {
    sqlx::query("SELECT id FROM payments.payments WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
    load_payment(tx, id).await
}

async fn load_intent_tx(
    tx: &mut Transaction<'static, Postgres>,
    id: Uuid,
) -> Result<IntentRow, StoreError> {
    let row = sqlx::query(&format!("SELECT {INTENT_COLS} FROM payments.intents i LEFT JOIN payments.payments p ON p.intent_id = i.id WHERE i.id = $1"))
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
    intent_row(&row)
}

async fn set_intent_status(
    tx: &mut Transaction<'static, Postgres>,
    intent_id: Uuid,
    to: PaymentStatus,
) -> Result<(), StoreError> {
    sqlx::query("UPDATE payments.intents SET status = $2, updated_at = now(), version = version + 1 WHERE id = $1")
        .bind(intent_id)
        .bind(to.code())
        .execute(tx.as_mut())
        .await?;
    Ok(())
}

async fn set_attempt(
    tx: &mut Transaction<'static, Postgres>,
    payment_id: Uuid,
    to: AttemptStatus,
    error_code: Option<&str>,
) -> Result<(), StoreError> {
    sqlx::query("UPDATE payments.attempts SET status = $2, error_code = coalesce($3, error_code), updated_at = now() WHERE payment_id = $1 AND attempt_number = (SELECT max(attempt_number) FROM payments.attempts WHERE payment_id = $1)")
        .bind(payment_id)
        .bind(to.code())
        .bind(error_code)
        .execute(tx.as_mut())
        .await?;
    Ok(())
}

async fn outbox(
    tx: &mut Transaction<'static, Postgres>,
    payment_id: Uuid,
    event_type: &str,
    tenant_id: Uuid,
    payload: serde_json::Value,
) -> Result<(), StoreError> {
    sqlx::query("INSERT INTO payments.outbox (id, aggregate_type, aggregate_id, event_type, tenant_id, payload) VALUES ($1, 'payment', $2, $3, $4, $5)")
        .bind(Uuid::now_v7())
        .bind(payment_id.to_string())
        .bind(event_type)
        .bind(tenant_id.to_string())
        .bind(payload)
        .execute(tx.as_mut())
        .await?;
    Ok(())
}
