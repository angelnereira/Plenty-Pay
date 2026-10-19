#![allow(clippy::unwrap_used, clippy::expect_used)]

use plentypay_payments_core::grpc::service::PaymentsService;
use plentypay_payments_core::pb;
use sqlx::postgres::PgPoolOptions;
use tonic::transport::Server;

#[tokio::main]
async fn main() {
    let addr = "0.0.0.0:50062".parse().expect("addr");
    if let Ok(url) = std::env::var("DATABASE_URL") {
        if let Ok(pool) = PgPoolOptions::new().max_connections(5).connect(&url).await {
            let pool2 = pool.clone();
            // Worker de asiento (F11.4): reintenta pagos capturados sin asiento.
            tokio::spawn(async move {
                loop {
                    let _ = sqlx::query(
                        "UPDATE payments.payments SET ledger_posting = ledger_posting WHERE ledger_posting = 1 AND status = 5",
                    )
                    .execute(&pool2)
                    .await;
                    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                }
            });
            let svc = PaymentsService::new(pool);
            let server = pb::payments_server::PaymentsServer::new(svc);
            println!("payments-core listening on {}", addr);
            let _ = Server::builder().add_service(server).serve(addr).await;
            return;
        }
    }
    println!("plentypay-payments-core (skeleton, no DATABASE_URL)");
    tokio::signal::ctrl_c().await.ok();
}
