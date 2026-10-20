//! Persistencia del ledger (sqlx). Toda escritura ocurre en UNA transacción de base de datos que
//! incluye idempotencia, bloqueo de cuentas en orden (R7), saldo/retenido (I5), asientos, estado
//! POSTED y outbox (ADR 0012). La base vuelve a comprobar I1–I3 con triggers.

use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::domain::accounts::{signed_delta, AccountType, Side};
use crate::domain::errors::DomainError;
use crate::domain::templates::{self, EntrySpec, REVERSAL};

/// Errores del store: de dominio, de reglas que solo se pueden comprobar con datos, o de la base.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error("idempotency key reused with a different request")]
    IdempotencyKeyReused,
    #[error("payment already captured")]
    DuplicateCapture,
    #[error("insufficient funds")]
    InsufficientFunds,
    #[error("not found")]
    NotFound,
    #[error("transaction already reversed")]
    AlreadyReversed,
    #[error("hold is not active")]
    HoldNotActive,
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
}

/// Una transacción a asentar.
#[derive(Debug, Clone)]
pub struct PostCommand {
    pub idempotency_key: String,
    pub request_hash: Vec<u8>,
    pub tenant_id: Option<Uuid>,
    pub transaction_type: String,
    pub reference_type: String,
    pub reference_id: String,
    pub currency: String,
    pub description: String,
    pub entries: Vec<EntrySpec>,
    pub effective_at: Option<DateTime<Utc>>,
}

/// Cuenta tal como se devuelve.
#[derive(Debug, Clone)]
pub struct AccountView {
    pub id: Uuid,
    pub party_id: String,
    pub account_type: AccountType,
    pub currency: String,
    pub scope_id: String,
    pub balance_minor: i64,
    pub held_minor: i64,
}

#[derive(Debug, Clone)]
pub struct EntryView {
    pub id: Uuid,
    pub account: AccountView,
    pub side: Side,
    pub amount_minor: i64,
}

#[derive(Debug, Clone)]
pub struct TransactionView {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub transaction_type: String,
    pub reference_type: String,
    pub reference_id: String,
    pub currency: String,
    pub description: String,
    pub reversed: bool,
    pub reversal_of: Option<Uuid>,
    pub effective_at: DateTime<Utc>,
    pub posted_at: Option<DateTime<Utc>>,
    pub entries: Vec<EntryView>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HoldStatus {
    Active,
    Captured,
    Released,
    Expired,
}

impl HoldStatus {
    fn parse(s: &str) -> Self {
        match s {
            "CAPTURED" => HoldStatus::Captured,
            "RELEASED" => HoldStatus::Released,
            "EXPIRED" => HoldStatus::Expired,
            _ => HoldStatus::Active,
        }
    }
    pub fn code(self) -> &'static str {
        match self {
            HoldStatus::Active => "ACTIVE",
            HoldStatus::Captured => "CAPTURED",
            HoldStatus::Released => "RELEASED",
            HoldStatus::Expired => "EXPIRED",
        }
    }
}

#[derive(Debug, Clone)]
pub struct HoldView {
    pub id: Uuid,
    pub account: AccountView,
    pub amount_minor: i64,
    pub status: HoldStatus,
    pub reference_type: String,
    pub reference_id: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub captured_transaction_id: Option<Uuid>,
}

/// Una retención a crear.
#[derive(Debug, Clone)]
pub struct HoldCommand {
    pub idempotency_key: String,
    pub request_hash: Vec<u8>,
    pub party_id: String,
    pub currency: String,
    pub scope_id: String,
    pub amount_minor: i64,
    pub reference_type: String,
    pub reference_id: String,
    pub ttl_seconds: i64,
}

/// Una captura de hold: débito por el monto del hold a su cuenta + créditos (legs).
#[derive(Debug, Clone)]
pub struct CaptureCommand {
    pub hold_id: Uuid,
    pub post: PostCommand,
    pub legs: Vec<EntrySpec>,
}

/// Línea de extracto.
#[derive(Debug, Clone)]
pub struct StatementLine {
    pub entry: EntryView,
    pub transaction_id: Uuid,
    pub transaction_type: String,
    pub description: String,
    pub running_balance_minor: i64,
    pub effective_at: DateTime<Utc>,
}

/// Quién lee, para RLS (ADR 0014): el servicio, o una parte/negocio concretos desde el gateway.
#[derive(Debug, Clone, Default)]
pub struct ReadScope {
    pub service: bool,
    pub party_id: String,
    pub tenant_id: String,
}

pub struct PgLedger {
    pool: PgPool,
}

const MAX_HOLD_TTL: i64 = 7 * 24 * 3600;

