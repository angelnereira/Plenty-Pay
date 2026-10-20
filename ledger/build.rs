fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Contratos copiados por scripts/sync-protos.sh (rust-standards.md §3). Un fallo de compilación
    // del contrato es un error de build, nunca se omite.
    tonic_prost_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(&["proto/ledger.proto", "proto/events.proto"], &["proto"])?;
    println!("cargo:rerun-if-changed=proto");
    Ok(())
}
