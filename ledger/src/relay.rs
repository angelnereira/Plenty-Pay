use sqlx::PgPool;
use std::time::Duration;

pub async fn run_outbox_relay(pool: PgPool, nats_url: String, user: String, pass: String) {
    let client = match async_nats::connect_with_options(
        &nats_url,
        async_nats::ConnectOptions::new().user_and_password(user, pass),
    )
    .await
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("relay: nats connect failed: {}", e);
            return;
        }
    };
    loop {
        // fetch unpublished rows
        let rows: Vec<(uuid::Uuid, String, String, serde_json::Value)> = sqlx::query_as(
            "SELECT id, aggregate_type, aggregate_id, payload FROM ledger.outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 50",
        )
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
        for (id, agg_type, agg_id, payload) in rows {
            let subject = format!("pp.ledger.{}.{}.v1", agg_type, "posted");
            let data = payload.to_string().into_bytes();
            if client.publish(subject, data.into()).await.is_ok() {
                let _ = sqlx::query("UPDATE ledger.outbox SET published_at = now() WHERE id = $1")
                    .bind(id)
                    .execute(&pool)
                    .await;
            }
            let _ = (agg_id,);
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}