impl PgLedger {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    async fn begin_service(&self) -> Result<Transaction<'static, Postgres>, StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.actor', 'service', true)")
            .execute(tx.as_mut())
            .await?;
        Ok(tx)
    }

    async fn begin_read(
        &self,
        scope: &ReadScope,
    ) -> Result<Transaction<'static, Postgres>, StoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.actor', $1, true), set_config('app.party_id', $2, true), set_config('app.tenant_id', $3, true)")
            .bind(if scope.service { "service" } else { "reader" })
            .bind(&scope.party_id)
            .bind(&scope.tenant_id)
            .execute(tx.as_mut())
            .await?;
        Ok(tx)
    }

    /// PostTransaction (SPEC §4, R1–R8, R12, R13).
    #[tracing::instrument(skip_all, err, fields(pp.transaction_type = %cmd.transaction_type))]
    pub async fn post(&self, cmd: PostCommand) -> Result<TransactionView, StoreError> {
        templates::validate(&cmd.transaction_type, &cmd.currency, &cmd.entries)?;
        if let Some(at) = cmd.effective_at {
            templates::validate_effective_offset(
                at.signed_duration_since(Utc::now()).num_seconds(),
            )?;
        }
        let mut tx = self.begin_service().await?;
        if let Some(existing) =
            idempotent_replay(&mut tx, &cmd.idempotency_key, &cmd.request_hash).await?
        {
            tx.rollback().await?;
            return self
                .transaction(
                    existing,
                    &ReadScope {
                        service: true,
                        ..Default::default()
                    },
                )
                .await;
        }
        let id = post_in_tx(&mut tx, &cmd, None, None).await?;
        tx.commit().await?;
        self.transaction(
            id,
            &ReadScope {
                service: true,
                ..Default::default()
            },
        )
        .await
    }

    /// ReverseTransaction (R3): asientos espejo, original → REVERSED; un reverso por transacción.
    #[tracing::instrument(skip_all, err)]
    pub async fn reverse(
        &self,
        original: Uuid,
        idempotency_key: String,
        request_hash: Vec<u8>,
        reason: String,
    ) -> Result<TransactionView, StoreError> {
        let mut tx = self.begin_service().await?;
        if let Some(existing) = idempotent_replay(&mut tx, &idempotency_key, &request_hash).await? {
            tx.rollback().await?;
            return self
                .transaction(
                    existing,
                    &ReadScope {
                        service: true,
                        ..Default::default()
                    },
                )
                .await;
        }
        let row = sqlx::query("SELECT status, tenant_id, transaction_type, reference_type, reference_id, currency FROM ledger.transactions WHERE id = $1 FOR UPDATE")
            .bind(original)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        let status: String = row.try_get("status")?;
        if status == "REVERSED" {
            return Err(StoreError::AlreadyReversed);
        }
        let entries = load_entries(&mut tx, original).await?;
        let specs: Vec<EntrySpec> = entries
            .iter()
            .map(|e| EntrySpec {
                party_id: e.account.party_id.clone(),
                account_type: e.account.account_type,
                currency: e.account.currency.clone(),
                scope_id: e.account.scope_id.clone(),
                side: e.side,
                amount_minor: e.amount_minor,
            })
            .collect();
        let cmd = PostCommand {
            idempotency_key,
            request_hash,
            tenant_id: row.try_get("tenant_id")?,
            transaction_type: REVERSAL.into(),
            reference_type: "reversal".into(),
            reference_id: original.to_string(),
            currency: row.try_get::<String, _>("currency")?.trim().to_string(),
            description: reason,
            entries: templates::mirror(&specs),
            effective_at: None,
        };
        let id = post_in_tx(&mut tx, &cmd, None, Some(original)).await?;
        sqlx::query("UPDATE ledger.transactions SET status = 'REVERSED' WHERE id = $1")
            .bind(original)
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        self.transaction(
            id,
            &ReadScope {
                service: true,
                ..Default::default()
            },
        )
        .await
    }

    /// CreateHold: disponible ≥ monto bajo bloqueo; retenido += monto (I5).
    #[tracing::instrument(skip_all, err)]
    pub async fn create_hold(&self, cmd: HoldCommand) -> Result<HoldView, StoreError> {
        if cmd.ttl_seconds <= 0 || cmd.ttl_seconds > MAX_HOLD_TTL {
            return Err(DomainError::InvalidHoldTtl.into());
        }
        let probe = EntrySpec {
            party_id: cmd.party_id.clone(),
            account_type: AccountType::Wallet,
            currency: cmd.currency.clone(),
            scope_id: cmd.scope_id.clone(),
            side: Side::Debit,
            amount_minor: cmd.amount_minor,
        };
        templates::validate_currency(&cmd.currency)?;
        templates::validate_entry(&probe, &cmd.currency)?;
        let mut tx = self.begin_service().await?;
        if let Some(row) =
            sqlx::query("SELECT id, request_hash FROM ledger.holds WHERE idempotency_key = $1")
                .bind(&cmd.idempotency_key)
                .fetch_optional(tx.as_mut())
                .await?
        {
            let hash: Vec<u8> = row.try_get("request_hash")?;
            if hash != cmd.request_hash {
                return Err(StoreError::IdempotencyKeyReused);
            }
            let id: Uuid = row.try_get("id")?;
            tx.rollback().await?;
            return self.hold(id).await;
        }
        let account_id = ensure_account(&mut tx, &probe, None).await?;
        let acc = sqlx::query(
            "SELECT balance_minor, held_minor FROM ledger.accounts WHERE id = $1 FOR UPDATE",
        )
        .bind(account_id)
        .fetch_one(tx.as_mut())
        .await?;
        let balance: i64 = acc.try_get("balance_minor")?;
        let held: i64 = acc.try_get("held_minor")?;
        let available = balance.checked_sub(held).ok_or(DomainError::Overflow)?;
        if available < cmd.amount_minor {
            return Err(StoreError::InsufficientFunds);
        }
        let id = Uuid::now_v7();
        sqlx::query("UPDATE ledger.accounts SET held_minor = held_minor + $2, version = version + 1 WHERE id = $1")
            .bind(account_id)
            .bind(cmd.amount_minor)
            .execute(tx.as_mut())
            .await?;
        sqlx::query(
            "INSERT INTO ledger.holds (id, account_id, amount_minor, status, reference_type, reference_id, idempotency_key, request_hash, expires_at)
             VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, now() + $8 * interval '1 second')",
        )
        .bind(id)
        .bind(account_id)
        .bind(cmd.amount_minor)
        .bind(&cmd.reference_type)
        .bind(&cmd.reference_id)
        .bind(&cmd.idempotency_key)
        .bind(&cmd.request_hash)
        .bind(cmd.ttl_seconds)
        .execute(tx.as_mut())
        .await?;
        hold_event(&mut tx, id, HoldStatus::Active).await?;
        tx.commit().await?;
        self.hold(id).await
    }

    /// CaptureHold (R10): en una transacción, hold → CAPTURED, retenido liberado y asiento con D
    /// sobre la cuenta del hold por su monto y los créditos de `legs` (Σ legs = monto).
    #[tracing::instrument(skip_all, err)]
    pub async fn capture_hold(
        &self,
        cmd: CaptureCommand,
    ) -> Result<(HoldView, TransactionView), StoreError> {
        let mut tx = self.begin_service().await?;
        if let Some(existing) =
            idempotent_replay(&mut tx, &cmd.post.idempotency_key, &cmd.post.request_hash).await?
        {
            tx.rollback().await?;
            let txv = self
                .transaction(
                    existing,
                    &ReadScope {
                        service: true,
                        ..Default::default()
                    },
                )
                .await?;
            return Ok((self.hold(cmd.hold_id).await?, txv));
        }
        let hold = load_hold_for_update(&mut tx, cmd.hold_id).await?;
        if hold.status != HoldStatus::Active || hold.expires_at <= Utc::now() {
            return Err(StoreError::HoldNotActive);
        }
        let mut entries = vec![EntrySpec {
            party_id: hold.account.party_id.clone(),
            account_type: hold.account.account_type,
            currency: hold.account.currency.clone(),
            scope_id: hold.account.scope_id.clone(),
            side: Side::Debit,
            amount_minor: hold.amount_minor,
        }];
        entries.extend(cmd.legs.iter().cloned().map(|l| EntrySpec {
            side: Side::Credit,
            ..l
        }));
        let post = PostCommand {
            entries,
            currency: hold.account.currency.clone(),
            ..cmd.post
        };
        templates::validate(&post.transaction_type, &post.currency, &post.entries)?;
        let txid = post_in_tx(
            &mut tx,
            &post,
            Some((hold.account.id, hold.amount_minor)),
            None,
        )
        .await?;
        sqlx::query("UPDATE ledger.holds SET status = 'CAPTURED', captured_transaction_id = $2, updated_at = now() WHERE id = $1")
            .bind(hold.id)
            .bind(txid)
            .execute(tx.as_mut())
            .await?;
        hold_event(&mut tx, hold.id, HoldStatus::Captured).await?;
        tx.commit().await?;
        let txv = self
            .transaction(
                txid,
                &ReadScope {
                    service: true,
                    ..Default::default()
                },
            )
            .await?;
        Ok((self.hold(hold.id).await?, txv))
    }

    /// ReleaseHold: ACTIVE → RELEASED liberando lo retenido; otros estados se devuelven sin cambio.
    #[tracing::instrument(skip_all, err)]
    pub async fn release_hold(&self, hold_id: Uuid) -> Result<HoldView, StoreError> {
        self.finish_hold(hold_id, HoldStatus::Released).await
    }

    async fn finish_hold(&self, hold_id: Uuid, to: HoldStatus) -> Result<HoldView, StoreError> {
        let mut tx = self.begin_service().await?;
        let hold = load_hold_for_update(&mut tx, hold_id).await?;
        if hold.status == HoldStatus::Active {
            sqlx::query("SELECT id FROM ledger.accounts WHERE id = $1 FOR UPDATE")
                .bind(hold.account.id)
                .execute(tx.as_mut())
                .await?;
            sqlx::query("UPDATE ledger.accounts SET held_minor = held_minor - $2, version = version + 1 WHERE id = $1")
                .bind(hold.account.id)
                .bind(hold.amount_minor)
                .execute(tx.as_mut())
                .await?;
            sqlx::query("UPDATE ledger.holds SET status = $2, updated_at = now() WHERE id = $1")
                .bind(hold_id)
                .bind(to.code())
                .execute(tx.as_mut())
                .await?;
            hold_event(&mut tx, hold_id, to).await?;
        }
        tx.commit().await?;
        self.hold(hold_id).await
    }

    /// Job R9: vence los holds ACTIVE con TTL cumplido. Devuelve cuántos venció.
    #[tracing::instrument(skip_all, err)]
    pub async fn expire_holds(&self) -> Result<u64, StoreError> {
        let mut tx = self.begin_service().await?;
        let ids: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM ledger.holds WHERE status = 'ACTIVE' AND expires_at <= now() ORDER BY expires_at LIMIT 500")
            .fetch_all(tx.as_mut())
            .await?;
        tx.commit().await?;
        let mut n = 0u64;
        for id in ids {
            let h = self.finish_hold(id, HoldStatus::Expired).await?;
            if h.status == HoldStatus::Expired {
                n = n.saturating_add(1);
            }
        }
        Ok(n)
    }

    pub async fn hold(&self, id: Uuid) -> Result<HoldView, StoreError> {
        let mut tx = self.begin_service().await?;
        let h = load_hold(&mut tx, id, false).await?;
        tx.commit().await?;
        Ok(h)
    }

    pub async fn transaction(
        &self,
        id: Uuid,
        scope: &ReadScope,
    ) -> Result<TransactionView, StoreError> {
        let mut tx = self.begin_read(scope).await?;
        let row = sqlx::query("SELECT id, tenant_id, transaction_type, reference_type, reference_id, currency, description, status, reversal_of, effective_at, posted_at FROM ledger.transactions WHERE id = $1")
            .bind(id)
            .fetch_optional(tx.as_mut())
            .await?
            .ok_or(StoreError::NotFound)?;
        let mut view = transaction_from_row(&row)?;
        view.entries = load_entries(&mut tx, id).await?;
        tx.commit().await?;
        Ok(view)
    }

    /// ListTransactions por parte o negocio (y referencia opcional), más recientes primero; keyset
    /// por (posted_at, id).
    pub async fn list_transactions(
        &self,
        scope: &ReadScope,
        party_id: Option<Uuid>,
        tenant_id: Option<Uuid>,
        reference: Option<(String, String)>,
        after: Option<(DateTime<Utc>, Uuid)>,
        limit: i64,
    ) -> Result<Vec<TransactionView>, StoreError> {
        let mut tx = self.begin_read(scope).await?;
        let rows = sqlx::query(
            "SELECT t.id, t.tenant_id, t.transaction_type, t.reference_type, t.reference_id, t.currency, t.description, t.status, t.reversal_of, t.effective_at, t.posted_at
             FROM ledger.transactions t
             WHERE t.status <> 'DRAFT'
               AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM ledger.entries e JOIN ledger.accounts a ON a.id = e.account_id WHERE e.transaction_id = t.id AND a.party_id = $1))
               AND ($2::uuid IS NULL OR t.tenant_id = $2)
               AND ($3::text IS NULL OR (t.reference_type = $3 AND t.reference_id = $4))
               AND ($5::timestamptz IS NULL OR (t.posted_at, t.id) < ($5, $6))
             ORDER BY t.posted_at DESC, t.id DESC LIMIT $7",
        )
        .bind(party_id)
        .bind(tenant_id)
        .bind(reference.as_ref().map(|r| r.0.clone()))
        .bind(reference.as_ref().map(|r| r.1.clone()))
        .bind(after.map(|a| a.0))
        .bind(after.map(|a| a.1))
        .bind(limit)
        .fetch_all(tx.as_mut())
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            let mut v = transaction_from_row(&row)?;
            v.entries = load_entries(&mut tx, v.id).await?;
            out.push(v);
        }
        tx.commit().await?;
        Ok(out)
    }

    /// GetBalance: una cuenta inexistente es saldo 0, no error (SPEC §4).
    pub async fn balance(
        &self,
        scope: &ReadScope,
        spec: &EntrySpec,
    ) -> Result<AccountView, StoreError> {
        let mut tx = self.begin_read(scope).await?;
        let row = sqlx::query("SELECT id, party_id, account_type, currency, scope_id, balance_minor, held_minor FROM ledger.accounts WHERE party_id = $1 AND account_type = $2 AND currency = $3 AND scope_id = $4")
            .bind(parse_party(&spec.party_id)?)
            .bind(spec.account_type.code())
            .bind(&spec.currency)
            .bind(&spec.scope_id)
            .fetch_optional(tx.as_mut())
            .await?;
        tx.commit().await?;
        match row {
            Some(r) => account_from_row(&r),
            None => Ok(AccountView {
                id: Uuid::nil(),
                party_id: spec.party_id.clone(),
                account_type: spec.account_type,
                currency: spec.currency.clone(),
                scope_id: spec.scope_id.clone(),
                balance_minor: 0,
                held_minor: 0,
            }),
        }
    }

    pub async fn balances(
        &self,
        scope: &ReadScope,
        party_id: Uuid,
    ) -> Result<Vec<AccountView>, StoreError> {
        let mut tx = self.begin_read(scope).await?;
        let rows = sqlx::query("SELECT id, party_id, account_type, currency, scope_id, balance_minor, held_minor FROM ledger.accounts WHERE party_id = $1 ORDER BY account_type, currency, scope_id")
            .bind(party_id)
            .fetch_all(tx.as_mut())
            .await?;
        tx.commit().await?;
        rows.iter().map(account_from_row).collect()
    }

    /// GetStatement: saldo inicial antes del rango y líneas con saldo corrido (rango ≤ 366 días lo
    /// valida la capa gRPC).
    pub async fn statement(
        &self,
        scope: &ReadScope,
        spec: &EntrySpec,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
        limit: i64,
    ) -> Result<(i64, Vec<StatementLine>), StoreError> {
        let account = self.balance(scope, spec).await?;
        if account.id.is_nil() {
            return Ok((0, Vec::new()));
        }
        let class = account.account_type.class();
        let mut tx = self.begin_read(scope).await?;
        let before = sqlx::query("SELECT e.side, e.amount_minor FROM ledger.entries e JOIN ledger.transactions t ON t.id = e.transaction_id WHERE e.account_id = $1 AND t.status <> 'DRAFT' AND t.effective_at < $2")
            .bind(account.id)
            .bind(from)
            .fetch_all(tx.as_mut())
            .await?;
        let mut running: i64 = 0;
        for r in &before {
            let side = Side::from_code(r.try_get::<String, _>("side")?.as_str())?;
            running = running
                .checked_add(signed_delta(class, side, r.try_get("amount_minor")?)?)
                .ok_or(DomainError::Overflow)?;
        }
        let opening = running;
        let rows = sqlx::query(
            "SELECT e.id, e.side, e.amount_minor, t.id AS tid, t.transaction_type, t.description, t.effective_at
             FROM ledger.entries e JOIN ledger.transactions t ON t.id = e.transaction_id
             WHERE e.account_id = $1 AND t.status <> 'DRAFT' AND t.effective_at >= $2 AND t.effective_at < $3
             ORDER BY t.effective_at, e.id LIMIT $4",
        )
        .bind(account.id)
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        let mut lines = Vec::with_capacity(rows.len());
        for r in rows {
            let side = Side::from_code(r.try_get::<String, _>("side")?.as_str())?;
            let amount: i64 = r.try_get("amount_minor")?;
            running = running
                .checked_add(signed_delta(class, side, amount)?)
                .ok_or(DomainError::Overflow)?;
            lines.push(StatementLine {
                entry: EntryView {
                    id: r.try_get("id")?,
                    account: account.clone(),
                    side,
                    amount_minor: amount,
                },
                transaction_id: r.try_get("tid")?,
                transaction_type: r.try_get("transaction_type")?,
                description: r.try_get("description")?,
                running_balance_minor: running,
                effective_at: r.try_get("effective_at")?,
            });
        }
        Ok((opening, lines))
    }

    /// Job I7 (R11): por moneda, Σ saldos con signo de clase = 0 y `balance_minor` = recomputado.
    /// Devuelve el número de violaciones encontradas.
    pub async fn check_invariants(&self) -> Result<i64, StoreError> {
        let mut tx = self.begin_service().await?;
        let mismatched: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM ledger.accounts a
             WHERE a.balance_minor <> coalesce((
               SELECT sum(CASE WHEN (a.account_type IN (5,7,9,10,11)) = (e.side = 'D') THEN e.amount_minor ELSE -e.amount_minor END)
               FROM ledger.entries e JOIN ledger.transactions t ON t.id = e.transaction_id
               WHERE e.account_id = a.id AND t.status <> 'DRAFT'), 0)",
        )
        .fetch_one(tx.as_mut())
        .await?;
        let unbalanced_currencies: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM (
               SELECT currency FROM ledger.accounts
               GROUP BY currency
               HAVING sum(CASE WHEN account_type IN (5,7,9,10,11) THEN balance_minor ELSE -balance_minor END) <> 0) x",
        )
        .fetch_one(tx.as_mut())
        .await?;
        tx.commit().await?;
        Ok(mismatched.saturating_add(unbalanced_currencies))
    }
}

