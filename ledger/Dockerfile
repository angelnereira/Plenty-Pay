# syntax=docker/dockerfile:1
# Plantilla de docs/standards/rust-standards.md §10.
FROM rust:1.97.0-bookworm AS build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler libprotobuf-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock build.rs ./
COPY proto ./proto
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /src/target/release/plentypay-ledger /app
USER nonroot:nonroot
EXPOSE 50061 9100
ENTRYPOINT ["/app"]
