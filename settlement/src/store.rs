//! Persistencia de settlement (PostgreSQL con sqlx). Cada transacción fija `app.actor` y
//! `app.tenant_id` para que RLS sea la segunda barrera (ADR 0014); el servicio usa el alcance de
//! servicio solo en los jobs y en las operaciones de plataforma.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::domain::{BatchStatus, ItemKind, Line};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("not found")]
    NotFound,
    #[error("invalid state transition")]
    InvalidStateTransition,
    #[error("idempotency key reused with another request")]
    IdempotencyKeyReused,
    /// Otro lote tomó una de las partidas al mismo tiempo (R1): se reintenta.
    #[error("item already settled by a concurrent batch")]
    Conflict,
    #[error("corrupt row: {0}")]
    Corrupt(String),
}

/// Alcance de una transacción.
#[derive(Debug, Clone, Default)]
pub struct Scope {
    pub service: bool,
    pub tenant_id: String,
}

impl Scope {
    pub fn service() -> Self {
        Self {
            service: true,
            tenant_id: String::new(),
        }
    }

    pub fn tenant(t: Uuid) -> Self {
        Self {
            service: false,
            tenant_id: t.to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScheduleRow {
    pub tenant_id: Uuid,
    pub frequency: i16,
    pub weekday: i16,
    pub minimum_payout_minor: i64,
    pub hold_days: i16,
    pub destination_kind: String,
    pub destination_bank: String,
    pub destination_account_type: String,
    pub destination_last4: String,
    pub destination_holder: String,
    pub has_ciphertext: bool,
    pub payouts_blocked_until: Option<DateTime<Utc>>,
    pub idempotency_key: String,
    pub updated_at: DateTime<Utc>,
    pub version: i32,
}

/// Cambios del calendario. `destination` es `Some` solo si cambia el destino.
#[derive(Debug, Clone)]
pub struct ScheduleUpdate {
    pub tenant_id: Uuid,
    pub frequency: i16,
    pub weekday: i16,
    pub minimum_payout_minor: i64,
    pub destination: Option<DestinationUpdate>,
    pub idempotency_key: String,
    pub updated_by: Option<Uuid>,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct DestinationUpdate {
    pub kind: String,
    pub bank: String,
    pub account_type: String,
    pub ciphertext: Option<Vec<u8>>,
    pub key_version: String,
    pub last4: String,
    pub holder: String,
    pub blocked_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BatchRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub status: BatchStatus,
    pub currency: String,
    pub sandbox: bool,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub gross_minor: i64,
    pub refunds_minor: i64,
    pub net_minor: i64,
    pub destination_kind: String,
    pub destination_last4: String,
    pub payout_external_ref: String,
    pub failure_reason: String,
    pub ledger_transaction_id: Option<Uuid>,
    pub item_count: i64,
    pub created_at: DateTime<Utc>,
    pub paid_at: Option<DateTime<Utc>>,
}

/// Un lote nuevo con sus partidas.
#[derive(Debug, Clone)]
pub struct NewBatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub currency: String,
    pub sandbox: bool,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub gross_minor: i64,
    pub refunds_minor: i64,
    pub net_minor: i64,
    pub destination_kind: String,
    pub destination_last4: String,
    pub idempotency_key: String,
    pub created_by: String,
    pub at: DateTime<Utc>,
    pub items: Vec<Line>,
}

/// Un evento a publicar por el outbox (ADR 0012).
#[derive(Debug, Clone)]
pub struct OutboxEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aggregate_id: Uuid,
    pub event_type: String,
    pub payload: Vec<u8>,
    pub at: DateTime<Utc>,
}

const SCHEDULE_COLS: &str = "tenant_id, frequency, weekday, minimum_payout_minor, hold_days, destination_kind,
  destination_bank, destination_account_type, destination_last4, destination_holder,
  destination_ciphertext IS NOT NULL AS has_ciphertext, payouts_blocked_until, idempotency_key, updated_at, version";

const BATCH_COLS: &str = "b.id, b.tenant_id, b.status, b.currency, b.sandbox, b.period_start, b.period_end,
  b.gross_minor, b.refunds_minor, b.net_minor, b.destination_kind, b.destination_last4,
  coalesce(b.payout_external_ref, '') AS payout_external_ref, coalesce(b.failure_reason, '') AS failure_reason,
  b.ledger_transaction_id, b.created_at, b.paid_at,
  (SELECT count(*) FROM settlement.batch_items i WHERE i.batch_id = b.id) AS item_count";

fn schedule_row(r: &PgRow) -> Result<ScheduleRow, StoreError> {
    Ok(ScheduleRow {
        tenant_id: r.try_get("tenant_id")?,
        frequency: r.try_get("frequency")?,
        weekday: r.try_get("weekday")?,
        minimum_payout_minor: r.try_get("minimum_payout_minor")?,
        hold_days: r.try_get("hold_days")?,
        destination_kind: r.try_get("destination_kind")?,
        destination_bank: r.try_get("destination_bank")?,
        destination_account_type: r.try_get("destination_account_type")?,
        destination_last4: r.try_get("destination_last4")?,
        destination_holder: r.try_get("destination_holder")?,
        has_ciphertext: r.try_get("has_ciphertext")?,
        payouts_blocked_until: r.try_get("payouts_blocked_until")?,
        idempotency_key: r.try_get("idempotency_key")?,
        updated_at: r.try_get("updated_at")?,
        version: r.try_get("version")?,
    })
}

fn batch_row(r: &PgRow) -> Result<BatchRow, StoreError> {
    let status: i16 = r.try_get("status")?;
    Ok(BatchRow {
        id: r.try_get("id")?,
        tenant_id: r.try_get("tenant_id")?,
        status: BatchStatus::from_code(status)
            .ok_or_else(|| StoreError::Corrupt(format!("batch status {status}")))?,
        currency: r.try_get::<String, _>("currency")?.trim().to_string(),
        sandbox: r.try_get("sandbox")?,
        period_start: r.try_get("period_start")?,
        period_end: r.try_get("period_end")?,
        gross_minor: r.try_get("gross_minor")?,
        refunds_minor: r.try_get("refunds_minor")?,
        net_minor: r.try_get("net_minor")?,
        destination_kind: r.try_get("destination_kind")?,
        destination_last4: r.try_get("destination_last4")?,
        payout_external_ref: r.try_get("payout_external_ref")?,
        failure_reason: r.try_get("failure_reason")?,
        ledger_transaction_id: r.try_get("ledger_transaction_id")?,
        item_count: r.try_get("item_count")?,
        created_at: r.try_get("created_at")?,
        paid_at: r.try_get("paid_at")?,
    })
}

fn is_unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    match e {
        sqlx::Error::Database(d) => {
            d.code().as_deref() == Some("23505") && d.constraint() == Some(constraint)
        }
        _ => false,
    }
}

#[derive(Clone)]
pub struct PgSettlement {
    pool: PgPool,
}

impl PgSettlement {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    async fn begin(&self, scope: &Scope) -> Result<Transaction<'static, Postgres>, StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "SELECT set_config('app.actor', $1, true), set_config('app.tenant_id', $2, true)",
        )
        .bind(if scope.service { "service" } else { "tenant" })
        .bind(&scope.tenant_id)
        .execute(tx.as_mut())
        .await?;
        Ok(tx)
    }

    pub async fn schedule(
        &self,
        scope: &Scope,
        tenant: Uuid,
    ) -> Result<Option<ScheduleRow>, StoreError> {
        let mut tx = self.begin(scope).await?;
        let row = sqlx::query(&format!(
            "SELECT {SCHEDULE_COLS} FROM settlement.payout_schedules WHERE tenant_id = $1"
        ))
        .bind(tenant)
        .fetch_optional(tx.as_mut())
        .await?;
        tx.commit().await?;
        row.as_ref().map(schedule_row).transpose()
    }

    /// Guarda el calendario. La misma clave que la última configuración devuelve lo guardado sin
    /// cambiar nada (reintento).
    pub async fn upsert_schedule(
        &self,
        u: &ScheduleUpdate,
        ev: Option<&OutboxEvent>,
    ) -> Result<ScheduleRow, StoreError> {
        let mut tx = self.begin(&Scope::tenant(u.tenant_id)).await?;
        let prev = sqlx::query(&format!(
            "SELECT {SCHEDULE_COLS} FROM settlement.payout_schedules WHERE tenant_id = $1 FOR UPDATE"
        ))
        .bind(u.tenant_id)
        .fetch_optional(tx.as_mut())
        .await?;
        if let Some(p) = prev.as_ref().map(schedule_row).transpose()? {
            if p.idempotency_key == u.idempotency_key {
                tx.commit().await?;
                return Ok(p);
            }
        }
        let row = match (&u.destination, prev.is_some()) {
            (Some(d), _) => {
                sqlx::query(&format!(
                    "INSERT INTO settlement.payout_schedules (tenant_id, frequency, weekday, minimum_payout_minor,
                       destination_kind, destination_bank, destination_account_type, destination_ciphertext,
                       destination_key_version, destination_last4, destination_holder, payouts_blocked_until,
                       idempotency_key, updated_by, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                     ON CONFLICT (tenant_id) DO UPDATE SET frequency = EXCLUDED.frequency, weekday = EXCLUDED.weekday,
                       minimum_payout_minor = EXCLUDED.minimum_payout_minor, destination_kind = EXCLUDED.destination_kind,
                       destination_bank = EXCLUDED.destination_bank, destination_account_type = EXCLUDED.destination_account_type,
                       destination_ciphertext = EXCLUDED.destination_ciphertext,
                       destination_key_version = EXCLUDED.destination_key_version, destination_last4 = EXCLUDED.destination_last4,
                       destination_holder = EXCLUDED.destination_holder, payouts_blocked_until = EXCLUDED.payouts_blocked_until,
                       idempotency_key = EXCLUDED.idempotency_key, updated_by = EXCLUDED.updated_by,
                       updated_at = EXCLUDED.updated_at, version = settlement.payout_schedules.version + 1
                     RETURNING {SCHEDULE_COLS}"
                ))
                .bind(u.tenant_id)
                .bind(u.frequency)
                .bind(u.weekday)
                .bind(u.minimum_payout_minor)
                .bind(&d.kind)
                .bind(&d.bank)
                .bind(&d.account_type)
                .bind(&d.ciphertext)
                .bind(&d.key_version)
                .bind(&d.last4)
                .bind(&d.holder)
                .bind(d.blocked_until)
                .bind(&u.idempotency_key)
                .bind(u.updated_by)
                .bind(u.at)
                .fetch_one(tx.as_mut())
                .await?
            }
            (None, true) => {
                sqlx::query(&format!(
                    "UPDATE settlement.payout_schedules SET frequency = $2, weekday = $3, minimum_payout_minor = $4,
                       idempotency_key = $5, updated_by = $6, updated_at = $7, version = version + 1
                     WHERE tenant_id = $1 RETURNING {SCHEDULE_COLS}"
                ))
                .bind(u.tenant_id)
                .bind(u.frequency)
                .bind(u.weekday)
                .bind(u.minimum_payout_minor)
                .bind(&u.idempotency_key)
                .bind(u.updated_by)
                .bind(u.at)
                .fetch_one(tx.as_mut())
                .await?
            }
            // Sin calendario previo y sin destino: la billetera del negocio, que no necesita datos.
            (None, false) => {
                sqlx::query(&format!(
                    "INSERT INTO settlement.payout_schedules (tenant_id, frequency, weekday, minimum_payout_minor,
                       destination_kind, idempotency_key, updated_by, updated_at)
                     VALUES ($1,$2,$3,$4,'WALLET',$5,$6,$7) RETURNING {SCHEDULE_COLS}"
                ))
                .bind(u.tenant_id)
                .bind(u.frequency)
                .bind(u.weekday)
                .bind(u.minimum_payout_minor)
                .bind(&u.idempotency_key)
                .bind(u.updated_by)
                .bind(u.at)
                .fetch_one(tx.as_mut())
                .await?
            }
        };
        if let Some(ev) = ev {
            Self::insert_event(&mut tx, ev).await?;
        }
        tx.commit().await?;
        schedule_row(&row)
    }

    /// Calendarios con liquidación automática (jobs).
    pub async fn automatic_schedules(&self) -> Result<Vec<ScheduleRow>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let rows = sqlx::query(&format!(
            "SELECT {SCHEDULE_COLS} FROM settlement.payout_schedules WHERE frequency IN (1, 2) ORDER BY tenant_id"
        ))
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        rows.iter().map(schedule_row).collect()
    }

    /// Asientos ya liquidados (o en un lote vivo) del negocio desde `since`, y el instante del último.
    pub async fn settled(
        &self,
        tenant: Uuid,
        since: DateTime<Utc>,
    ) -> Result<(HashSet<Uuid>, Option<DateTime<Utc>>), StoreError> {
        let mut tx = self.begin(&Scope::tenant(tenant)).await?;
        let rows = sqlx::query(
            "SELECT ledger_transaction_id FROM settlement.batch_items WHERE tenant_id = $1 AND NOT released AND occurred_at >= $2",
        )
        .bind(tenant)
        .bind(since)
        .fetch_all(tx.as_mut())
        .await?;
        let last: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT max(occurred_at) FROM settlement.batch_items WHERE tenant_id = $1 AND NOT released",
        )
        .bind(tenant)
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        let ids = rows
            .iter()
            .map(|r| r.try_get::<Uuid, _>("ledger_transaction_id"))
            .collect::<Result<HashSet<_>, _>>()?;
        Ok((ids, last))
    }

    /// Σ neto de los lotes en proceso: todavía está en MERCHANT_PAYABLE pero ya está comprometido (R3).
    pub async fn processing_net(&self, tenant: Uuid) -> Result<i64, StoreError> {
        let mut tx = self.begin(&Scope::tenant(tenant)).await?;
        let n: Option<i64> = sqlx::query_scalar(
            "SELECT sum(net_minor)::bigint FROM settlement.batches WHERE tenant_id = $1 AND status = 2",
        )
        .bind(tenant)
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        Ok(n.unwrap_or(0))
    }

    /// Lote por clave de idempotencia (reintento).
    pub async fn batch_by_key(
        &self,
        tenant: Uuid,
        key: &str,
    ) -> Result<Option<BatchRow>, StoreError> {
        let mut tx = self.begin(&Scope::tenant(tenant)).await?;
        let row = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b WHERE b.tenant_id = $1 AND b.idempotency_key = $2"
        ))
        .bind(tenant)
        .bind(key)
        .fetch_optional(tx.as_mut())
        .await?;
        tx.commit().await?;
        row.as_ref().map(batch_row).transpose()
    }

    /// Crea el lote en PROCESSING con sus partidas, en una sola transacción. Si otro lote tomó una
    /// partida al mismo tiempo, `Conflict` (R1).
    pub async fn create_batch(&self, b: &NewBatch) -> Result<BatchRow, StoreError> {
        let mut tx = self.begin(&Scope::tenant(b.tenant_id)).await?;
        let inserted = sqlx::query(
            "INSERT INTO settlement.batches (id, tenant_id, status, currency, sandbox, period_start, period_end,
               gross_minor, refunds_minor, net_minor, destination_kind, destination_last4, idempotency_key,
               created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
             ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
        )
        .bind(b.id)
        .bind(b.tenant_id)
        .bind(BatchStatus::Processing.code())
        .bind(&b.currency)
        .bind(b.sandbox)
        .bind(b.period_start)
        .bind(b.period_end)
        .bind(b.gross_minor)
        .bind(b.refunds_minor)
        .bind(b.net_minor)
        .bind(&b.destination_kind)
        .bind(&b.destination_last4)
        .bind(&b.idempotency_key)
        .bind(&b.created_by)
        .bind(b.at)
        .execute(tx.as_mut())
        .await?;
        if inserted.rows_affected() == 0 {
            tx.rollback().await?;
            return self
                .batch_by_key(b.tenant_id, &b.idempotency_key)
                .await?
                .ok_or(StoreError::NotFound);
        }
        for it in &b.items {
            let r = sqlx::query(
                "INSERT INTO settlement.batch_items (batch_id, tenant_id, ledger_transaction_id, kind, reference_type,
                   reference_id, amount_minor, sandbox, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            )
            .bind(b.id)
            .bind(b.tenant_id)
            .bind(it.ledger_transaction_id)
            .bind(it.kind.label())
            .bind(&it.reference_type)
            .bind(&it.reference_id)
            .bind(it.amount_minor)
            .bind(it.sandbox)
            .bind(it.occurred_at)
            .execute(tx.as_mut())
            .await;
            if let Err(e) = r {
                if is_unique_violation(&e, "batch_items_once") {
                    return Err(StoreError::Conflict);
                }
                return Err(e.into());
            }
        }
        let row = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b WHERE b.id = $1"
        ))
        .bind(b.id)
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        batch_row(&row)
    }

    pub async fn batch(
        &self,
        scope: &Scope,
        id: Uuid,
    ) -> Result<(BatchRow, Vec<Line>), StoreError> {
        let mut tx = self.begin(scope).await?;
        let row = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b WHERE b.id = $1"
        ))
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
        let items = sqlx::query(
            "SELECT ledger_transaction_id, kind, reference_type, reference_id, amount_minor, occurred_at, sandbox
             FROM settlement.batch_items WHERE batch_id = $1 ORDER BY occurred_at, ledger_transaction_id",
        )
        .bind(id)
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        let lines = items
            .iter()
            .map(|r| {
                let kind: String = r.try_get("kind")?;
                Ok(Line {
                    ledger_transaction_id: r.try_get("ledger_transaction_id")?,
                    kind: ItemKind::parse(&kind)
                        .ok_or_else(|| StoreError::Corrupt(format!("item kind {kind}")))?,
                    reference_type: r.try_get("reference_type")?,
                    reference_id: r.try_get("reference_id")?,
                    amount_minor: r.try_get("amount_minor")?,
                    occurred_at: r.try_get("occurred_at")?,
                    sandbox: r.try_get("sandbox")?,
                })
            })
            .collect::<Result<Vec<_>, StoreError>>()?;
        Ok((batch_row(&row)?, lines))
    }

    /// Lotes de un negocio (o de todos con alcance de servicio), del más nuevo al más viejo.
    pub async fn batches(
        &self,
        scope: &Scope,
        tenant: Option<Uuid>,
        status: Option<BatchStatus>,
        limit: i64,
        before: Option<(DateTime<Utc>, Uuid)>,
    ) -> Result<Vec<BatchRow>, StoreError> {
        let mut tx = self.begin(scope).await?;
        let rows = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b
             WHERE ($1::uuid IS NULL OR b.tenant_id = $1) AND ($2::smallint IS NULL OR b.status = $2)
               AND ($3::timestamptz IS NULL OR (b.created_at, b.id) < ($3, $4))
             ORDER BY b.created_at DESC, b.id DESC LIMIT $5"
        ))
        .bind(tenant)
        .bind(status.map(BatchStatus::code))
        .bind(before.map(|b| b.0))
        .bind(before.map(|b| b.1).unwrap_or_default())
        .bind(limit)
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        rows.iter().map(batch_row).collect()
    }

    /// Lotes a la billetera en proceso: el asiento T6b quedó pendiente (job de reintento).
    pub async fn pending_wallet_batches(&self, limit: i64) -> Result<Vec<BatchRow>, StoreError> {
        self.batches(
            &Scope::service(),
            None,
            Some(BatchStatus::Processing),
            limit,
            None,
        )
        .await
        .map(|v| {
            v.into_iter()
                .filter(|b| b.destination_kind == "WALLET")
                .collect()
        })
    }

    async fn insert_event(
        tx: &mut Transaction<'static, Postgres>,
        ev: &OutboxEvent,
    ) -> Result<(), StoreError> {
        sqlx::query(
            "INSERT INTO settlement.outbox (id, tenant_id, aggregate_id, event_type, payload, created_at)
             VALUES ($1,$2,$3,$4,$5,$6)",
        )
        .bind(ev.id)
        .bind(ev.tenant_id)
        .bind(ev.aggregate_id)
        .bind(&ev.event_type)
        .bind(&ev.payload)
        .bind(ev.at)
        .execute(tx.as_mut())
        .await?;
        Ok(())
    }

    /// PROCESSING → PAID con el asiento y el evento en la misma transacción (ADR 0012).
    pub async fn mark_paid(
        &self,
        id: Uuid,
        ledger_tx: Uuid,
        external_ref: &str,
        at: DateTime<Utc>,
        ev: &OutboxEvent,
    ) -> Result<BatchRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(
            "UPDATE settlement.batches SET status = 3, ledger_transaction_id = $2,
               payout_external_ref = NULLIF($3, ''), paid_at = $4, updated_at = $4
             WHERE id = $1 AND status = 2",
        )
        .bind(id)
        .bind(ledger_tx)
        .bind(external_ref)
        .bind(at)
        .execute(tx.as_mut())
        .await?;
        if r.rows_affected() == 0 {
            return Err(StoreError::InvalidStateTransition);
        }
        Self::insert_event(&mut tx, ev).await?;
        let row = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b WHERE b.id = $1"
        ))
        .bind(id)
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        batch_row(&row)
    }

    /// PROCESSING → FAILED: sin asiento; las partidas vuelven a ser elegibles.
    pub async fn mark_failed(
        &self,
        id: Uuid,
        reason: &str,
        at: DateTime<Utc>,
        ev: &OutboxEvent,
    ) -> Result<BatchRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(
            "UPDATE settlement.batches SET status = 4, failure_reason = $2, updated_at = $3 WHERE id = $1 AND status = 2",
        )
        .bind(id)
        .bind(reason)
        .bind(at)
        .execute(tx.as_mut())
        .await?;
        if r.rows_affected() == 0 {
            return Err(StoreError::InvalidStateTransition);
        }
        sqlx::query("UPDATE settlement.batch_items SET released = true WHERE batch_id = $1")
            .bind(id)
            .execute(tx.as_mut())
            .await?;
        Self::insert_event(&mut tx, ev).await?;
        let row = sqlx::query(&format!(
            "SELECT {BATCH_COLS} FROM settlement.batches b WHERE b.id = $1"
        ))
        .bind(id)
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        batch_row(&row)
    }

    pub async fn processing_count(&self) -> Result<i64, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let n: i64 = sqlx::query_scalar("SELECT count(*) FROM settlement.batches WHERE status = 2")
            .fetch_one(tx.as_mut())
            .await?;
        tx.commit().await?;
        Ok(n)
    }

    /// Evento suelto (p. ej. cambio de destino) en su propia transacción.
    pub async fn record_event(&self, ev: &OutboxEvent) -> Result<(), StoreError> {
        let mut tx = self.begin(&Scope::tenant(ev.tenant_id)).await?;
        Self::insert_event(&mut tx, ev).await?;
        tx.commit().await?;
        Ok(())
    }
}