// ── Internos de la transacción ────────────────────────────────────────────────

/// Si la clave ya existe: mismo hash → id original; hash distinto → IDEMPOTENCY_KEY_REUSED (R4).
async fn idempotent_replay(
    tx: &mut Transaction<'static, Postgres>,
    key: &str,
    hash: &[u8],
) -> Result<Option<Uuid>, StoreError> {
    if key.is_empty() {
        return Err(DomainError::IdempotencyKeyRequired.into());
    }
    let row =
        sqlx::query("SELECT id, request_hash FROM ledger.transactions WHERE idempotency_key = $1")
            .bind(key)
            .fetch_optional(tx.as_mut())
            .await?;
    match row {
        None => Ok(None),
        Some(r) => {
            let stored: Vec<u8> = r.try_get("request_hash")?;
            if stored != hash {
                return Err(StoreError::IdempotencyKeyReused);
            }
            Ok(Some(r.try_get("id")?))
        }
    }
}

/// Inserta la transacción completa. `release` = (cuenta, monto) retenido que se libera en la misma
/// operación (captura de hold). `reversal_of` marca el reverso.
async fn post_in_tx(
    tx: &mut Transaction<'static, Postgres>,
    cmd: &PostCommand,
    release: Option<(Uuid, i64)>,
    reversal_of: Option<Uuid>,
) -> Result<Uuid, StoreError> {
    // Cuentas perezosas y bloqueo en orden ascendente de id (R7: sin deadlocks cruzados).
    let mut ids = Vec::new();
    for (party, account_type, currency, scope) in templates::distinct_accounts(&cmd.entries) {
        let spec = EntrySpec {
            party_id: party,
            account_type,
            currency,
            scope_id: scope,
            side: Side::Debit,
            amount_minor: 1,
        };
        ids.push((ensure_account(tx, &spec, cmd.tenant_id).await?, spec));
    }
    let mut lock_ids: Vec<Uuid> = ids.iter().map(|(id, _)| *id).collect();
    lock_ids.sort();
    let locked = sqlx::query("SELECT id, party_id, account_type, scope_id, balance_minor, held_minor FROM ledger.accounts WHERE id = ANY($1) ORDER BY id FOR UPDATE")
        .bind(&lock_ids)
        .fetch_all(tx.as_mut())
        .await?;

    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO ledger.transactions (id, tenant_id, transaction_type, reference_type, reference_id, currency, description, status, reversal_of, idempotency_key, request_hash, effective_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8, $9, $10, coalesce($11, now()))",
    )
    .bind(id)
    .bind(cmd.tenant_id)
    .bind(&cmd.transaction_type)
    .bind(&cmd.reference_type)
    .bind(&cmd.reference_id)
    .bind(&cmd.currency)
    .bind(&cmd.description)
    .bind(reversal_of)
    .bind(&cmd.idempotency_key)
    .bind(&cmd.request_hash)
    .bind(cmd.effective_at)
    .execute(tx.as_mut())
    .await
    .map_err(map_unique)?;

    // Deltas por cuenta.
    let mut deltas: Vec<(Uuid, i64)> = Vec::new();
    for e in &cmd.entries {
        let account_id = ids
            .iter()
            .find(|(_, s)| {
                s.party_id == e.party_id
                    && s.account_type == e.account_type
                    && s.currency == e.currency
                    && s.scope_id == e.scope_id
            })
            .map(|(id, _)| *id)
            .ok_or(StoreError::NotFound)?;
        sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1, $2, $3, $4, $5, $6)")
            .bind(Uuid::now_v7())
            .bind(id)
            .bind(account_id)
            .bind(e.side.code())
            .bind(e.amount_minor)
            .bind(&cmd.currency)
            .execute(tx.as_mut())
            .await?;
        let d = signed_delta(e.account_type.class(), e.side, e.amount_minor)?;
        match deltas.iter_mut().find(|(a, _)| *a == account_id) {
            Some((_, acc)) => *acc = acc.checked_add(d).ok_or(DomainError::Overflow)?,
            None => deltas.push((account_id, d)),
        }
    }

    // I5: con las cuentas bloqueadas, ninguna sin permiso queda con disponible < 0.
    for row in &locked {
        let account_id: Uuid = row.try_get("id")?;
        let delta = deltas
            .iter()
            .find(|(a, _)| *a == account_id)
            .map(|(_, d)| *d)
            .unwrap_or(0);
        let mut held: i64 = row.try_get("held_minor")?;
        if let Some((rid, amount)) = release {
            if rid == account_id {
                held = held.checked_sub(amount).ok_or(DomainError::Overflow)?;
            }
        }
        let balance: i64 = row
            .try_get::<i64, _>("balance_minor")?
            .checked_add(delta)
            .ok_or(DomainError::Overflow)?;
        let account_type =
            AccountType::from_i32(i32::from(row.try_get::<i16, _>("account_type")?))?;
        let party: Uuid = row.try_get("party_id")?;
        let scope: String = row.try_get("scope_id")?;
        let available = balance.checked_sub(held).ok_or(DomainError::Overflow)?;
        if available < 0 && !account_type.allows_negative(&party.to_string(), &scope) {
            return Err(StoreError::InsufficientFunds);
        }
        sqlx::query("UPDATE ledger.accounts SET balance_minor = $2, held_minor = $3, version = version + 1 WHERE id = $1")
            .bind(account_id)
            .bind(balance)
            .bind(held)
            .execute(tx.as_mut())
            .await?;
    }

    // El índice único parcial `one_capture_per_payment` (R5) solo ve filas no DRAFT: la segunda
    // captura de un pago choca aquí, no en el INSERT.
    sqlx::query("UPDATE ledger.transactions SET status = 'POSTED' WHERE id = $1")
        .bind(id)
        .execute(tx.as_mut())
        .await
        .map_err(map_unique)?;

    // Outbox TransactionPosted (ADR 0012): mismo commit que el asiento.
    let entries_json: Vec<serde_json::Value> = cmd
        .entries
        .iter()
        .map(|e| {
            json!({
                "account": {"party_id": e.party_id, "type": e.account_type.code(), "currency": e.currency, "scope_id": e.scope_id},
                "side": if e.side == Side::Debit { 1 } else { 2 },
                "amount_minor": e.amount_minor.to_string(),
            })
        })
        .collect();
    let payload = json!({
        "transaction_id": id.to_string(),
        "tenant_id": cmd.tenant_id.map(|t| t.to_string()).unwrap_or_default(),
        "transaction_type": cmd.transaction_type,
        "reference": {"type": cmd.reference_type, "id": cmd.reference_id},
        "currency": cmd.currency,
        "entries": entries_json,
    });
    sqlx::query("INSERT INTO ledger.outbox (id, aggregate_type, aggregate_id, event_type, payload) VALUES ($1, 'transaction', $2, 'pp.ledger.transaction.posted.v1', $3)")
        .bind(Uuid::now_v7())
        .bind(id.to_string())
        .bind(payload)
        .execute(tx.as_mut())
        .await?;
    Ok(id)
}

