//! Configuración por entorno (SPEC §9). Sin secretos por defecto (AGENTS.md §2.10) y sin valores
//! legales: límites, umbral de step-up y flags vienen de infra-management (AGENTS.md §2.13).

use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub grpc_port: u16,
    pub admin_port: u16,
    pub nats_url: String,
    pub nats_user: String,
    pub nats_pass: String,
    pub ledger_addr: String,
    pub identity_addr: String,
    pub infra_addr: String,
    /// Vida de un intent sin `expires_in_seconds` (domain-model §6.1: 15 min).
    pub intent_default_ttl: Duration,
    /// Plazo de cada llamada a ledger (SPEC §8: 2 s).
    pub ledger_timeout: Duration,
    /// Plazo de cada llamada a identity e infra-management (SPEC §8: 1 s).
    pub dependency_timeout: Duration,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} is required")]
    Missing(&'static str),
    #[error("{0} is not a valid number")]
    Number(&'static str),
}

fn number(name: &'static str, default: u64) -> Result<u64, ConfigError> {
    match std::env::var(name) {
        Ok(v) => v.parse().map_err(|_| ConfigError::Number(name)),
        Err(_) => Ok(default),
    }
}

fn port(name: &'static str, default: u16) -> Result<u16, ConfigError> {
    u16::try_from(number(name, u64::from(default))?).map_err(|_| ConfigError::Number(name))
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    std::env::var(name)
        .ok()
        .filter(|v| !v.is_empty())
        .ok_or(ConfigError::Missing(name))
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Config {
            database_url: required("DATABASE_URL")?,
            grpc_port: port("PORT", 50062)?,
            admin_port: port("ADMIN_PORT", 9100)?,
            nats_url: std::env::var("PP_NATS_URL").unwrap_or_default(),
            nats_user: std::env::var("PP_NATS_USER").unwrap_or_default(),
            nats_pass: std::env::var("PP_NATS_PASS").unwrap_or_default(),
            ledger_addr: required("PP_LEDGER_ADDR")?,
            identity_addr: required("PP_IDENTITY_ADDR")?,
            infra_addr: required("PP_INFRA_ADDR")?,
            intent_default_ttl: Duration::from_secs(number("PP_INTENT_DEFAULT_TTL_SECONDS", 900)?),
            ledger_timeout: Duration::from_millis(number("PP_LEDGER_TIMEOUT_MS", 2000)?),
            dependency_timeout: Duration::from_millis(number("PP_DEPENDENCY_TIMEOUT_MS", 1000)?),
        })
    }
}
