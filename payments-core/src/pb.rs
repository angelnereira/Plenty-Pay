#![allow(
    clippy::all,
    clippy::pedantic,
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]
//! Código generado de los contratos (network-contracts → proto/ por sync-protos.sh).

pub mod plentypay {
    pub mod common {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.common.v1.rs"));
        }
    }
    pub mod payments {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.payments.v1.rs"));
        }
    }
    pub mod ledger {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.ledger.v1.rs"));
        }
    }
    pub mod identity {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.identity.v1.rs"));
        }
    }
    pub mod infra {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.infra.v1.rs"));
        }
    }
    pub mod events {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.events.v1.rs"));
        }
    }
}

pub use plentypay::common::v1::*;
pub use plentypay::events::v1::EventEnvelope;
pub use plentypay::payments::v1::*;
pub use plentypay::{identity::v1 as identity, infra::v1 as infra, ledger::v1 as ledger};
