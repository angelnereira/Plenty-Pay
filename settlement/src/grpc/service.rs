//! Implementación de `plentypay.settlement.v1.Settlement` sobre el servicio. Sin reglas de negocio.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use tonic::{Code, Request, Response, Status};
use uuid::Uuid;

use super::context::actor;
use super::errors::{status, to_status};
use crate::domain::{BatchStatus, Line};
use crate::pb;
use crate::service::{DestinationInput, ScheduleInput, ScheduleView, Settlement};
use crate::store::BatchRow;

type R<T> = Result<Response<T>, Status>;

pub struct SettlementService {
    core: Arc<Settlement>,
}

impl SettlementService {
    pub fn new(core: Arc<Settlement>) -> Self {
        Self { core }
    }
}

fn ts(t: DateTime<Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp {
        seconds: t.timestamp(),
        nanos: i32::try_from(t.timestamp_subsec_nanos()).unwrap_or(0),
    }
}

fn money(amount_minor: i64, currency: &str) -> Option<pb::Money> {
    Some(pb::Money {
        amount_minor,
        currency: currency.to_string(),
    })
}

fn uuid(s: &str) -> Result<Uuid, Status> {
    Uuid::parse_str(s).map_err(|_| {
        status(
            Code::InvalidArgument,
            "INVALID_ARGUMENT",
            "identificador inválido",
        )
    })
}

fn schedule_pb(v: &ScheduleView) -> pb::PayoutSchedule {
    let r = &v.row;
    pb::PayoutSchedule {
        tenant_id: r.tenant_id.to_string(),
        frequency: i32::from(r.frequency),
        weekday: i32::from(r.weekday),
        minimum_payout_minor: r.minimum_payout_minor,
        payout_rail: 0,
        payout_destination_ref: String::new(),
        destination_kind: r.destination_kind.clone(),
        destination_bank: r.destination_bank.clone(),
        destination_account_type: r.destination_account_type.clone(),
        destination_last4: r.destination_last4.clone(),
        destination_holder: r.destination_holder.clone(),
        payouts_blocked_until: r.payouts_blocked_until.map(ts),
        hold_days: i32::from(r.hold_days),
        configured: v.configured,
    }
}

fn item_pb(l: &Line, currency: &str) -> pb::SettlementItem {
    pb::SettlementItem {
        kind: l.kind.label().to_string(),
        reference: Some(pb::Reference {
            r#type: l.reference_type.clone(),
            id: l.reference_id.clone(),
        }),
        amount: money(l.amount_minor, currency),
        occurred_at: Some(ts(l.occurred_at)),
    }
}

fn batch_pb(b: &BatchRow, items: &[Line]) -> pb::SettlementBatch {
    pb::SettlementBatch {
        batch_id: b.id.to_string(),
        tenant_id: b.tenant_id.to_string(),
        status: i32::from(b.status.code()),
        gross: money(b.gross_minor, &b.currency),
        commission: None,
        tax: None,
        net_payout: money(b.net_minor, &b.currency),
        period: Some(pb::TimeRange {
            from: Some(ts(b.period_start)),
            to: Some(ts(b.period_end)),
        }),
        payout_external_ref: b.payout_external_ref.clone(),
        ledger_transaction_id: b
            .ledger_transaction_id
            .map(|t| t.to_string())
            .unwrap_or_default(),
        created_at: Some(ts(b.created_at)),
        paid_at: b.paid_at.map(ts),
        sandbox: b.sandbox,
        destination_kind: b.destination_kind.clone(),
        refunds: money(b.refunds_minor, &b.currency),
        failure_reason: b.failure_reason.clone(),
        items: items.iter().map(|l| item_pb(l, &b.currency)).collect(),
        item_count: i32::try_from(b.item_count).unwrap_or(i32::MAX),
        destination_last4: b.destination_last4.clone(),
    }
}

/// Cursor opaco «microsegundos_uuid» del último lote de la página.
fn cursor_of(b: &BatchRow) -> String {
    format!("{}_{}", b.created_at.timestamp_micros(), b.id)
}

fn parse_cursor(s: &str) -> Result<Option<(DateTime<Utc>, Uuid)>, Status> {
    if s.is_empty() {
        return Ok(None);
    }
    let bad = || {
        status(
            Code::InvalidArgument,
            "INVALID_ARGUMENT",
            "page_token inválido",
        )
    };
    let (micros, id) = s.split_once('_').ok_or_else(bad)?;
    let micros: i64 = micros.parse().map_err(|_| bad())?;
    let at = DateTime::from_timestamp_micros(micros).ok_or_else(bad)?;
    Ok(Some((at, Uuid::parse_str(id).map_err(|_| bad())?)))
}

fn not_ready(what: &str) -> Status {
    status(
        Code::Unimplemented,
        "NOT_READY",
        &format!("{what}: la conciliación con extractos llega en F12.5–F12.6"),
    )
}

