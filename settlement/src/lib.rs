//! settlement: liquida a los comercios lo que el ledger les debe (MERCHANT_PAYABLE) y, en una fase
//! siguiente, concilia contra extractos de rieles y bancos (SPEC.md). Pide al ledger los asientos
//! de pago (T6, T6b); nunca escribe saldos por su cuenta (AGENTS.md §2.5).

pub mod clients;
pub mod config;
pub mod domain;
pub mod events;
pub mod grpc;
pub mod observability;
pub mod pb;
pub mod service;
pub mod store;
