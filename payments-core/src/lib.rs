//! payments-core: orquesta los cobros de PlentyPay (SPEC.md). Único que pide al ledger los asientos
//! de cobro y reembolso (AGENTS.md §2.5).

pub mod clients;
pub mod config;
pub mod domain;
pub mod events;
pub mod grpc;
pub mod observability;
pub mod pb;
pub mod service;
pub mod store;
