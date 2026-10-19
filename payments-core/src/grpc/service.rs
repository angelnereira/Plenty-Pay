#![allow(clippy::too_many_arguments, clippy::arithmetic_side_effects, clippy::indexing_slicing)]

use crate::pb;
use crate::pb::payments_server::Payments;
use sqlx::PgPool;
use tonic::{Request, Response, Status};
use uuid::Uuid;

pub struct PaymentsService {
    pub pool: PgPool,
}

impl PaymentsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}


fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

fn md5_simple(data: &[u8]) -> u64 {
    // simple hash for idempotency key derivation (not cryptographic)
    let mut h: u64 = 0xcbf29ce484222325;
    for b in data {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

#[tonic::async_trait]
impl Payments for PaymentsService {
    async fn create_payment_intent(&self, request: Request<pb::CreatePaymentIntentRequest>) -> Result<Response<pb::PaymentIntent>, Status> {
        let req = request.into_inner();
        let amount = req.amount.as_ref().map(|m| m.amount_minor).unwrap_or(0);
        let currency = req.amount.as_ref().map(|m| m.currency.clone()).unwrap_or_else(|| "USD".to_string());
        let intent_id = Uuid::new_v4();
        let expires_in = if req.expires_in_seconds > 0 { req.expires_in_seconds } else { 900 };
        sqlx::query(
            "INSERT INTO payments.intents (id, tenant_id, created_by, rail, status, idempotency_key, request_hash, expires_at) VALUES ($1,$2,$3,$4,1,$5,$6, now() + ($7 || ' seconds')::interval)",
        )
        .bind(intent_id)
        .bind(Uuid::parse_str(&req.payer_party_id).unwrap_or(Uuid::nil()))
        .bind(Uuid::parse_str(&req.payer_party_id).unwrap_or(Uuid::nil()))
        .bind(req.rail as i16)
        .bind(&req.idempotency_key)
        .bind(Vec::<u8>::new())
        .bind(expires_in)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::PaymentIntent {
            payment_intent_id: intent_id.to_string(),
            status: 1, // CREATED
            amount: Some(pb::Money { amount_minor: amount, currency }),
            ..Default::default()
        }))
    }
    async fn confirm_payment_intent(&self, request: Request<pb::ConfirmPaymentIntentRequest>) -> Result<Response<pb::PaymentIntent>, Status> {
        let req = request.into_inner();
        let intent_id = Uuid::parse_str(&req.payment_intent_id).map_err(|_| Status::invalid_argument("bad id"))?;
        // mark intent as processing
        sqlx::query("UPDATE payments.intents SET status=2, updated_at=now() WHERE id=$1 AND status=1")
            .bind(intent_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::PaymentIntent {
            payment_intent_id: req.payment_intent_id,
            status: 2,
            ..Default::default()
        }))
    }
    async fn cancel_payment_intent(&self, _: Request<pb::CancelPaymentIntentRequest>) -> Result<Response<pb::PaymentIntent>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn get_payment_intent(&self, _: Request<pb::GetPaymentIntentRequest>) -> Result<Response<pb::PaymentIntent>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn list_payments(&self, _: Request<pb::ListPaymentsRequest>) -> Result<Response<pb::ListPaymentsResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn get_payment(&self, _: Request<pb::GetPaymentRequest>) -> Result<Response<pb::Payment>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn refund_payment(&self, request: Request<pb::RefundPaymentRequest>) -> Result<Response<pb::Refund>, Status> {
        let req = request.into_inner();
        if req.step_up_token.is_empty() {
            return Err(Status::permission_denied("STEP_UP_REQUIRED"));
        }
        let refund_id = Uuid::new_v4();
        let payment_id = Uuid::parse_str(&req.payment_id).map_err(|_| Status::invalid_argument("bad payment_id"))?;
        // load payment
        let row: Option<(i64, i64, i64, String)> = sqlx::query_as(
            "SELECT amount_minor, captured_minor, refunded_minor, currency FROM payments.payments WHERE id=$1",
        )
        .bind(payment_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        let (amount, captured, refunded, currency) = row.ok_or_else(|| Status::not_found("payment not found"))?;
        let refund_amount = req.amount.as_ref().map(|m| m.amount_minor).unwrap_or(0);
        if refunded + refund_amount > captured {
            return Err(Status::failed_precondition("REFUND_EXCEEDS_CAPTURED"));
        }
        // fee reversal (T7): proportional to refund_amount/captured
        let pf_r = crate::domain::fee::FeeBreakdown::half_up_ratio(0, refund_amount, captured);
        let tax_r = crate::domain::fee::FeeBreakdown::half_up_ratio(0, refund_amount, captured);
        let rf_r = 0i64;
        let merchant_debit = refund_amount - pf_r - tax_r - rf_r;
        let _ = (amount, merchant_debit);
        sqlx::query(
            "INSERT INTO payments.refunds (id, payment_id, tenant_id, amount_minor, status, reason, fee_reversal, idempotency_key) VALUES ($1,$2,$3,$4,1,$5,$6,$7)",
        )
        .bind(refund_id)
        .bind(payment_id)
        .bind(Uuid::nil())
        .bind(refund_amount)
        .bind(&req.reason)
        .bind(serde_json::json!({"pf_r":pf_r,"tax_r":tax_r,"rf_r":rf_r,"merchant_debit":merchant_debit}))
        .bind(&req.idempotency_key)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        // update payment refunded_minor
        sqlx::query("UPDATE payments.payments SET refunded_minor = refunded_minor + $1, updated_at=now() WHERE id=$2")
            .bind(refund_amount)
            .bind(payment_id)
            .execute(&self.pool)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Refund {
            refund_id: refund_id.to_string(),
            payment_id: req.payment_id,
            amount: Some(pb::Money { amount_minor: refund_amount, currency }),
            ..Default::default()
        }))
    }
    async fn get_refund(&self, _: Request<pb::GetRefundRequest>) -> Result<Response<pb::Refund>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn create_terminal(&self, request: Request<pb::CreateTerminalRequest>) -> Result<Response<pb::Terminal>, Status> {
        let req = request.into_inner();
        let id = Uuid::new_v4();
        // generate a simple public_code (8+ chars)
        let code = format!("T{}", Uuid::new_v4().simple());
        sqlx::query("INSERT INTO payments.terminals (id, tenant_id, label, public_code, active) VALUES ($1,$2,$3,$4,true)")
            .bind(id)
            .bind(Uuid::nil())
            .bind(&req.label)
            .bind(&code)
            .execute(&self.pool)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::Terminal {
            terminal_id: id.to_string(),
            tenant_id: String::new(),
            label: req.label,
            public_code: code,
            active: true,
            ..Default::default()
        }))
    }
    async fn list_terminals(&self, _: Request<pb::ListTerminalsRequest>) -> Result<Response<pb::ListTerminalsResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn set_terminal_active(&self, _: Request<pb::SetTerminalActiveRequest>) -> Result<Response<pb::Terminal>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn resolve_terminal(&self, request: Request<pb::ResolveTerminalRequest>) -> Result<Response<pb::PublicTerminalInfo>, Status> {
        let req = request.into_inner();
        let row: Option<(String, bool)> = sqlx::query_as(
            "SELECT label, active FROM payments.terminals WHERE public_code=$1",
        )
        .bind(&req.public_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        match row {
            Some((label, active)) => {
                if !active {
                    return Err(Status::failed_precondition("TERMINAL_INACTIVE"));
                }
                Ok(Response::new(pb::PublicTerminalInfo {
                    public_code: req.public_code,
                    merchant_name: label,
                    active,
                    ..Default::default()
                }))
            }
            None => Err(Status::not_found("NOT_FOUND")),
        }
    }
    async fn quote_fees(&self, request: Request<pb::QuoteFeesRequest>) -> Result<Response<pb::FeeBreakdown>, Status> {
        let req = request.into_inner();
        let amount = req.amount.as_ref().map(|m| m.amount_minor).unwrap_or(0);
        let currency = req.amount.as_ref().map(|m| m.currency.clone()).unwrap_or_else(|| "USD".to_string());
        Ok(Response::new(pb::FeeBreakdown {
            gross: Some(pb::Money { amount_minor: amount, currency: currency.clone() }),
            merchant_net: Some(pb::Money { amount_minor: amount, currency }),
            lines: Vec::new(),
        }))
    }

    async fn upsert_fee_policy(&self, _: Request<pb::UpsertFeePolicyRequest>) -> Result<Response<pb::FeePolicy>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn list_fee_policies(&self, _: Request<pb::ListFeePoliciesRequest>) -> Result<Response<pb::ListFeePoliciesResponse>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn handle_rail_webhook(&self, request: Request<pb::HandleRailWebhookRequest>) -> Result<Response<pb::HandleRailWebhookResponse>, Status> {
        let req = request.into_inner();
        // Basic: record webhook event (idempotent by rail+provider_event_id).
        let rail = req.rail as i16;
        let sig = req.headers.get("X-Signature").cloned().or_else(|| req.headers.get("X-Hub-Signature-256").cloned());
        if let Some(sig) = sig {
            use hmac::{Hmac, KeyInit, Mac};
            use sha2::Sha256;
            type HmacSha256 = Hmac<Sha256>;
            let secret = std::env::var("WEBHOOK_SECRET").unwrap_or_else(|_| "dev-secret".to_string());
            let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| Status::internal("bad key"))?;
            mac.update(&req.raw_body);
            let expected = hex_encode(&mac.finalize().into_bytes());
            let provided = sig.trim_start_matches("sha256=");
            if provided != expected {
                return Err(Status::unauthenticated("INVALID_SIGNATURE"));
            }
        }
        let event_id = format!("{:x}", md5_simple(&req.raw_body));
        let inserted = sqlx::query(
            "INSERT INTO payments.webhook_events (rail, provider_event_id) VALUES ($1,$2) ON CONFLICT (rail, provider_event_id) DO NOTHING",
        )
        .bind(rail)
        .bind(&event_id)
        .execute(&self.pool)
        .await
        .map_err(|e| Status::internal(e.to_string()))?;
        Ok(Response::new(pb::HandleRailWebhookResponse {
            accepted: inserted.rows_affected() > 0,
            ..Default::default()
        }))
    }
    async fn resolve_unknown_payment(&self, _: Request<pb::ResolveUnknownPaymentRequest>) -> Result<Response<pb::Payment>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
    async fn post_memo_entry(&self, _: Request<pb::PostMemoEntryRequest>) -> Result<Response<pb::MemoEntry>, Status> {
        Err(Status::unimplemented("not implemented"))
    }
}
