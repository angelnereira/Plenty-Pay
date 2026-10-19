//! Ledger domain (F10.1): Money and posting templates. Pure domain, no I/O.

pub mod domain;
pub mod error;
pub mod grpc;
pub mod pb;
pub mod relay;
pub mod observability;

pub use domain::money::{Currency, Money};
pub use domain::posting::{PostingTemplate, TemplateId};
pub use error::LedgerError;
