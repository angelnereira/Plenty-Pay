//! Reembolsos por split (F11.6, R11, domain-model §4.4). La transacción que crea el reembolso
//! bloquea el pago, suma lo ya reembolsado de ese comercio (PENDING y SUCCEEDED) y congela el
//! reverso de comisiones: dos reembolsos concurrentes nunca superan lo capturado.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use super::{
    load_intent_tx, lock_payment, outbox, PaymentRow, PgPayments, Scope, SplitFees, StoreError,
};
use crate::domain::errors::DomainError;
use crate::domain::fees::{refund_split, FeeBreakdown};
use crate::domain::state::PaymentStatus;

/// Reverso congelado de comisiones del reembolso.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct FeeReversal {
    pub pf_r: i64,
    pub tax_r: i64,
    pub rf_r: i64,
    pub merchant_debit: i64,
}

/// Estados del reembolso (payments.proto RefundStatus).
pub const REFUND_PENDING: i16 = 1;
pub const REFUND_SUCCEEDED: i16 = 2;
pub const REFUND_FAILED: i16 = 3;

#[derive(Debug, Clone)]
pub struct RefundRow {
    pub id: Uuid,
    pub payment_id: Uuid,
    pub merchant_party_id: Uuid,
    pub amount_minor: i64,
    pub payer_credit_minor: i64,
    pub status: i16,
    pub reason: String,
    pub fee_reversal: FeeReversal,
    pub ledger_transaction_id: Option<Uuid>,
    pub failure_code: String,
    pub created_at: DateTime<Utc>,
}

/// Lo que se pide reembolsar.
pub struct NewRefund<'a> {
    pub payment_id: Uuid,
    /// Split a reembolsar; `None` solo si el pago tiene un único comercio.
    pub merchant_party_id: Option<Uuid>,
    /// 0 = el remanente completo del split.
    pub amount_minor: i64,
    pub reason: &'a str,
    pub idempotency_key: &'a str,
    pub created_by: Option<Uuid>,
}

/// El pago y el split del reembolso, para armar el asiento T7.
#[derive(Debug, Clone)]
pub struct RefundContext {
    pub refund: RefundRow,
    pub payment: PaymentRow,
    pub split: SplitFees,
    pub created: bool,
}

/// Fallos propios de crear un reembolso.
#[derive(Debug, thiserror::Error)]
pub enum RefundError {
    #[error("payment not captured")]
    NotCaptured,
    #[error("refund needs the merchant split")]
    SplitRequired,
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    Store(#[from] StoreError),
}

impl From<sqlx::Error> for RefundError {
    fn from(e: sqlx::Error) -> Self {
        RefundError::Store(StoreError::Db(e))
    }
}

const REFUND_COLS: &str = "id, payment_id, merchant_party_id, amount_minor, payer_credit_minor, status, coalesce(reason, '') AS reason, fee_reversal, ledger_transaction_id, coalesce(failure_code, '') AS failure_code, created_at";

fn row_to_refund(r: &sqlx::postgres::PgRow) -> Result<RefundRow, StoreError> {
    let rev: serde_json::Value = r.try_get("fee_reversal")?;
    Ok(RefundRow {
        id: r.try_get("id")?,
        payment_id: r.try_get("payment_id")?,
        merchant_party_id: r.try_get("merchant_party_id")?,
        amount_minor: r.try_get("amount_minor")?,
        payer_credit_minor: r.try_get("payer_credit_minor")?,
        status: r.try_get("status")?,
        reason: r.try_get("reason")?,
        fee_reversal: serde_json::from_value(rev)?,
        ledger_transaction_id: r.try_get("ledger_transaction_id")?,
        failure_code: r.try_get("failure_code")?,
        created_at: r.try_get("created_at")?,
    })
}

impl PgPayments {
    /// Crea el reembolso PENDING (o devuelve el de la misma clave). La clave es única por comercio.
    pub async fn create_refund(
        &self,
        cmd: NewRefund<'_>,
        lease: Duration,
    ) -> Result<RefundContext, RefundError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let payment = lock_payment(&mut tx, cmd.payment_id).await?;
        if payment.status != PaymentStatus::Captured {
            return Err(RefundError::NotCaptured);
        }
        let fees = payment
            .fees
            .clone()
            .ok_or(StoreError::Corrupt("captured payment without fees"))?;
        let split = match cmd.merchant_party_id {
            Some(m) => fees
                .splits
                .iter()
                .find(|s| s.merchant_party_id == m)
                .cloned(),
            None if fees.splits.len() == 1 => fees.splits.first().cloned(),
            None => None,
        }
        .ok_or(RefundError::SplitRequired)?;