/// Crea la cuenta si no existe (perezosa) y devuelve su id.
async fn ensure_account(
    tx: &mut Transaction<'static, Postgres>,
    e: &EntrySpec,
    tenant: Option<Uuid>,
) -> Result<Uuid, StoreError> {
    let party = parse_party(&e.party_id)?;
    let tenant_of_account = tenant.filter(|t| *t == party);
    let allow_negative = e.account_type.allows_negative(&e.party_id, &e.scope_id);
    sqlx::query(
        "INSERT INTO ledger.accounts (id, party_id, account_type, currency, scope_id, tenant_id, allow_negative)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (party_id, account_type, currency, scope_id) DO NOTHING",
    )
    .bind(Uuid::now_v7())
    .bind(party)
    .bind(e.account_type.code())
    .bind(&e.currency)
    .bind(&e.scope_id)
    .bind(tenant_of_account)
    .bind(allow_negative)
    .execute(tx.as_mut())
    .await?;
    let id: Uuid = sqlx::query_scalar("SELECT id FROM ledger.accounts WHERE party_id = $1 AND account_type = $2 AND currency = $3 AND scope_id = $4")
        .bind(party)
        .bind(e.account_type.code())
        .bind(&e.currency)
        .bind(&e.scope_id)
        .fetch_one(tx.as_mut())
        .await?;
    Ok(id)
}

