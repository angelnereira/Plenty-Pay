fn main() {
    let proto_dir = "proto";
    let proto_file = format!("{}/ledger.proto", proto_dir);
    // Only build if proto exists (sync-protos.sh copies it).
    if std::path::Path::new(&proto_file).exists() {
        tonic_prost_build::configure()
            .build_server(true)
            .build_client(false)
            .compile_protos(&[&proto_file], &[&proto_dir.to_string()])
            .unwrap_or_else(|e| {
                // In offline/dev builds without protoc, skip.
                eprintln!("proto build skipped: {}", e);
            });
    }
}
