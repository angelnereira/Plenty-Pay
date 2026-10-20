//! Quién llama, desde los metadatos (ADR 0011): nunca del cuerpo.

use tonic::metadata::MetadataMap;
use tonic::{Code, Status};

use crate::grpc::errors::status;
use crate::store::ReadScope;

/// Servicios que pueden escribir en el ledger (SPEC §4, service-dependencies.md §3).
const WRITERS: &[&str] = &["payments-core", "settlement"];
/// Servicios que leen sin restricción de parte.
const SERVICE_READERS: &[&str] = &["payments-core", "settlement", "analytics-bi"];

pub struct Caller {
    pub service: String,
    pub user_id: String,
    pub tenant_id: String,
    pub permissions: Vec<String>,
    pub request_id: String,
}

fn md(m: &MetadataMap, key: &str) -> String {
    m.get(key)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string()
}

impl Caller {
    pub fn from_metadata(m: &MetadataMap) -> Self {
        Caller {
            service: md(m, "x-pp-actor-service"),
            user_id: md(m, "x-pp-user-id"),
            tenant_id: md(m, "x-pp-tenant-id"),
            permissions: md(m, "x-pp-permissions")
                .split(',')
                .filter(|p| !p.is_empty())
                .map(str::to_string)
                .collect(),
            request_id: md(m, "x-pp-request-id"),
        }
    }

    fn has(&self, perm: &str) -> bool {
        self.permissions.iter().any(|p| p == perm)
    }

    /// Escrituras: solo payments-core y settlement.
    pub fn require_writer(&self) -> Result<(), Status> {
        if WRITERS.contains(&self.service.as_str()) {
            Ok(())
        } else {
            Err(status(
                Code::PermissionDenied,
                "PERMISSION_DENIED",
                "solo payments-core y settlement escriben en el ledger",
            ))
        }
    }

    /// Lecturas: un servicio de confianza lee todo; desde el gateway, la persona lee lo suyo
    /// (`wallet:read`) y el negocio lo suyo (`payments:read` o `settlement:read`). Una parte ajena
    /// responde NOT_FOUND (no se revela existencia).
    pub fn read_scope(&self, party_id: &str) -> Result<ReadScope, Status> {
        if SERVICE_READERS.contains(&self.service.as_str()) {
            return Ok(ReadScope {
                service: true,
                ..Default::default()
            });
        }
        if self.service == "api-gateway" {
            if party_id == self.user_id && self.has("wallet:read") {
                return Ok(ReadScope {
                    service: false,
                    party_id: party_id.to_string(),
                    tenant_id: String::new(),
                });
            }
            if !self.tenant_id.is_empty()
                && party_id == self.tenant_id
                && (self.has("payments:read") || self.has("settlement:read"))
            {
                return Ok(ReadScope {
                    service: false,
                    party_id: party_id.to_string(),
                    tenant_id: self.tenant_id.clone(),
                });
            }
            return Err(status(Code::NotFound, "NOT_FOUND", "no encontrado"));
        }
        Err(status(
            Code::PermissionDenied,
            "PERMISSION_DENIED",
            "llamador no autorizado",
        ))
    }
}
