//! Telemetría de payments-core (observability-standards.md §2.2 y §9–§16, rust-standards.md §5):
//! logs JSON estructurados y métricas Prometheus en el puerto de administración.

use prometheus::{IntCounterVec, IntGauge, IntGaugeVec, Opts, Registry};

pub const SERVICE: &str = "payments-core";

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
    /// pp_payments_total{rail,status}: pagos que llegan a un estado final o UNKNOWN.
    pub payments: IntCounterVec,
    /// pp_payments_amount_minor_total{rail,currency}: monto capturado.
    pub amount_minor: IntCounterVec,
    /// pp_rail_requests_total{rail,op,result}: cada llamada a un riel (WALLET = ledger).
    pub rail_requests: IntCounterVec,
    /// pp_payments_unknown_current{rail}: pagos en UNKNOWN ahora.
    pub unknown_current: IntGaugeVec,
    /// pp_payments_captured_unposted_current: capturados sin asiento (> 0 por 5 min = crítica).
    pub captured_unposted: IntGauge,
    /// pp_payments_job_failures_total{job}: fallos de los jobs, registrados una vez en el borde.
    pub job_failures: IntCounterVec,
}

#[derive(Debug, thiserror::Error)]
#[error("metrics: {0}")]
pub struct MetricsError(#[from] prometheus::Error);

impl Metrics {
    pub fn new() -> Result<Self, MetricsError> {
        let registry = Registry::new();
        let payments = IntCounterVec::new(
            Opts::new("pp_payments_total", "Pagos por riel y estado alcanzado"),
            &["rail", "status"],
        )?;
        let amount_minor = IntCounterVec::new(
            Opts::new(
                "pp_payments_amount_minor_total",
                "Monto capturado en unidades menores",
            ),
            &["rail", "currency"],
        )?;
        let rail_requests = IntCounterVec::new(
            Opts::new(
                "pp_rail_requests_total",
                "Llamadas a rieles por operación y resultado",
            ),
            &["rail", "op", "result"],
        )?;
        let unknown_current = IntGaugeVec::new(
            Opts::new("pp_payments_unknown_current", "Pagos en estado UNKNOWN"),
            &["rail"],
        )?;
        let captured_unposted = IntGauge::new(
            "pp_payments_captured_unposted_current",
            "Pagos capturados sin asiento en el ledger",
        )?;
        let job_failures = IntCounterVec::new(
            Opts::new(
                "pp_payments_job_failures_total",
                "Fallos de los jobs de payments-core",
            ),
            &["job"],
        )?;
        registry.register(Box::new(payments.clone()))?;
        registry.register(Box::new(amount_minor.clone()))?;
        registry.register(Box::new(rail_requests.clone()))?;
        registry.register(Box::new(unknown_current.clone()))?;
        registry.register(Box::new(captured_unposted.clone()))?;
        registry.register(Box::new(job_failures.clone()))?;
        Ok(Self {
            registry,
            payments,
            amount_minor,
            rail_requests,
            unknown_current,
            captured_unposted,
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
