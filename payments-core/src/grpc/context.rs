//! Quién llama, desde los metadatos (ADR 0011, ADR 0014): nunca del cuerpo.

use tonic::metadata::MetadataMap;
use uuid::Uuid;

use crate::service::Actor;

fn md(m: &MetadataMap, key: &str) -> String {
    m.get(key)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string()
}

pub fn actor(m: &MetadataMap) -> Actor {
    Actor {
        service: md(m, "x-pp-actor-service"),
        user_id: Uuid::parse_str(&md(m, "x-pp-user-id")).ok(),
        tenant_id: Uuid::parse_str(&md(m, "x-pp-tenant-id")).ok(),
        permissions: md(m, "x-pp-permissions")
            .split(',')
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .map(str::to_string)
            .collect(),
        request_id: md(m, "x-pp-request-id"),
    }
}
