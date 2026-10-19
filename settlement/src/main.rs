#![allow(clippy::unwrap_used, clippy::expect_used)]

use plentypay_settlement::grpc::service::SettlementService;
use plentypay_settlement::observability::Metrics;
use plentypay_settlement::pb;
use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tonic::transport::Server;

#[tokio::main]
async fn main() {
    let addr = "0.0.0.0:50063".parse().expect("addr");
    let metrics = Arc::new(Metrics::new());
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
        let listener = tokio::net::TcpListener::bind("0.0.0.0:9100").await.unwrap();
        let _ = axum::serve(listener, app).await;
    });

    if let Ok(url) = std::env::var("DATABASE_URL") {
        if let Ok(pool) = PgPoolOptions::new().max_connections(5).connect(&url).await {
            let pool2 = pool.clone();
            let m2 = metrics.clone();
            tokio::spawn(async move {
                loop {
                    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM settlement.reconciliation_items WHERE state=1")
                        .fetch_one(&pool2).await.unwrap_or((0,));
                    if count.0 > 0 {
                        m2.reconciliation_exceptions.inc_by(count.0 as u64);
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                }
            });
            let svc = SettlementService::new(pool);
            let server = pb::settlement_server::SettlementServer::new(svc);
            println!("settlement listening on {}", addr);
            let _ = Server::builder().add_service(server).serve(addr).await;
            return;
        }
    }
    println!("plentypay-settlement (skeleton, no DATABASE_URL)");
    tokio::signal::ctrl_c().await.ok();
}
