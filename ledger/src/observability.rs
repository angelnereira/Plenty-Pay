#![allow(clippy::unwrap_used, clippy::expect_used, clippy::new_without_default)]

use prometheus::{IntCounter, Registry};

pub struct Metrics {
    pub registry: Registry,
    pub imbalances_detected: IntCounter,
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        let imbalances_detected =
            IntCounter::new("ledger_imbalances_detected_total", "Number of invariant violations detected by job I7")
                .unwrap();
        let _ = registry.register(Box::new(imbalances_detected.clone()));
        Self { registry, imbalances_detected }
    }
}
