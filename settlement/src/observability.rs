//! Telemetría de settlement (observability-standards.md §2.2 y §9–§16, rust-standards.md §5): logs
//! JSON estructurados y métricas Prometheus en el puerto de administración (SPEC §9).

use prometheus::{IntCounterVec, IntGauge, Opts, Registry};

pub const SERVICE: &str = "settlement";

/// Inicializa el logger JSON una vez (stdout). Nivel por `RUST_LOG` (info por defecto).
pub fn init_logging() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
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
    /// pp_settlement_batches_total{status}: lotes que llegan a cada estado.
    pub batches: IntCounterVec,
    /// pp_settlement_net_minor_total{currency}: monto pagado a comercios.
    pub net_minor: IntCounterVec,
    /// pp_settlement_processing_current: lotes PROCESSING (bancarios sin confirmar o asiento pendiente).
    pub processing: IntGauge,
    /// pp_settlement_job_failures_total{job}: fallos de los jobs, registrados una vez en el borde.
    pub job_failures: IntCounterVec,
}

#[derive(Debug, thiserror::Error)]
#[error("metrics: {0}")]
pub struct MetricsError(#[from] prometheus::Error);

impl Metrics {
    pub fn new() -> Result<Self, MetricsError> {
        let registry = Registry::new();
        let batches = IntCounterVec::new(
            Opts::new(
                "pp_settlement_batches_total",
                "Lotes de liquidación por estado alcanzado",
            ),
            &["status"],
        )?;
        let net_minor = IntCounterVec::new(
            Opts::new(
                "pp_settlement_net_minor_total",
                "Monto pagado a comercios en unidades menores",
            ),
            &["currency"],
        )?;
        let processing = IntGauge::new(
            "pp_settlement_processing_current",
            "Lotes de liquidación en proceso",
        )?;
        let job_failures = IntCounterVec::new(
            Opts::new(
                "pp_settlement_job_failures_total",
                "Fallos de los jobs de settlement",
            ),
            &["job"],
        )?;
        registry.register(Box::new(batches.clone()))?;
        registry.register(Box::new(net_minor.clone()))?;
        registry.register(Box::new(processing.clone()))?;
        registry.register(Box::new(job_failures.clone()))?;
        Ok(Self {
            registry,
            batches,
            net_minor,
            processing,
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