async fn load_entries(
    tx: &mut Transaction<'static, Postgres>,
    transaction_id: Uuid,
) -> Result<Vec<EntryView>, StoreError> {
    let rows = sqlx::query(
        "SELECT e.id AS eid, e.side, e.amount_minor, a.id, a.party_id, a.account_type, a.currency, a.scope_id, a.balance_minor, a.held_minor
         FROM ledger.entries e JOIN ledger.accounts a ON a.id = e.account_id WHERE e.transaction_id = $1 ORDER BY e.id",
    )
    .bind(transaction_id)
    .fetch_all(tx.as_mut())
    .await?;
    rows.iter()
        .map(|r| {
            Ok(EntryView {
                id: r.try_get("eid")?,
                account: account_from_row(r)?,
                side: Side::from_code(r.try_get::<String, _>("side")?.as_str())?,
                amount_minor: r.try_get("amount_minor")?,
            })
        })
        .collect()
}

async fn load_hold_for_update(
    tx: &mut Transaction<'static, Postgres>,
    id: Uuid,
) -> Result<HoldView, StoreError> {
    load_hold(tx, id, true).await
}

async fn load_hold(
    tx: &mut Transaction<'static, Postgres>,
    id: Uuid,
    for_update: bool,
) -> Result<HoldView, StoreError> {
    let sql = format!(
        "SELECT h.id AS hid, h.amount_minor AS hamount, h.status, h.reference_type, h.reference_id, h.expires_at, h.created_at AS hcreated, h.captured_transaction_id,
                a.id, a.party_id, a.account_type, a.currency, a.scope_id, a.balance_minor, a.held_minor
         FROM ledger.holds h JOIN ledger.accounts a ON a.id = h.account_id WHERE h.id = $1{}",
        if for_update { " FOR UPDATE OF h" } else { "" }
    );
    let r = sqlx::query(&sql)
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
    Ok(HoldView {
        id: r.try_get("hid")?,
        account: account_from_row(&r)?,
        amount_minor: r.try_get("hamount")?,
        status: HoldStatus::parse(r.try_get::<String, _>("status")?.as_str()),
        reference_type: r.try_get("reference_type")?,
        reference_id: r.try_get("reference_id")?,
        expires_at: r.try_get("expires_at")?,
        created_at: r.try_get("hcreated")?,
        captured_transaction_id: r.try_get("captured_transaction_id")?,
    })
}

