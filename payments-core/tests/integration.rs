#![allow(clippy::unwrap_used, clippy::expect_used)]
use uuid::Uuid;

use plentypay_payments_core::grpc::service::PaymentsService;
use plentypay_payments_core::pb;
use plentypay_payments_core::pb::payments_server::Payments;
use sqlx::PgPool;
use tonic::Request;

async fn setup_pool() -> Option<PgPool> {
    let url = std::env::var("DATABASE_URL").ok()?;
    let pool = sqlx::postgres::PgPoolOptions::new().max_connections(2).connect(&url).await.ok()?;
    // run migration
    let sql = std::fs::read_to_string("migrations/0001_initial.sql").ok()?;
    let _ = sqlx::raw_sql(&sql).execute(&pool).await;
    Some(pool)
}

#[tokio::test]
async fn create_and_resolve_terminal() {
    let Some(pool) = setup_pool().await else { return; };
    let _ = sqlx::query("DELETE FROM payments.terminals").execute(&pool).await;
    let svc = PaymentsService::new(pool.clone());
    let resp = svc.create_terminal(Request::new(pb::CreateTerminalRequest {
        label: "Caja 1".to_string(),
        idempotency_key: "t1".to_string(),
    })).await.unwrap().into_inner();
    assert!(!resp.public_code.is_empty());
    // resolve
    let info = svc.resolve_terminal(Request::new(pb::ResolveTerminalRequest {
        public_code: resp.public_code.clone(),
    })).await.unwrap().into_inner();
    assert_eq!(info.merchant_name, "Caja 1");
    assert!(info.active);
    // inactive
    let _ = sqlx::query("UPDATE payments.terminals SET active=false WHERE public_code=$1")
        .bind(&resp.public_code).execute(&pool).await;
    let r = svc.resolve_terminal(Request::new(pb::ResolveTerminalRequest { public_code: resp.public_code })).await;
    assert!(r.is_err());
}

#[tokio::test]
async fn quote_fees_returns_breakdown() {
    let Some(_pool) = setup_pool().await else { return; };
    // quote_fees doesn't need DB
    let svc = PaymentsService::new(sqlx::postgres::PgPoolOptions::new().max_connections(1).connect(&std::env::var("DATABASE_URL").unwrap()).await.unwrap());
    let resp = svc.quote_fees(Request::new(pb::QuoteFeesRequest {
        amount: Some(pb::Money { amount_minor: 10000, currency: "USD".to_string() }),
        rail: 0,
    })).await.unwrap().into_inner();
    assert!(resp.gross.is_some());
}

#[tokio::test]
async fn handle_webhook_idempotent() {
    let Some(pool) = setup_pool().await else { return; };
    let _ = sqlx::query("DELETE FROM payments.webhook_events").execute(&pool).await;
    let svc = PaymentsService::new(pool.clone());
    let req = pb::HandleRailWebhookRequest {
        rail: 1,
        raw_body: b"{}".to_vec(),
        headers: std::collections::HashMap::new(),
    };
    let r1 = svc.handle_rail_webhook(Request::new(req.clone())).await.unwrap().into_inner();
    assert!(r1.accepted);
    let r2 = svc.handle_rail_webhook(Request::new(req)).await.unwrap().into_inner();
    assert!(!r2.accepted);
}

#[tokio::test]
async fn refund_payment_basic() {
    let Some(pool) = setup_pool().await else { return; };
    let _ = sqlx::query("DELETE FROM payments.payments").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM payments.refunds").execute(&pool).await;
    let pid = Uuid::new_v4();
    let _ = sqlx::query("INSERT INTO payments.payments (id, intent_id, tenant_id, status, rail, amount_minor, captured_minor, currency) VALUES ($1,$2,$3,5,1,10000,10000,'USD')")
        .bind(pid).bind(Uuid::new_v4()).bind(Uuid::new_v4()).execute(&pool).await;
    let svc = PaymentsService::new(pool.clone());
    let resp = svc.refund_payment(Request::new(pb::RefundPaymentRequest {
        payment_id: pid.to_string(),
        amount: Some(pb::Money { amount_minor: 2500, currency: "USD".to_string() }),
        reason: "test".to_string(),
        idempotency_key: "r1".to_string(),
        step_up_token: "test-step-up".to_string(),
    })).await.unwrap().into_inner();
    assert!(!resp.refund_id.is_empty());
}

#[tokio::test]
async fn webhook_invalid_signature_rejected() {
    let Some(pool) = setup_pool().await else { return; };
    let _ = sqlx::query("DELETE FROM payments.webhook_events").execute(&pool).await;
    let svc = PaymentsService::new(pool);
    let mut headers = std::collections::HashMap::new();
    headers.insert("X-Signature".to_string(), "invalidsig".to_string());
    let req = pb::HandleRailWebhookRequest {
        rail: 1,
        raw_body: b"{}".to_vec(),
        headers,
    };
    let r = svc.handle_rail_webhook(Request::new(req)).await;
    assert!(r.is_err());
}

#[tokio::test]
async fn create_and_confirm_payment_intent() {
    let Some(pool) = setup_pool().await else { return; };
    let _ = sqlx::query("DELETE FROM payments.intents").execute(&pool).await;
    let svc = PaymentsService::new(pool.clone());
    let resp = svc.create_payment_intent(Request::new(pb::CreatePaymentIntentRequest {
        idempotency_key: "pi-1".to_string(),
        payer_party_id: Uuid::new_v4().to_string(),
        rail: 1,
        ..Default::default()
    })).await.unwrap().into_inner();
    assert!(!resp.payment_intent_id.is_empty());
    let conf = svc.confirm_payment_intent(Request::new(pb::ConfirmPaymentIntentRequest {
        payment_intent_id: resp.payment_intent_id,
        idempotency_key: "pi-1-confirm".to_string(),
        ..Default::default()
    })).await.unwrap().into_inner();
    assert_eq!(conf.status, 2);
}
