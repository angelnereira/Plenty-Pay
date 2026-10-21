fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Contratos copiados por scripts/sync-protos.sh (rust-standards.md §3). settlement sirve
    // `Settlement` y es cliente de ledger, payments-core, identity y security
    // (service-dependencies.md §3).
    tonic_prost_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(
            &[
                "proto/settlement.proto",
                "proto/ledger.proto",
                "proto/payments.proto",
                "proto/identity.proto",
                "proto/security.proto",
                "proto/events.proto",
            ],
            &["proto"],
        )?;
    println!("cargo:rerun-if-changed=proto");
    Ok(())
}
