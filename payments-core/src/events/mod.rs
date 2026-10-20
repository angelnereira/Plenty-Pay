//! Eventos (ADR 0012, SPEC §7). Relay: cada fila del outbox se publica como `EventEnvelope` con
//! `Nats-Msg-Id = event_id` y se marca publicada solo tras el ack. Consumidor: proyecta
//! `TenantStatusChanged` en `payments.tenant_status` (R2), idempotente por `event_id`.

use std::time::Duration;

use futures_util::StreamExt;
use prost::Message;
use serde::Deserialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::pb;
use crate::store::PgPayments;

#[derive(Debug, thiserror::Error)]
pub enum EventError {
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("store: {0}")]
    Store(#[from] crate::store::StoreError),
    #[error("payload: {0}")]
    Payload(#[from] serde_json::Error),
    #[error("unknown event type {0}")]
    UnknownEvent(String),
    #[error("decode: {0}")]
    Decode(String),
    #[error("nats: {0}")]
    Nats(String),
}

#[derive(Deserialize)]
struct SplitJson {
    merchant_party_id: String,
    amount_minor: String,
    currency: String,
    #[serde(default)]
    reference_type: String,
    #[serde(default)]
    reference_id: String,
}

#[derive(Deserialize)]
struct CapturedJson {
    payment_id: String,
    tenant_id: String,
    rail: i32,
    gross_minor: String,
    currency: String,
    #[serde(default)]
    reference_type: String,
    #[serde(default)]
    reference_id: String,
    splits: Vec<SplitJson>,
    payment_intent_id: String,
}

#[derive(Deserialize)]
struct RefundJson {
    refund_id: String,
    payment_id: String,
    tenant_id: String,
    amount_minor: String,
    currency: String,
    #[serde(default)]
    reference_type: String,
    #[serde(default)]
    reference_id: String,
}

#[derive(Deserialize)]
struct FailedJson {
    payment_id: String,
    tenant_id: String,
    failure_code: String,
    #[serde(default)]
    reference_type: String,
    #[serde(default)]
    reference_id: String,
    payment_intent_id: String,
}

#[derive(Deserialize)]
struct UnknownJson {
    payment_id: String,
    tenant_id: String,
    rail: i32,
    #[serde(default)]
    reference_type: String,
    #[serde(default)]
    reference_id: String,
}

fn amount(s: &str) -> Result<i64, EventError> {
    s.parse()
        .map_err(|_| EventError::Decode(format!("unparseable amount_minor: {s}")))
}

fn reference(kind: String, id: String) -> Option<pb::Reference> {
    (!kind.is_empty()).then_some(pb::Reference { r#type: kind, id })
}

fn to_any<M: Message>(full_name: &str, msg: &M) -> prost_types::Any {
    prost_types::Any {
        type_url: format!("type.googleapis.com/{full_name}"),
        value: msg.encode_to_vec(),
    }
}

/// Convierte una fila del outbox en los bytes del sobre.
pub fn build_envelope(
    id: Uuid,
    event_type: &str,
    tenant_id: &str,
    aggregate_id: &str,
    payload: serde_json::Value,
    occurred_at: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<u8>, EventError> {
    let (short, any) = match event_type {
        "pp.payments.payment.captured.v1" => {
            let p: CapturedJson = serde_json::from_value(payload)?;
            let msg = pb::PaymentCaptured {
                payment_id: p.payment_id,
                tenant_id: p.tenant_id,
                rail: p.rail,
                gross: Some(pb::Money {
                    amount_minor: amount(&p.gross_minor)?,
                    currency: p.currency,
                }),
                reference: reference(p.reference_type, p.reference_id),
                splits: p
                    .splits
                    .into_iter()
                    .map(|s| {
                        Ok(pb::Split {
                            merchant_party_id: s.merchant_party_id,
                            amount: Some(pb::Money {
                                amount_minor: amount(&s.amount_minor)?,
                                currency: s.currency,
                            }),
                            reference: reference(s.reference_type, s.reference_id),
                        })
                    })
                    .collect::<Result<Vec<_>, EventError>>()?,
                payment_intent_id: p.payment_intent_id,
            };
            (
                "payments.payment.captured",
                to_any("plentypay.payments.v1.PaymentCaptured", &msg),
            )
        }
        "pp.payments.payment.failed.v1" => {
            let p: FailedJson = serde_json::from_value(payload)?;
            let msg = pb::PaymentFailed {
                payment_id: p.payment_id,
                tenant_id: p.tenant_id,
                failure_code: p.failure_code,
                reference: reference(p.reference_type, p.reference_id),
                payment_intent_id: p.payment_intent_id,
            };
            (
                "payments.payment.failed",
                to_any("plentypay.payments.v1.PaymentFailed", &msg),
            )
        }
        "pp.payments.payment.unknown.v1" => {
            let p: UnknownJson = serde_json::from_value(payload)?;
            let msg = pb::PaymentUnknown {
                payment_id: p.payment_id,
                tenant_id: p.tenant_id,
                rail: p.rail,
                reference: reference(p.reference_type, p.reference_id),
            };
            (
                "payments.payment.unknown",
                to_any("plentypay.payments.v1.PaymentUnknown", &msg),
            )
        }
        "pp.payments.refund.succeeded.v1" => {
            let p: RefundJson = serde_json::from_value(payload)?;
            let msg = pb::RefundSucceeded {
                refund_id: p.refund_id,
                payment_id: p.payment_id,
                tenant_id: p.tenant_id,
                amount: Some(pb::Money {
                    amount_minor: amount(&p.amount_minor)?,
                    currency: p.currency,
                }),
                reference: reference(p.reference_type, p.reference_id),
            };
            (
                "payments.refund.succeeded",
                to_any("plentypay.payments.v1.RefundSucceeded", &msg),
            )
        }
        other => return Err(EventError::UnknownEvent(other.to_string())),
    };
    let envelope = pb::EventEnvelope {
        event_id: id.to_string(),
        event_type: short.to_string(),
        schema_version: 1,
        producer: "payments-core".into(),
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
    let rows = sqlx::query("SELECT id, event_type, aggregate_id, tenant_id, payload, created_at FROM payments.outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 100")
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
            .map_err(|e| EventError::Nats(e.to_string()))?;
        ack.await.map_err(|e| EventError::Nats(e.to_string()))?;
        let mut tx = service_tx(pool).await?;
        sqlx::query("UPDATE payments.outbox SET published_at = now() WHERE id = $1")
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

pub const TENANT_SUBJECT: &str = "pp.identity.tenant.status_changed.v1";
const TENANT_CONSUMER: &str = "payments-core-tenant-status";

/// Aplica un `TenantStatusChanged` recibido. Devuelve si cambió algo (falso = duplicado).
pub async fn apply_tenant_event(store: &PgPayments, bytes: &[u8]) -> Result<bool, EventError> {
    let env = pb::EventEnvelope::decode(bytes).map_err(|e| EventError::Decode(e.to_string()))?;
    let any = env
        .payload
        .ok_or_else(|| EventError::Decode("envelope without payload".into()))?;
    let ev = pb::identity::TenantStatusChanged::decode(any.value.as_slice())
        .map_err(|e| EventError::Decode(e.to_string()))?;
    let tenant = Uuid::parse_str(&ev.tenant_id).map_err(|e| EventError::Decode(e.to_string()))?;
    let at = env
        .occurred_at
        .and_then(|t| {
            chrono::DateTime::from_timestamp(t.seconds, u32::try_from(t.nanos).unwrap_or(0))
        })
        .unwrap_or_else(chrono::Utc::now);
    let status = i16::try_from(ev.status).map_err(|e| EventError::Decode(e.to_string()))?;
    Ok(store
        .project_tenant_status(&env.event_id, tenant, status, at)
        .await?)
}

/// Consumidor durable de `TenantStatusChanged`. Un mensaje que no se puede decodificar se registra
/// y se confirma (reintentarlo no lo arregla); un fallo de base no se confirma y se reintenta.
pub async fn run_tenant_consumer(
    store: PgPayments,
    js: async_nats::jetstream::Context,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    loop {
        if let Err(e) = consume_tenants(&store, &js, &mut shutdown).await {
            tracing::error!(error.type = "consumer", err = %e, "tenant status consumer failed");
        }
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(5)) => {}
            _ = shutdown.changed() => return,
        }
    }
}

async fn consume_tenants(
    store: &PgPayments,
    js: &async_nats::jetstream::Context,
    shutdown: &mut tokio::sync::watch::Receiver<bool>,
) -> Result<(), EventError> {
    use async_nats::jetstream::consumer::pull;
    let stream = js
        .get_stream("PP_IDENTITY")
        .await
        .map_err(|e| EventError::Nats(e.to_string()))?;
    let consumer = stream
        .get_or_create_consumer(
            TENANT_CONSUMER,
            pull::Config {
                durable_name: Some(TENANT_CONSUMER.into()),
                filter_subject: TENANT_SUBJECT.into(),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| EventError::Nats(e.to_string()))?;
    let mut messages = consumer
        .messages()
        .await
        .map_err(|e| EventError::Nats(e.to_string()))?;
    loop {
        let next = tokio::select! {
            m = messages.next() => m,
            _ = shutdown.changed() => return Ok(()),
        };
        let Some(msg) = next else { return Ok(()) };
        let msg = msg.map_err(|e| EventError::Nats(e.to_string()))?;
        match apply_tenant_event(store, &msg.payload).await {
            Ok(changed) => tracing::info!(changed, "tenant status projected"),
            Err(e @ EventError::Decode(_)) => {
                tracing::error!(error.type = "consumer", err = %e, "tenant status event discarded");
            }
            Err(e) => return Err(e),
        }
        msg.ack()
            .await
            .map_err(|e| EventError::Nats(e.to_string()))?;
    }
}