#[tonic::async_trait]
impl pb::settlement_server::Settlement for SettlementService {
    #[tracing::instrument(skip_all, fields(rpc = "GetPayoutSchedule"))]
    async fn get_payout_schedule(
        &self,
        request: Request<pb::GetPayoutScheduleRequest>,
    ) -> R<pb::PayoutSchedule> {
        let a = actor(request.metadata());
        let v = self
            .core
            .get_schedule(&a)
            .await
            .map_err(|e| to_status(e, "GetPayoutSchedule", &a.request_id))?;
        Ok(Response::new(schedule_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "SetPayoutSchedule"))]
    async fn set_payout_schedule(
        &self,
        request: Request<pb::SetPayoutScheduleRequest>,
    ) -> R<pb::PayoutSchedule> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let s = req.schedule.unwrap_or_default();
        let input = ScheduleInput {
            frequency: s.frequency,
            weekday: s.weekday,
            minimum_payout_minor: s.minimum_payout_minor,
            destination: req
                .destination
                .filter(|d| !d.kind.is_empty())
                .map(|d| DestinationInput {
                    kind: d.kind,
                    bank: d.bank,
                    account_type: d.account_type,
                    account_number: d.account_number,
                    holder: d.holder_name,
                }),
            step_up_token: req.step_up_token,
            idempotency_key: req.idempotency_key,
        };
        let v = self
            .core
            .set_schedule(&a, input)
            .await
            .map_err(|e| to_status(e, "SetPayoutSchedule", &a.request_id))?;
        Ok(Response::new(schedule_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "CreateBatch"))]
    async fn create_batch(
        &self,
        request: Request<pb::CreateBatchRequest>,
    ) -> R<pb::SettlementBatch> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let b = self
            .core
            .create_batch(&a, req.idempotency_key.trim())
            .await
            .map_err(|e| to_status(e, "CreateBatch", &a.request_id))?;
        Ok(Response::new(batch_pb(&b, &[])))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetBatch"))]
    async fn get_batch(&self, request: Request<pb::GetBatchRequest>) -> R<pb::SettlementBatch> {
        let a = actor(request.metadata());
        let id = uuid(&request.get_ref().batch_id)?;
        let (b, items) = self
            .core
            .get_batch(&a, id)
            .await
            .map_err(|e| to_status(e, "GetBatch", &a.request_id))?;
        Ok(Response::new(batch_pb(&b, &items)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListBatches"))]
    async fn list_batches(
        &self,
        request: Request<pb::ListBatchesRequest>,
    ) -> R<pb::ListBatchesResponse> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let page = req.page.unwrap_or_default();
        let limit = if page.page_size <= 0 {
            50
        } else {
            i64::from(page.page_size)
        };
        let status_filter = match req.status {
            0 => None,
            c => Some(
                i16::try_from(c)
                    .ok()
                    .and_then(BatchStatus::from_code)
                    .ok_or_else(|| {
                        status(Code::InvalidArgument, "INVALID_ARGUMENT", "estado inválido")
                    })?,
            ),
        };
        let before = parse_cursor(&page.page_token)?;
        let rows = self
            .core
            .list_batches(&a, status_filter, limit, before)
            .await
            .map_err(|e| to_status(e, "ListBatches", &a.request_id))?;
        let next = if i64::try_from(rows.len()).unwrap_or(0) >= limit.clamp(1, 200) {
            rows.last().map(cursor_of).unwrap_or_default()
        } else {
            String::new()
        };
        Ok(Response::new(pb::ListBatchesResponse {
            batches: rows.iter().map(|b| batch_pb(b, &[])).collect(),
            page: Some(pb::PageInfo {
                next_page_token: next,
            }),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ConfirmPayout"))]
    async fn confirm_payout(
        &self,
        request: Request<pb::ConfirmPayoutRequest>,
    ) -> R<pb::SettlementBatch> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let id = uuid(&req.batch_id)?;
        let b = self
            .core
            .confirm_payout(&a, id, &req.payout_external_ref)
            .await
            .map_err(|e| to_status(e, "ConfirmPayout", &a.request_id))?;
        Ok(Response::new(batch_pb(&b, &[])))
    }

    #[tracing::instrument(skip_all, fields(rpc = "FailPayout"))]
    async fn fail_payout(&self, request: Request<pb::FailPayoutRequest>) -> R<pb::SettlementBatch> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let id = uuid(&req.batch_id)?;
        let b = self
            .core
            .fail_payout(&a, id, &req.reason)
            .await
            .map_err(|e| to_status(e, "FailPayout", &a.request_id))?;
        Ok(Response::new(batch_pb(&b, &[])))
    }

    async fn import_rail_statement(
        &self,
        _request: Request<pb::ImportRailStatementRequest>,
    ) -> R<pb::ReconciliationReport> {
        Err(not_ready("ImportRailStatement"))
    }

    async fn get_reconciliation_report(
        &self,
        _request: Request<pb::GetReconciliationReportRequest>,
    ) -> R<pb::ReconciliationReport> {
        Err(not_ready("GetReconciliationReport"))
    }

    async fn list_reconciliation_exceptions(
        &self,
        _request: Request<pb::ListReconciliationExceptionsRequest>,
    ) -> R<pb::ListReconciliationExceptionsResponse> {
        Err(not_ready("ListReconciliationExceptions"))
    }

    async fn resolve_exception(
        &self,
        _request: Request<pb::ResolveExceptionRequest>,
    ) -> R<pb::ReconciliationItem> {
        Err(not_ready("ResolveException"))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetPayoutSummary"))]
    async fn get_payout_summary(
        &self,
        request: Request<pb::GetPayoutSummaryRequest>,
    ) -> R<pb::PayoutSummary> {
        let a = actor(request.metadata());
        let s = self
            .core
            .summary(&a)
            .await
            .map_err(|e| to_status(e, "GetPayoutSummary", &a.request_id))?;
        Ok(Response::new(pb::PayoutSummary {
            pending: money(s.pending_minor, crate::service::CURRENCY),
            in_processing: money(s.processing_minor, crate::service::CURRENCY),
            next_payout_at: s.next_payout_at.map(ts),
        }))
    }
}
