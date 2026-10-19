#![allow(clippy::all)]

pub mod plentypay {
    pub mod common { pub mod v1 { include!(concat!(env!("OUT_DIR"), "/plentypay.common.v1.rs")); } }
    pub mod settlement { pub mod v1 { include!(concat!(env!("OUT_DIR"), "/plentypay.settlement.v1.rs")); } }
}

pub use plentypay::common::v1::*;
pub use plentypay::settlement::v1::*;
