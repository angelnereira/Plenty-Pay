//! Adaptador gRPC: traduce pb ↔ servicio y los errores a código + `reason` (grpc-conventions §4).

pub mod context;
pub mod errors;
pub mod service;
