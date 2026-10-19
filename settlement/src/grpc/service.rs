use crate::pb;
use crate::pb::settlement_server::Settlement;
use sqlx::PgPool;
use uuid::Uuid;
use tonic::{Request, Response, Status};

pub struct SettlementService {
    pub pool: PgPool,
}

impl SettlementService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[tonic::async_trait]
impl Settlement for SettlementService {
    async fn get_payout_schedule(&self, request: Request<pb::GetPayoutScheduleRequest>) -> Result<Response<pb::PayoutSchedule>, Status> {
        let req = request.into_inner();
        let tenant_id = uuid::Uuid::parse_str(&req.tenant_id).map_err(|_| Status::invalid_argument("bad tenant"))?;
        let row: Option<(i16, i16, i64)> = sqlx::query_as(
            "SELECT frequency, COALESCE(weekday,0), minimum_payout_minor FROM settlement.payout_schedules WHERE tenant_id=$1",
        )
        .bind(tenant_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        match row {
            Some((freq, wd, min)) => Ok(Response::new(pb::PayoutSchedule {
                tenant_id: req.tenant_id,
                frequency: freq as i32,
                weekday: wd as i32,
                minimum_payout_minor: min,
                ..Default::default()
            })),
            None => Err(Status::not_found("NOT_FOUND")),
        }
    }
    async fn set_payout_schedule(&self, request: Request<pb::SetPayoutScheduleRequest>) -> Result<Response<pb::PayoutSchedule>, Status> {
        let req = request.into_inner();
        let sched = req.schedule.ok_or_else(|| Status::invalid_argument("schedule required"))?;
        let tenant_id = uuid::Uuid::parse_str(&sched.tenant_id).map_err(|_| Status::invalid_argument("bad tenant"))?;
        sqlx::query(
            "INSERT INTO settlement.payout_schedules (tenant_id, frequency, weekday, minimum_payout_minor, updated_at) VALUES ($1,$2,$3,$4,now()) ON CONFLICT (tenant_id) DO UPDATE SET frequency=$2, weekday=$3, minimum_payout_minor=$4, updated_at=now()",
        )
        .bind(tenant_id)
        .bind(sched.frequency as i16)
        .bind(sched.weekday as i16)
        .bind(sched.minimum_payout_minor)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        self.get_payout_schedule(Request::new(pb::GetPayoutScheduleRequest { tenant_id: sched.tenant_id })).await
    }
    async fn create_batch(&self, request: Request<pb::CreateBatchRequest>) -> Result<Response<pb::SettlementBatch>, Status> {
        let req = request.into_inner();
        let tenant_id = uuid::Uuid::parse_str(&req.tenant_id).map_err(|_| Status::invalid_argument("bad tenant"))?;
        let batch_id = Uuid::new_v4();
        // gather captured payments not yet settled
        let rows: Vec<(Uuid, i64)> = sqlx::query_as(
            "SELECT id, amount_minor FROM payments.payments WHERE tenant_id=$1 AND status=5 AND ledger_posting=2",
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        if rows.is_empty() {
            return Err(Status::failed_precondition("NOTHING_TO_SETTLE"));
        }
        let gross: i64 = rows.iter().map(|r| r.1).sum();
        let net = gross; // simplified: no fees/refunds subtraction
        sqlx::query(
            "INSERT INTO settlement.batches (id, tenant_id, status, currency, period_start, period_end, gross_minor, fees_minor, refunds_minor, net_minor, destination_kind, created_at, updated_at) VALUES ($1,$2,1,'USD',now(),now(),$3,0,0,$4,'BANK',now(),now())",
        )
        .bind(batch_id)
        .bind(tenant_id)
        .bind(gross)
        .bind(net)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        for (pid, amt) in &rows {
            let _ = sqlx::query("INSERT INTO settlement.batch_items (batch_id, payment_id, kind, amount_minor) VALUES ($1,$2,'PAYMENT',$3) ON CONFLICT (payment_id) DO NOTHING")
                .bind(batch_id).bind(pid).bind(amt).execute(&self.pool).await;
        }
        Ok(Response::new(pb::SettlementBatch {
            batch_id: batch_id.to_string(),
            tenant_id: req.tenant_id,
            status: 1,
            ..Default::default()
        }))
    }
    async fn get_batch(&self, _: Request<pb::GetBatchRequest>) -> Result<Response<pb::SettlementBatch>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn list_batches(&self, _: Request<pb::ListBatchesRequest>) -> Result<Response<pb::ListBatchesResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn confirm_payout(&self, request: Request<pb::ConfirmPayoutRequest>) -> Result<Response<pb::SettlementBatch>, Status> {
        let req = request.into_inner();
        let batch_id = uuid::Uuid::parse_str(&req.batch_id).map_err(|_| Status::invalid_argument("bad id"))?;
        sqlx::query("UPDATE settlement.batches SET status=2, updated_at=now() WHERE id=$1 AND status=1")
            .bind(batch_id).execute(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::SettlementBatch { batch_id: req.batch_id, status: 2, ..Default::default() }))
    }
    async fn fail_payout(&self, request: Request<pb::FailPayoutRequest>) -> Result<Response<pb::SettlementBatch>, Status> {
        let req = request.into_inner();
        let batch_id = uuid::Uuid::parse_str(&req.batch_id).map_err(|_| Status::invalid_argument("bad id"))?;
        sqlx::query("UPDATE settlement.batches SET status=3, failure_reason=$2, updated_at=now() WHERE id=$1 AND status=1")
            .bind(batch_id).bind(&req.reason).execute(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::SettlementBatch { batch_id: req.batch_id, status: 3, ..Default::default() }))
    }
    async fn import_rail_statement(&self, request: Request<pb::ImportRailStatementRequest>) -> Result<Response<pb::ReconciliationReport>, Status> {
        let req = request.into_inner();
        let stmt_id = Uuid::new_v4();
        let rail = req.rail as i16;
        // idempotency: if already imported, return error
        let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM settlement.rail_statements WHERE rail=$1 AND statement_date=$2::date")
            .bind(rail).bind(&req.statement_date).fetch_optional(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        if existing.is_some() {
            return Err(Status::already_exists("ALREADY_IMPORTED"));
        }
        sqlx::query("INSERT INTO settlement.rail_statements (id, rail, statement_date, object_key, imported_by) VALUES ($1,$2,$3::date,$4,$5)")
            .bind(stmt_id).bind(rail).bind(&req.statement_date).bind(&req.source_file_object_key).bind(Uuid::nil())
            .execute(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::ReconciliationReport { report_id: stmt_id.to_string(), statement_date: req.statement_date.clone(), ..Default::default() }))
    }
    async fn get_reconciliation_report(&self, request: Request<pb::GetReconciliationReportRequest>) -> Result<Response<pb::ReconciliationReport>, Status> {
        let req = request.into_inner();
        let items: Vec<(String, i32)> = sqlx::query_as("SELECT id::text, state FROM settlement.reconciliation_items LIMIT 100")
            .fetch_all(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        let mut pb_items = Vec::new();
        for (id, st) in items {
            pb_items.push(pb::ReconciliationItem { item_id: id, state: st, ..Default::default() });
        }
        Ok(Response::new(pb::ReconciliationReport {
            report_id: req.report_id,
            items: pb_items,
            ..Default::default()
        }))
    }
    async fn list_reconciliation_exceptions(&self, _: Request<pb::ListReconciliationExceptionsRequest>) -> Result<Response<pb::ListReconciliationExceptionsResponse>, Status> {
        let items: Vec<(String, i32)> = sqlx::query_as("SELECT id::text, state FROM settlement.reconciliation_items LIMIT 100")
            .fetch_all(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        let mut pb_items = Vec::new();
        for (id, st) in items {
            pb_items.push(pb::ReconciliationItem { item_id: id, state: st, ..Default::default() });
        }
        Ok(Response::new(pb::ListReconciliationExceptionsResponse { items: pb_items, ..Default::default() }))
    }
    async fn resolve_exception(&self, request: Request<pb::ResolveExceptionRequest>) -> Result<Response<pb::ReconciliationItem>, Status> {
        let req = request.into_inner();
        let id = uuid::Uuid::parse_str(&req.item_id).map_err(|_| Status::invalid_argument("bad id"))?;
        sqlx::query("UPDATE settlement.reconciliation_items SET state=2, resolution_note=$2, resolved_by=$3, resolved_at=now() WHERE id=$1")
            .bind(id).bind(&req.note).bind(uuid::Uuid::nil())
            .execute(&self.pool).await.map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::ReconciliationItem { item_id: req.item_id, state: 2, ..Default::default() }))
    }
}
