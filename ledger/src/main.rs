#![allow(clippy::unwrap_used, clippy::expect_used)]
use plentypay_ledger::grpc::service::LedgerService;
use plentypay_ledger::observability::Metrics;
use plentypay_ledger::pb;
use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tonic::transport::Server;

#[tokio::main]
async fn main() {
    let addr: std::net::SocketAddr = "0.0.0.0:50061".parse().expect("addr");
    let metrics = Arc::new(Metrics::new());
    // HTTP admin: /healthz and /metrics
    let m = metrics.clone();
    tokio::spawn(async move {
        let app = Router::new()
            .route("/healthz", get(|| async { "ok" }))
            .route("/metrics", get(move || {
                let m = m.clone();
                async move {
                    use prometheus::Encoder;
                    let encoder = prometheus::TextEncoder::new();
                    let mut buf = Vec::new();
                    let _ = encoder.encode(&m.registry.gather(), &mut buf);
                    String::from_utf8(buf).unwrap_or_default()
                }
            }));
        let listener = match tokio::net::TcpListener::bind("0.0.0.0:9100").await { Ok(l) => l, Err(_) => return };
        let _ = axum::serve(listener, app).await;
    });

    if let Ok(url) = std::env::var("DATABASE_URL") {
        if let Ok(pool) = PgPoolOptions::new().max_connections(20).connect(&url).await {
            let pool2 = pool.clone();
            let m2 = metrics.clone();
            // Job I7: periodic invariant check
            tokio::spawn(async move {
                loop {
                    let count: (i64,) = sqlx::query_as(
                        "SELECT COUNT(*) FROM ledger.transactions t WHERE t.status='POSTED' AND (SELECT COALESCE(SUM(CASE WHEN e.side='D' THEN e.amount_minor ELSE -e.amount_minor END),0) FROM ledger.entries e WHERE e.transaction_id=t.id) <> 0",
                    )
                    .fetch_one(&pool2)
                    .await
                    .unwrap_or((0,));
                    if count.0 > 0 {
                        m2.imbalances_detected.inc_by(count.0 as u64);
                        eprintln!("CRITICAL: {} imbalanced transactions detected", count.0);
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                }
            });
            let pool2 = pool.clone();
            let nats_url = std::env::var("PP_NATS_URL").unwrap_or_default();
            let nats_user = std::env::var("PP_NATS_USER").unwrap_or_default();
            let nats_pass = std::env::var("PP_NATS_PASS").unwrap_or_default();
            if !nats_url.is_empty() {
                tokio::spawn(async move {
                    plentypay_ledger::relay::run_outbox_relay(pool2, nats_url, nats_user, nats_pass).await;
                });
            }
            let svc = LedgerService::new(pool);
            let server = pb::ledger_server::LedgerServer::new(svc);
            println!("ledger listening on {}", addr);
            let _ = Server::builder().add_service(server).serve(addr).await;
            return;
        }
    }
    println!("plentypay-ledger (skeleton, no DATABASE_URL)");
    // keep process alive for metrics
    tokio::signal::ctrl_c().await.ok();
}