async fn hold_event(
    tx: &mut Transaction<'static, Postgres>,
    hold_id: Uuid,
    status: HoldStatus,
) -> Result<(), StoreError> {
    let h = load_hold(tx, hold_id, false).await?;
    let payload = json!({
        "hold_id": h.id.to_string(),
        "status": match status { HoldStatus::Active => 1, HoldStatus::Captured => 2, HoldStatus::Released => 3, HoldStatus::Expired => 4 },
        "account": {"party_id": h.account.party_id, "type": h.account.account_type.code(), "currency": h.account.currency, "scope_id": h.account.scope_id},
        "amount_minor": h.amount_minor.to_string(),
    });
    sqlx::query("INSERT INTO ledger.outbox (id, aggregate_type, aggregate_id, event_type, payload) VALUES ($1, 'hold', $2, 'pp.ledger.hold.status_changed.v1', $3)")
        .bind(Uuid::now_v7())
        .bind(h.id.to_string())
        .bind(payload)
        .execute(tx.as_mut())
        .await?;
    Ok(())
}

fn account_from_row(r: &PgRow) -> Result<AccountView, StoreError> {
    let party: Uuid = r.try_get("party_id")?;
    Ok(AccountView {
        id: r.try_get("id")?,
        party_id: party.to_string(),
        account_type: AccountType::from_i32(i32::from(r.try_get::<i16, _>("account_type")?))?,
        currency: r.try_get::<String, _>("currency")?.trim().to_string(),
        scope_id: r.try_get("scope_id")?,
        balance_minor: r.try_get("balance_minor")?,
        held_minor: r.try_get("held_minor")?,
    })
}

