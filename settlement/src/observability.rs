#![allow(clippy::unwrap_used, clippy::expect_used, clippy::new_without_default)]

use prometheus::{IntCounter, Registry};

pub struct Metrics {
    pub registry: Registry,
    pub reconciliation_exceptions: IntCounter,
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        let reconciliation_exceptions = IntCounter::new(
            "settlement_reconciliation_exceptions_total",
            "Number of reconciliation exceptions",
        )
        .unwrap();
        let _ = registry.register(Box::new(reconciliation_exceptions.clone()));
        Self { registry, reconciliation_exceptions }
    }
}
