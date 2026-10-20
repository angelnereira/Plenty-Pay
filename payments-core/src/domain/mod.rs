//! Reglas puras de payments-core: sin tonic, sqlx ni tokio (rust-standards.md §3).

pub mod errors;
pub mod fees;
pub mod request;
pub mod state;
