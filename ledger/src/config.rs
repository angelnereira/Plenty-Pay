//! Configuración por entorno (sin secretos por defecto: AGENTS.md §2.10).

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub grpc_port: u16,
    pub admin_port: u16,
    pub nats_url: String,
    pub nats_user: String,
    pub nats_pass: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} is required")]
    Missing(&'static str),
    #[error("{0} is not a valid port")]
    Port(&'static str),
}

fn port(name: &'static str, default: u16) -> Result<u16, ConfigError> {
    match std::env::var(name) {
        Ok(v) => v.parse().map_err(|_| ConfigError::Port(name)),
        Err(_) => Ok(default),
    }
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")
                .map_err(|_| ConfigError::Missing("DATABASE_URL"))?,
            grpc_port: port("PORT", 50061)?,
            admin_port: port("ADMIN_PORT", 9100)?,
            nats_url: std::env::var("PP_NATS_URL").unwrap_or_default(),
            nats_user: std::env::var("PP_NATS_USER").unwrap_or_default(),
            nats_pass: std::env::var("PP_NATS_PASS").unwrap_or_default(),
        })
    }
}
