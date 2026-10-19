# syntax=docker/dockerfile:1
FROM rust:1.99-slim AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY proto ./proto
COPY build.rs ./
RUN cargo build --release 2>&1 | tail -5
FROM debian:bookworm-slim
COPY --from=build /src/target/release/plentypay-payments-core /app
EXPOSE 50062 9100
ENTRYPOINT ["/app"]
