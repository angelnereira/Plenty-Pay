#![allow(clippy::all)]

pub mod plentypay {
    pub mod common {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.common.v1.rs"));
        }
    }
    pub mod ledger {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/plentypay.ledger.v1.rs"));
        }
    }
}

pub use plentypay::common::v1::*;
pub use plentypay::ledger::v1::*;
