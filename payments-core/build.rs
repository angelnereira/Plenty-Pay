fn main() {
    let proto_dir = "proto";
    let proto_file = format!("{}/payments.proto", proto_dir);
    if std::path::Path::new(&proto_file).exists() {
        tonic_prost_build::configure()
            .build_server(true)
            .build_client(true)
            .compile_protos(&[&proto_file], &[&proto_dir.to_string()])
            .unwrap_or_else(|e| { eprintln!("proto build skipped: {}", e); });
    }
}
