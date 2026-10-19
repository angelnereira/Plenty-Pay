#![allow(clippy::arithmetic_side_effects)]
use crate::pb;
use crate::pb::ledger_server::Ledger;
use crate::pb::EntrySide;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

pub struct LedgerService {
    pub pool: PgPool,
    pub account_cache: std::sync::Mutex<std::collections::HashMap<String, uuid::Uuid>>,
}

impl LedgerService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool, account_cache: std::sync::Mutex::new(std::collections::HashMap::new()) }
    }
}

#[tonic::async_trait]
impl Ledger for LedgerService {
    async fn post_transaction(
        &self,
        request: Request<pb::PostTransactionRequest>,
    ) -> Result<Response<pb::Transaction>, Status> {
        let req = request.into_inner();
        let mut d: i64 = 0;
        let mut c: i64 = 0;
        for e in &req.entries {
            if e.amount_minor <= 0 {
                return Err(Status::invalid_argument("amount must be > 0"));
            }
            match e.side {
                x if x == EntrySide::Debit as i32 => d = d.saturating_add(e.amount_minor),
                x if x == EntrySide::Credit as i32 => c = c.saturating_add(e.amount_minor),
                _ => return Err(Status::invalid_argument("invalid side")),
            }
        }
        if req.entries.len() < 2 {
            return Err(Status::invalid_argument("at least 2 entries"));
        }
        if d != c {
            return Err(Status::failed_precondition("unbalanced"));
        }
        let tx_id = Uuid::new_v4();
        let currency = req.currency.clone();
        let mut dbtx = self.pool.begin().await.map_err(|e| Status::internal(e.to_string()))?;

        sqlx::query(
            "INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,now())",
        )
        .bind(tx_id)
        .bind(&req.transaction_type)
        .bind(req.reference.as_ref().map(|r| r.r#type.clone()).unwrap_or_default())
        .bind(req.reference.as_ref().map(|r| r.id.clone()).unwrap_or_default())
        .bind(&currency)
        .bind(&req.idempotency_key)
        .bind(Vec::<u8>::new())
        .execute(dbtx.as_mut())
        .await
        .map_err(|e| Status::internal(e.to_string()))?;

        for e in &req.entries {
            let entry_id = Uuid::new_v4();
            let acc = e.account.as_ref().ok_or_else(|| Status::invalid_argument("account required"))?;
            // resolve account
            let cache_key = format!("{}:{}:{}:{}", acc.party_id, acc.r#type, acc.currency, acc.scope_id);
            let cached = self.account_cache.lock().unwrap().get(&cache_key).copied();
            let account_id = if let Some(id) = cached {
                id
            } else {
                let new_id = Uuid::new_v4();
                let row: (Uuid,) = sqlx::query_as(
                    "INSERT INTO ledger.accounts (id, party_id, account_type, currency, scope_id) VALUES ($1,$2::uuid,$3,$4,$5) ON CONFLICT (party_id, account_type, currency, scope_id) DO UPDATE SET id = ledger.accounts.id RETURNING id",
                )
                .bind(new_id)
                .bind(Uuid::parse_str(&acc.party_id).unwrap_or(Uuid::nil()))
                .bind(acc.r#type as i16)
                .bind(&acc.currency)
                .bind(&acc.scope_id)
                .fetch_one(dbtx.as_mut())
                .await
                .map_err(|e| Status::internal(e.to_string()))?;
                let id = row.0;
                self.account_cache.lock().unwrap().insert(cache_key, id);
                id
            };
            let side_str = if e.side == EntrySide::Debit as i32 { "D" } else { "C" };
            sqlx::query(
                "INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,$4,$5,$6)",
            )
            .bind(entry_id)
            .bind(tx_id)
            .bind(account_id)
            .bind(side_str)
            .bind(e.amount_minor)
            .bind(&currency)
            .execute(dbtx.as_mut())
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        }

        sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1")
            .bind(tx_id)
            .execute(dbtx.as_mut())
            .await
            .map_err(|e| Status::failed_precondition(e.to_string()))?;

        // Outbox: TransactionPosted (ADR 0012). Same transaction => exactly-once semantics.
        sqlx::query("INSERT INTO ledger.outbox (id, aggregate_type, aggregate_id, event_type, payload) VALUES ($1,'transaction',$2,'TransactionPosted',$3::jsonb)")
            .bind(Uuid::new_v4())
            .bind(tx_id.to_string())
            .bind(serde_json::json!({"transaction_id": tx_id.to_string()}).to_string())
            .execute(dbtx.as_mut())
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        dbtx.commit().await.map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(pb::Transaction {
            transaction_id: tx_id.to_string(),
            currency,
            status: pb::TransactionStatus::Posted as i32,
            ..Default::default()
        }))
    }

    async fn reverse_transaction(
        &self,
        request: Request<pb::ReverseTransactionRequest>,
    ) -> Result<Response<pb::Transaction>, Status> {
        let req = request.into_inner();
        let orig_id = Uuid::parse_str(&req.transaction_id).map_err(|_| Status::invalid_argument("bad id"))?;
        let rev_id = Uuid::new_v4();
        let mut dbtx = self.pool.begin().await.map_err(|e| Status::internal(e.to_string()))?;
        sqlx::query("UPDATE ledger.transactions SET status='REVERSED' WHERE id=$1 AND status='POSTED'")
            .bind(orig_id)
            .execute(dbtx.as_mut())
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        sqlx::query(
            "INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, reversal_of, idempotency_key, request_hash, effective_at) VALUES ($1,'REVERSAL','reversal',$2,'',$3,'DRAFT',$4,$5,now())",
        )
        .bind(rev_id)
        .bind(&req.transaction_id)
        .bind(orig_id)
        .bind(&req.idempotency_key)
        .bind(Vec::<u8>::new())
        .execute(dbtx.as_mut())
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1")
            .bind(rev_id)
            .execute(dbtx.as_mut())
            .await
            .map_err(|e| Status::failed_precondition(e.to_string()))?;
        dbtx.commit().await.map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Transaction {
            transaction_id: rev_id.to_string(),
            status: pb::TransactionStatus::Posted as i32,
            ..Default::default()
        }))
    }

    async fn get_transaction(&self, _: Request<pb::GetTransactionRequest>) -> Result<Response<pb::Transaction>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn list_transactions(&self, _: Request<pb::ListTransactionsRequest>) -> Result<Response<pb::ListTransactionsResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn get_balance(&self, request: Request<pb::GetBalanceRequest>) -> Result<Response<pb::Balance>, Status> {
        let req = request.into_inner();
        let account_ref = req.account.ok_or_else(|| Status::invalid_argument("account required"))?;
        // resolve account id
        let row: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM ledger.accounts WHERE party_id = $1::uuid AND account_type = $2 AND currency = $3 AND scope_id = $4",
        )
        .bind(&account_ref.party_id)
        .bind(account_ref.r#type as i16)
        .bind(&account_ref.currency)
        .bind(&account_ref.scope_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        let account_id = match row {
            Some((id,)) => id,
            None => return Err(Status::not_found("account not found")),
        };
        // posted = sum credits - sum debits for liability/income accounts? We use net: D - C (asset convention). Ledger stores signed balance per account class; here compute raw net = debits - credits.
        let (posted,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(CASE WHEN side='D' THEN amount_minor ELSE -amount_minor END),0) FROM ledger.entries WHERE account_id=$1",
        )
        .bind(account_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        let held: (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount_minor),0) FROM ledger.holds WHERE account_id=$1 AND status='ACTIVE'",
        )
        .bind(account_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Balance {
            account: Some(account_ref),
            posted_minor: posted,
            held_minor: held.0,
            available_minor: posted - held.0,
            ..Default::default()
        }))
    }
    async fn list_balances(&self, _: Request<pb::ListBalancesRequest>) -> Result<Response<pb::ListBalancesResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn get_statement(&self, request: Request<pb::GetStatementRequest>) -> Result<Response<pb::GetStatementResponse>, Status> {
        let _req = request.into_inner();
        Ok(Response::new(pb::GetStatementResponse {
            lines: Vec::new(),
            ..Default::default()
        }))
    }
    async fn create_hold(&self, request: Request<pb::CreateHoldRequest>) -> Result<Response<pb::Hold>, Status> {
        let req = request.into_inner();
        let hold_id = Uuid::new_v4();
        let account_ref = req.account.ok_or_else(|| Status::invalid_argument("account required"))?;
        let account_id: (Uuid,) = sqlx::query_as(
            "SELECT id FROM ledger.accounts WHERE party_id = $1::uuid AND account_type = $2 AND currency = $3 AND scope_id = $4",
        )
        .bind(&account_ref.party_id)
        .bind(account_ref.r#type as i16)
        .bind(&account_ref.currency)
        .bind(&account_ref.scope_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::not_found(e.to_string()))?;
        sqlx::query(
            "INSERT INTO ledger.holds (id, account_id, amount_minor, status, reference_type, reference_id, idempotency_key, expires_at) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6, now() + ($7 || ' seconds')::interval)",
        )
        .bind(hold_id)
        .bind(account_id.0)
        .bind(req.amount_minor)
        .bind(req.reference.as_ref().map(|r| r.r#type.clone()).unwrap_or_default())
        .bind(req.reference.as_ref().map(|r| r.id.clone()).unwrap_or_default())
        .bind(&req.idempotency_key)
        .bind(req.ttl_seconds)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Hold {
            hold_id: hold_id.to_string(),
            account: Some(account_ref),
            amount_minor: req.amount_minor,
            status: pb::HoldStatus::Active as i32,
            ..Default::default()
        }))
    }

    async fn capture_hold(&self, request: Request<pb::CaptureHoldRequest>) -> Result<Response<pb::CaptureHoldResponse>, Status> {
        let req = request.into_inner();
        let hold_id = Uuid::parse_str(&req.hold_id).map_err(|_| Status::invalid_argument("bad id"))?;
        sqlx::query("UPDATE ledger.holds SET status='CAPTURED', updated_at=now() WHERE id=$1 AND status='ACTIVE'")
            .bind(hold_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::CaptureHoldResponse { hold: None, transaction: None }))
    }
    async fn release_hold(&self, request: Request<pb::ReleaseHoldRequest>) -> Result<Response<pb::Hold>, Status> {
        let req = request.into_inner();
        let hold_id = Uuid::parse_str(&req.hold_id).map_err(|_| Status::invalid_argument("bad id"))?;
        sqlx::query("UPDATE ledger.holds SET status='RELEASED', updated_at=now() WHERE id=$1 AND status='ACTIVE'")
            .bind(hold_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Hold {
            hold_id: req.hold_id,
            status: pb::HoldStatus::Released as i32,
            ..Default::default()
        }))
    }
    async fn get_hold(&self, request: Request<pb::GetHoldRequest>) -> Result<Response<pb::Hold>, Status> {
        let req = request.into_inner();
        let hold_id = Uuid::parse_str(&req.hold_id).map_err(|_| Status::invalid_argument("bad id"))?;
        let row: (Uuid, i64, String) = sqlx::query_as(
            "SELECT id, amount_minor, status FROM ledger.holds WHERE id=$1",
        )
        .bind(hold_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::not_found(e.to_string()))?;
        let status = match row.2.as_str() {
            "ACTIVE" => pb::HoldStatus::Active as i32,
            "CAPTURED" => pb::HoldStatus::Captured as i32,
            "RELEASED" => pb::HoldStatus::Released as i32,
            "EXPIRED" => pb::HoldStatus::Expired as i32,
            _ => pb::HoldStatus::Unspecified as i32,
        };
        Ok(Response::new(pb::Hold {
            hold_id: row.0.to_string(),
            amount_minor: row.1,
            status,
            ..Default::default()
        }))
    }
}
