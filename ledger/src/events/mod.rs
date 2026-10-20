//! Outbox → NATS JetStream (ADR 0012). Cada fila se publica como `EventEnvelope` con
//! `Nats-Msg-Id = event_id` (deduplicación del bus) y se marca publicada solo tras el ack.

use std::time::Duration;

use prost::Message;
use serde::Deserialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::pb;

#[derive(Debug, thiserror::Error)]
pub enum RelayError {
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("payload: {0}")]
    Payload(#[from] serde_json::Error),
    #[error("unknown event type {0}")]
    UnknownEvent(String),
    #[error("publish: {0}")]
    Publish(String),
    #[error("encode any: {0}")]
    Encode(String),
}

#[derive(Deserialize)]
struct RefJson {
    #[serde(rename = "type")]
    kind: String,
    id: String,
}

#[derive(Deserialize)]
struct AccountJson {
    party_id: String,
    #[serde(rename = "type")]
    kind: i32,
    currency: String,
    scope_id: String,
}

#[derive(Deserialize)]
struct EntryJson {
    account: AccountJson,
    side: i32,
    amount_minor: String,
}

#[derive(Deserialize)]
struct PostedJson {
    transaction_id: String,
    tenant_id: String,
    transaction_type: String,
    reference: RefJson,
    currency: String,
    entries: Vec<EntryJson>,
}

#[derive(Deserialize)]
struct HoldJson {
    hold_id: String,
    status: i32,
    account: AccountJson,
    amount_minor: String,
}

fn parse_amount(s: &str) -> Result<i64, RelayError> {
    s.parse()
        .map_err(|_| RelayError::Encode(format!("unparseable amount_minor: {s}")))
}

fn account(a: AccountJson) -> pb::AccountRef {
    pb::AccountRef {
        party_id: a.party_id,
        r#type: a.kind,
        currency: a.currency,
        scope_id: a.scope_id,
    }
}

/// Convierte una fila del outbox en (subject, bytes del sobre).
pub fn build_envelope(
    id: Uuid,
    event_type: &str,
    tenant_id: &str,
    aggregate_id: &str,
    payload: serde_json::Value,
    occurred_at: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<u8>, RelayError> {
    let (short, any) = match event_type {
        "pp.ledger.transaction.posted.v1" => {
            let p: PostedJson = serde_json::from_value(payload)?;
            let msg = pb::TransactionPosted {
                transaction_id: p.transaction_id,
                tenant_id: p.tenant_id,
                transaction_type: p.transaction_type,
                reference: Some(pb::Reference {
                    r#type: p.reference.kind,
                    id: p.reference.id,
                }),
                currency: p.currency,
                entries: p
                    .entries
                    .into_iter()
                    .map(|e| {
                        Ok(pb::Entry {
                            account: Some(account(e.account)),
                            side: e.side,
                            amount_minor: parse_amount(&e.amount_minor)?,
                            ..Default::default()
                        })
                    })
                    .collect::<Result<Vec<_>, RelayError>>()?,
            };
            (
                "ledger.transaction.posted",
                to_any("plentypay.ledger.v1.TransactionPosted", &msg),
            )
        }
        "pp.ledger.hold.status_changed.v1" => {
            let p: HoldJson = serde_json::from_value(payload)?;
            let msg = pb::HoldStatusChanged {
                hold_id: p.hold_id,
                status: p.status,
                account: Some(account(p.account)),
                amount_minor: parse_amount(&p.amount_minor)?,
            };
            (
                "ledger.hold.status_changed",
                to_any("plentypay.ledger.v1.HoldStatusChanged", &msg),
            )
        }
        other => return Err(RelayError::UnknownEvent(other.to_string())),
    };
    let envelope = pb::EventEnvelope {
        event_id: id.to_string(),
        event_type: short.to_string(),
        schema_version: 1,
        producer: "ledger".into(),
        tenant_id: tenant_id.to_string(),
        aggregate_id: aggregate_id.to_string(),
        occurred_at: Some(prost_types::Timestamp {
            seconds: occurred_at.timestamp(),
            nanos: i32::try_from(occurred_at.timestamp_subsec_nanos()).unwrap_or(0),
        }),
        trace_id: String::new(),
        payload: Some(any),
    };
    Ok(envelope.encode_to_vec())
}

/// Publica lo pendiente una vez. Devuelve cuántos eventos publicó.
pub async fn publish_once(
    pool: &PgPool,
    js: &async_nats::jetstream::Context,
) -> Result<usize, RelayError> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await?;
    let rows = sqlx::query("SELECT id, event_type, aggregate_id, payload, created_at, coalesce(payload->>'tenant_id', '') AS tenant_id FROM ledger.outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 100")
        .fetch_all(tx.as_mut())
        .await?;
    tx.commit().await?;
    let mut published = 0usize;
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let event_type: String = row.try_get("event_type")?;
        // Un evento que no se puede empaquetar es un defecto: se registra y no bloquea a los demás.
        let bytes = match build_envelope(
            id,
            &event_type,
            &row.try_get::<String, _>("tenant_id")?,
            &row.try_get::<String, _>("aggregate_id")?,
            row.try_get("payload")?,
            row.try_get("created_at")?,
        ) {
            Ok(b) => b,
            Err(e) => {
                tracing::error!(error.type = "relay", outbox_id = %id, event_type = %event_type, err = %e, "outbox event skipped");
                continue;
            }
        };
        let mut headers = async_nats::HeaderMap::new();
        headers.insert("Nats-Msg-Id", id.to_string().as_str());
        let ack = js
            .publish_with_headers(event_type.clone(), headers, bytes.into())
            .await
            .map_err(|e| RelayError::Publish(e.to_string()))?;
        ack.await.map_err(|e| RelayError::Publish(e.to_string()))?;
        let mut tx = pool.begin().await?;
        sqlx::query("SELECT set_config('app.actor', 'service', true)")
            .execute(tx.as_mut())
            .await?;
        sqlx::query("UPDATE ledger.outbox SET published_at = now() WHERE id = $1")
            .bind(id)
            .execute(tx.as_mut())
            .await?;
        tx.commit().await?;
        published = published.saturating_add(1);
    }
    Ok(published)
}

/// Bucle del relay: registra cada fallo una vez (borde del bucle) y reintenta en la siguiente vuelta.
pub async fn run(
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

/// Empaqueta un mensaje en `google.protobuf.Any` con su nombre completo del contrato.
fn to_any<M: prost::Message>(full_name: &str, msg: &M) -> prost_types::Any {
    prost_types::Any {
        type_url: format!("type.googleapis.com/{full_name}"),
        value: msg.encode_to_vec(),
    }
}
