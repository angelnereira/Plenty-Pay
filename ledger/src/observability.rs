//! Telemetría del ledger (observability-standards.md §9–§16, rust-standards.md §5): logs JSON
//! estructurados con `service` y `version`, y métricas Prometheus en el puerto de administración.

use prometheus::{IntCounter, IntCounterVec, Opts, Registry};

pub const SERVICE: &str = "ledger";

/// Inicializa el logger JSON una vez (stdout). Nivel por `LOG_LEVEL` (info por defecto).
pub fn init_logging() {
    let filter = tracing_subscriber::EnvFilter::try_new(
        std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
    )
    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(filter)
        .with_current_span(true)
        .with_target(false)
        .init();
}

pub struct Metrics {
    pub registry: Registry,
    /// pp_ledger_invariant_violations_total (R11): cualquier valor > 0 es alerta crítica.
    pub invariant_violations: IntCounter,
    /// Holds vencidos por el job R9.
    pub holds_expired: IntCounter,
    /// Fallos de los jobs por nombre (registrados una vez en el borde del bucle).
    pub job_failures: IntCounterVec,
}

#[derive(Debug, thiserror::Error)]
#[error("metrics: {0}")]
pub struct MetricsError(#[from] prometheus::Error);

impl Metrics {
    pub fn new() -> Result<Self, MetricsError> {
        let registry = Registry::new();
        let invariant_violations = IntCounter::new(
            "pp_ledger_invariant_violations_total",
            "Violaciones de invariantes del ledger detectadas por el job I7",
        )?;
        let holds_expired = IntCounter::new(
            "pp_ledger_holds_expired_total",
            "Retenciones vencidas por el job de expiración",
        )?;
        let job_failures = IntCounterVec::new(
            Opts::new(
                "pp_ledger_job_failures_total",
                "Fallos de los jobs del ledger",
            ),
            &["job"],
        )?;
        registry.register(Box::new(invariant_violations.clone()))?;
        registry.register(Box::new(holds_expired.clone()))?;
        registry.register(Box::new(job_failures.clone()))?;
        Ok(Self {
            registry,
            invariant_violations,
            holds_expired,
            job_failures,
        })
    }

    pub fn render(&self) -> String {
        use prometheus::Encoder;
        let mut buf = Vec::new();
        match prometheus::TextEncoder::new().encode(&self.registry.gather(), &mut buf) {
            Ok(()) => String::from_utf8(buf).unwrap_or_default(),
            Err(e) => {
                tracing::error!(err = %e, "metrics encode failed");
                String::new()
            }
        }
    }
}
