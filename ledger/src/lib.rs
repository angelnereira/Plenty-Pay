//! ledger: libro contable de doble partida de PlentyPay (SPEC.md). Único que escribe asientos
//! (AGENTS.md §2.5).

pub mod config;
pub mod domain;
pub mod error;
pub mod events;
pub mod grpc;
pub mod observability;
pub mod pb;
pub mod store;

pub use domain::money::{Currency, Money};
pub use error::LedgerError;
