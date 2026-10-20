fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Contratos copiados por scripts/sync-protos.sh (rust-standards.md §3). payments-core sirve
    // `Payments` y es cliente de ledger, identity e infra-management (service-dependencies.md §3).
    tonic_prost_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(
            &[
                "proto/payments.proto",
                "proto/ledger.proto",
                "proto/identity.proto",
                "proto/infra_management.proto",
                "proto/events.proto",
            ],
            &["proto"],
        )?;
    println!("cargo:rerun-if-changed=proto");
    Ok(())
}