fn transaction_from_row(r: &PgRow) -> Result<TransactionView, StoreError> {
    Ok(TransactionView {
        id: r.try_get("id")?,
        tenant_id: r.try_get("tenant_id")?,
        transaction_type: r.try_get("transaction_type")?,
        reference_type: r.try_get("reference_type")?,
        reference_id: r.try_get("reference_id")?,
        currency: r.try_get::<String, _>("currency")?.trim().to_string(),
        description: r.try_get("description")?,
        reversed: r.try_get::<String, _>("status")? == "REVERSED",
        reversal_of: r.try_get("reversal_of")?,
        effective_at: r.try_get("effective_at")?,
        posted_at: r.try_get("posted_at")?,
        entries: Vec::new(),
    })
}

pub fn parse_party(s: &str) -> Result<Uuid, StoreError> {
    Uuid::parse_str(s).map_err(|_| StoreError::Domain(DomainError::InvalidParty))
}

/// Violación de unicidad: una segunda captura del mismo pago (R5) o una carrera con la misma clave.
fn map_unique(e: sqlx::Error) -> StoreError {
    if let sqlx::Error::Database(db) = &e {
        match db.constraint() {
            Some("one_capture_per_payment") => return StoreError::DuplicateCapture,
            Some("transactions_idempotency_key_key") => return StoreError::IdempotencyKeyReused,
            Some("transactions_reversal_of_key") => return StoreError::AlreadyReversed,
            _ => {}
        }
    }
    StoreError::Db(e)
}