        // R1: misma clave + mismo contenido = el reembolso original; otro contenido = error.
        if let Some(r) = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE tenant_id = $1 AND idempotency_key = $2"
        ))
        .bind(split.merchant_party_id)
        .bind(cmd.idempotency_key)
        .fetch_optional(tx.as_mut())
        .await?
        {
            let existing = row_to_refund(&r)?;
            if existing.payment_id != cmd.payment_id
                || (cmd.amount_minor != 0 && existing.amount_minor != cmd.amount_minor)
            {
                return Err(StoreError::IdempotencyKeyReused.into());
            }
            tx.commit().await?;
            return Ok(RefundContext { refund: existing, payment, split, created: false });
        }

        // Lo ya reembolsado (o en curso) de este split.
        let prev = sqlx::query(
            "SELECT coalesce(sum(amount_minor), 0)::bigint AS amount, \
             coalesce(sum((fee_reversal->>'pf_r')::bigint), 0)::bigint AS pf, \
             coalesce(sum((fee_reversal->>'tax_r')::bigint), 0)::bigint AS tax, \
             coalesce(sum((fee_reversal->>'rf_r')::bigint), 0)::bigint AS rf \
             FROM payments.refunds WHERE payment_id = $1 AND merchant_party_id = $2 AND status IN (1, 2)",
        )
        .bind(cmd.payment_id)
        .bind(split.merchant_party_id)
        .fetch_one(tx.as_mut())
        .await?;
        let (prev_amount, prev_pf, prev_tax, prev_rf): (i64, i64, i64, i64) = (
            prev.try_get("amount")?,
            prev.try_get("pf")?,
            prev.try_get("tax")?,
            prev.try_get("rf")?,
        );
        let amount = if cmd.amount_minor == 0 {
            split
                .gross_minor
                .checked_sub(prev_amount)
                .ok_or(DomainError::Overflow)?
        } else {
            cmd.amount_minor
        };
        let refundable: bool = sqlx::query_scalar(
            "SELECT rail_fee_refundable FROM payments.fee_policies WHERE id = $1",
        )
        .bind(fees.fee_policy_id)
        .fetch_optional(tx.as_mut())
        .await?
        .unwrap_or(false);
        let captured = FeeBreakdown {
            gross_minor: split.gross_minor,
            platform_fee_minor: split.platform_fee_minor,
            tax_minor: split.tax_minor,
            rail_fee_minor: split.rail_fee_minor,
            merchant_net_minor: split.merchant_net_minor,
            total_charged_minor: split.total_charged_minor,
        };
        let rs = refund_split(
            &captured,
            amount,
            prev_amount,
            (prev_pf, prev_tax, prev_rf),
            refundable,
        )?;
        // Portador CUSTOMER (pagó comisión e impuesto encima del precio): se le devuelven también.
        let customer_bears = split.total_charged_minor > split.gross_minor;
        let (payer_credit, merchant_debit) = if customer_bears {
            (
                amount
                    .checked_add(rs.pf_r)
                    .and_then(|v| v.checked_add(rs.tax_r))
                    .ok_or(DomainError::Overflow)?,
                amount.checked_sub(rs.rf_r).ok_or(DomainError::Overflow)?,
            )
        } else {
            (amount, rs.merchant_debit)
        };
        let reversal = FeeReversal {
            pf_r: rs.pf_r,
            tax_r: rs.tax_r,
            rf_r: rs.rf_r,
            merchant_debit,
        };
        let id = Uuid::now_v7();
        let r = sqlx::query(&format!(
            "INSERT INTO payments.refunds (id, payment_id, tenant_id, merchant_party_id, amount_minor, payer_credit_minor, \
             status, reason, fee_reversal, idempotency_key, created_by, next_check_at) \
             VALUES ($1, $2, $3, $3, $4, $5, 1, $6, $7, $8, $9, now() + $10) RETURNING {REFUND_COLS}"
        ))
        .bind(id)
        .bind(cmd.payment_id)
        .bind(split.merchant_party_id)
        .bind(amount)
        .bind(payer_credit)
        .bind(cmd.reason)
        .bind(serde_json::to_value(reversal).map_err(StoreError::Json)?)
        .bind(cmd.idempotency_key)
        .bind(cmd.created_by)
        .bind(lease)
        .fetch_one(tx.as_mut())
        .await?;
        let refund = row_to_refund(&r)?;
        tx.commit().await?;
        Ok(RefundContext {
            refund,
            payment,
            split,
            created: true,
        })
    }

    /// Reembolso ya creado con esta clave para el comercio (R1: un reintento no gasta otro step-up).
    pub async fn refund_by_key(
        &self,
        merchant: Uuid,
        key: &str,
    ) -> Result<Option<RefundRow>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE tenant_id = $1 AND idempotency_key = $2"
        ))
        .bind(merchant)
        .bind(key)
        .fetch_optional(tx.as_mut())
        .await?;
        let out = r.map(|r| row_to_refund(&r)).transpose()?;
        tx.commit().await?;
        Ok(out)
    }

    /// T7 asentado: reembolso SUCCEEDED, `refunded_minor` del pago crece y outbox `RefundSucceeded`
    /// en la misma transacción.
    pub async fn refund_succeeded(
        &self,
        id: Uuid,
        ledger_transaction_id: Uuid,
    ) -> Result<RefundRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE id = $1 FOR UPDATE"
        ))
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
        let refund = row_to_refund(&r)?;
        if refund.status != REFUND_PENDING {
            tx.commit().await?;
            return Ok(refund);
        }
        let payment = lock_payment(&mut tx, refund.payment_id).await?;
        sqlx::query("UPDATE payments.refunds SET status = 2, ledger_transaction_id = $2, next_check_at = NULL, updated_at = now() WHERE id = $1")
            .bind(id)
            .bind(ledger_transaction_id)
            .execute(tx.as_mut())
            .await?;
        sqlx::query("UPDATE payments.payments SET refunded_minor = refunded_minor + $2, updated_at = now(), version = version + 1 WHERE id = $1")
            .bind(refund.payment_id)
            .bind(refund.amount_minor)
            .execute(tx.as_mut())
            .await?;
        let intent = load_intent_tx(&mut tx, payment.intent_id).await?;
        let split_ref = intent
            .splits
            .iter()
            .find(|s| {
                s.merchant_party_id == refund.merchant_party_id && !s.reference_type.is_empty()
            })
            .map(|s| (s.reference_type.clone(), s.reference_id.clone()))
            .unwrap_or((intent.reference_type.clone(), intent.reference_id.clone()));
        outbox(
            &mut tx,
            refund.payment_id,
            "pp.payments.refund.succeeded.v1",
            refund.merchant_party_id,
            json!({
                "refund_id": refund.id,
                "payment_id": refund.payment_id,
                "tenant_id": refund.merchant_party_id,
                "amount_minor": refund.amount_minor.to_string(),
                "currency": payment.currency,
                "reference_type": split_ref.0,
                "reference_id": split_ref.1,
            }),
        )
        .await?;
        let r = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE id = $1"
        ))
        .bind(id)
        .fetch_one(tx.as_mut())
        .await?;
        let out = row_to_refund(&r)?;
        tx.commit().await?;
        Ok(out)
    }

    /// Rechazo definitivo del asiento (p. ej. el comercio no tiene saldo): FAILED con su código.
    pub async fn refund_failed(&self, id: Uuid, code: &str) -> Result<RefundRow, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(&format!(
            "UPDATE payments.refunds SET status = 3, failure_code = $2, next_check_at = NULL, updated_at = now() \
             WHERE id = $1 AND status = 1 RETURNING {REFUND_COLS}"
        ))
        .bind(id)
        .bind(code)
        .fetch_optional(tx.as_mut())
        .await?;
        let out = match r {
            Some(r) => row_to_refund(&r)?,
            None => {
                let r = sqlx::query(&format!(
                    "SELECT {REFUND_COLS} FROM payments.refunds WHERE id = $1"
                ))
                .bind(id)
                .fetch_optional(tx.as_mut())
                .await?
                .ok_or(StoreError::NotFound)?;
                row_to_refund(&r)?
            }
        };
        tx.commit().await?;
        Ok(out)
    }

    /// Reembolsos PENDING cuyo turno venció; los arrienda (`next_check_at`) para que solo un
    /// proceso los conduzca.
    pub async fn due_refunds(&self, limit: i64, lease: Duration) -> Result<Vec<Uuid>, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let ids: Vec<Uuid> = sqlx::query_scalar(
            "UPDATE payments.refunds SET next_check_at = now() + $2 WHERE id IN (\
             SELECT id FROM payments.refunds WHERE status = 1 AND next_check_at <= now() \
             ORDER BY next_check_at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING id",
        )
        .bind(limit)
        .bind(lease)
        .fetch_all(tx.as_mut())
        .await?;
        tx.commit().await?;
        Ok(ids)
    }

    /// Contexto de un reembolso existente (para retomarlo).
    pub async fn refund_context(&self, id: Uuid) -> Result<RefundContext, StoreError> {
        let mut tx = self.begin(&Scope::service()).await?;
        let r = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE id = $1"
        ))
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
        let refund = row_to_refund(&r)?;
        let payment = super::load_payment(&mut tx, refund.payment_id).await?;
        let split = payment
            .fees
            .as_ref()
            .and_then(|f| {
                f.splits
                    .iter()
                    .find(|s| s.merchant_party_id == refund.merchant_party_id)
                    .cloned()
            })
            .ok_or(StoreError::Corrupt("refund without split"))?;
        tx.commit().await?;
        Ok(RefundContext {
            refund,
            payment,
            split,
            created: false,
        })
    }

    /// Lectura de un reembolso con la RLS del lector (`tenant_id` = comercio del split).
    pub async fn refund(&self, scope: &Scope, id: Uuid) -> Result<RefundRow, StoreError> {
        let mut tx = self.begin(scope).await?;
        let r = sqlx::query(&format!(
            "SELECT {REFUND_COLS} FROM payments.refunds WHERE id = $1"
        ))
        .bind(id)
        .fetch_optional(tx.as_mut())
        .await?
        .ok_or(StoreError::NotFound)?;
        let out = row_to_refund(&r)?;
        tx.commit().await?;
        Ok(out)
    }
}
