//! Eventos (ADR 0012, SPEC §6). Cada fila del outbox guarda el mensaje del evento ya codificado y su
//! subject; el relay lo envuelve en `EventEnvelope`, lo publica con `Nats-Msg-Id = id` y lo marca
//! publicado solo tras el ack.

use std::time::Duration;

use prost::Message;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::pb;

pub const BATCH_PAID: &str = "pp.settlement.batch.paid.v1";
pub const BATCH_FAILED: &str = "pp.settlement.batch.failed.v1";
pub const DESTINATION_CHANGED: &str = "pp.settlement.payout_destination.changed.v1";

#[derive(Debug, thiserror::Error)]
pub enum EventError {
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("unknown event type {0}")]
    UnknownEvent(String),
    #[error("nats: {0}")]
    Nats(String),
}

/// Nombre corto (sin `pp.` ni versión) y tipo protobuf de cada subject.
fn describe(subject: &str) -> Result<(&'static str, &'static str), EventError> {
    match subject {
        BATCH_PAID => Ok(("settlement.batch.paid", "plentypay.settlement.v1.BatchPaid")),
        BATCH_FAILED => Ok((
            "settlement.batch.failed",
            "plentypay.settlement.v1.BatchFailed",
        )),
        DESTINATION_CHANGED => Ok((
            "settlement.payout_destination.changed",
            "plentypay.settlement.v1.PayoutDestinationChanged",
        )),
        other => Err(EventError::UnknownEvent(other.to_string())),
    }
}

pub fn build_envelope(
    id: Uuid,
    subject: &str,
    tenant_id: &str,
    aggregate_id: &str,
    payload: Vec<u8>,
    occurred_at: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<u8>, EventError> {
    let (short, full) = describe(subject)?;
    let envelope = pb::EventEnvelope {
        event_id: id.to_string(),
        event_type: short.to_string(),
        schema_version: 1,
        producer: "settlement".into(),
        tenant_id: tenant_id.to_string(),
        aggregate_id: aggregate_id.to_string(),
        occurred_at: Some(prost_types::Timestamp {
            seconds: occurred_at.timestamp(),
            nanos: i32::try_from(occurred_at.timestamp_subsec_nanos()).unwrap_or(0),
        }),
        trace_id: String::new(),
        payload: Some(prost_types::Any {
            type_url: format!("type.googleapis.com/{full}"),
            value: payload,
        }),
    };
    Ok(envelope.encode_to_vec())
}

async fn service_tx(
    pool: &PgPool,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, EventError> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await?;
    Ok(tx)
}

/// Publica lo pendiente una vez. Devuelve cuántos eventos publicó.
pub async fn publish_once(
    pool: &PgPool,
    js: &async_nats::jetstream::Context,
) -> Result<usize, EventError> {
    let mut tx = service_tx(pool).await?;
    let rows = sqlx::query(
        "SELECT id, event_type, aggregate_id, tenant_id, payload, created_at FROM settlement.outbox
         WHERE published_at IS NULL ORDER BY created_at LIMIT 100",
    )
    .fetch_all(tx.as_mut())
    .await?;
    tx.commit().await?;
    let mut published = 0usize;
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let subject: String = row.try_get("event_type")?;
        let bytes = match build_envelope(
            id,
            &subject,
            &row.try_get::<Uuid, _>("tenant_id")?.to_string(),
            &row.try_get::<Uuid, _>("aggregate_id")?.to_string(),
            row.try_get("payload")?,
            row.try_get("created_at")?,
        ) {
            Ok(b) => b,
            Err(e) => {
                // Un evento que no se puede empaquetar es un defecto: se registra y no bloquea a los demás.
                tracing::error!(error.type = "relay", outbox_id = %id, event_type = %subject, err = %e, "outbox event skipped");
                continue;
            }
        };
        let mut headers = async_nats::HeaderMap::new();
        headers.insert("Nats-Msg-Id", id.to_string().as_str());
        let ack = js
            .publish_with_headers(subject.clone(), headers, bytes.into())
            .await
            .map_err(|e| EventError::Nats(e.to_string()))?;
        ack.await.map_err(|e| EventError::Nats(e.to_string()))?;
        let mut tx = service_tx(pool).await?;
        sqlx::query("UPDATE settlement.outbox SET published_at = now() WHERE id = $1")
            .bind(id)
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        published = published.saturating_add(1);
    }
    Ok(published)
}

/// Bucle del relay: registra cada fallo una vez (borde del bucle) y reintenta en la siguiente vuelta.
pub async fn run_relay(
    pool: PgPool,
    js: async_nats::jetstream::Context,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    loop {
        match publish_once(&pool, &js).await {
            Ok(n) if n > 0 => tracing::debug!(published = n, "outbox published"),
            Ok(_) => {}
            Err(e) => tracing::error!(error.type = "relay", err = %e, "outbox relay failed"),
        }
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(1)) => {}
            _ = shutdown.changed() => return,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// ADR 0012: el sobre lleva el productor, el tipo corto y el mensaje con su type_url.
    #[test]
    fn envelope_carries_type_and_payload() {
        let ev = pb::BatchPaid {
            batch_id: "b".into(),
            tenant_id: "t".into(),
            net_payout: None,
        };
        let bytes = build_envelope(
            Uuid::nil(),
            BATCH_PAID,
            "t",
            "b",
            ev.encode_to_vec(),
            chrono::Utc::now(),
        );
        let env = bytes
            .ok()
            .and_then(|b| pb::EventEnvelope::decode(b.as_slice()).ok())
            .unwrap_or_default();
        assert_eq!(env.event_type, "settlement.batch.paid");
        assert_eq!(env.producer, "settlement");
        assert_eq!(
            env.payload.map(|p| p.type_url),
            Some("type.googleapis.com/plentypay.settlement.v1.BatchPaid".into())
        );
        assert!(build_envelope(
            Uuid::nil(),
            "pp.otro.v1",
            "t",
            "b",
            vec![],
            chrono::Utc::now()
        )
        .is_err());
    }
}
