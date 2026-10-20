//! Arranque del ledger: `ledger migrate` aplica las migraciones y termina; sin argumentos sirve
//! gRPC (:50061), administración (/healthz, /readyz, /metrics en :9100), el relay del outbox y
//! los jobs de expiración de holds (R9) e invariantes (R11). Apagado ordenado con SIGTERM.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::{http::StatusCode, routing::get, Router};
use plentypay_ledger::config::Config;
use plentypay_ledger::grpc::service::LedgerService;
use plentypay_ledger::observability::{self, Metrics};
use plentypay_ledger::pb;
use plentypay_ledger::store::PgLedger;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::watch;
use tonic::transport::Server;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Debug, thiserror::Error)]
enum StartupError {
    #[error(transparent)]
    Config(#[from] plentypay_ledger::config::ConfigError),
    #[error("database: {0}")]
    Db(#[from] sqlx::Error),
    #[error("migrate: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
    #[error(transparent)]
    Metrics(#[from] plentypay_ledger::observability::MetricsError),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("grpc: {0}")]
    Transport(#[from] tonic::transport::Error),
}

#[tokio::main]
async fn main() {
    observability::init_logging();
    if let Err(e) = run().await {
        tracing::error!(service = observability::SERVICE, err = %e, "startup failed");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), StartupError> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("healthcheck") {
        std::process::exit(if healthcheck().await { 0 } else { 1 });
    }
    if args.get(1).map(String::as_str) == Some("migrate") {
        let url = std::env::var("PP_MIGRATE_DSN")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .map_err(|_| plentypay_ledger::config::ConfigError::Missing("PP_MIGRATE_DSN"))?;
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(&url)
            .await?;
        MIGRATOR.run(&pool).await?;
        tracing::info!(service = observability::SERVICE, "migrate done");
        return Ok(());
    }

    let cfg = Config::from_env()?;
    let metrics = Arc::new(Metrics::new()?);
    let ready = Arc::new(AtomicBool::new(false));
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&cfg.database_url)
        .await?;
    let store = PgLedger::new(pool.clone());

    // Administración.
    let admin = {
        let metrics = metrics.clone();
        let ready = ready.clone();
        Router::new()
            .route("/healthz", get(|| async { "ok" }))
            .route(
                "/readyz",
                get(move || {
                    let ready = ready.clone();
                    async move {
                        if ready.load(Ordering::SeqCst) {
                            (StatusCode::OK, "ready")
                        } else {
                            (StatusCode::SERVICE_UNAVAILABLE, "starting")
                        }
                    }
                }),
            )
            .route(
                "/metrics",
                get(move || {
                    let metrics = metrics.clone();
                    async move { metrics.render() }
                }),
            )
    };
    let admin_listener =
        tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], cfg.admin_port))).await?;
    let mut admin_shutdown = shutdown_rx.clone();
    tokio::spawn(async move {
        let serve = axum::serve(admin_listener, admin).with_graceful_shutdown(async move {
            let _ = admin_shutdown.changed().await;
        });
        if let Err(e) = serve.await {
            tracing::error!(err = %e, "admin server failed");
        }
    });

    // Relay del outbox (ADR 0012).
    if !cfg.nats_url.is_empty() {
        match async_nats::ConnectOptions::new()
            .user_and_password(cfg.nats_user.clone(), cfg.nats_pass.clone())
            .connect(&cfg.nats_url)
            .await
        {
            Ok(client) => {
                let js = async_nats::jetstream::new(client);
                tokio::spawn(plentypay_ledger::events::run(
                    pool.clone(),
                    js,
                    shutdown_rx.clone(),
                ));
                tracing::info!(url = %cfg.nats_url, "outbox relay enabled");
            }
            Err(e) => tracing::error!(err = %e, "outbox relay disabled: nats connect failed"),
        }
    }

    // Jobs R9 (cada 30 s) y R11 (cada hora; el SPEC pide al menos uno diario).
    spawn_job(
        "expire_holds",
        Duration::from_secs(30),
        metrics.clone(),
        shutdown_rx.clone(),
        {
            let store = PgLedger::new(pool.clone());
            let metrics = metrics.clone();
            move || {
                let store = PgLedger::new(store.pool().clone());
                let metrics = metrics.clone();
                async move {
                    let n = store.expire_holds().await?;
                    metrics.holds_expired.inc_by(n);
                    Ok(())
                }
            }
        },
    );
    spawn_job(
        "invariants",
        Duration::from_secs(3600),
        metrics.clone(),
        shutdown_rx.clone(),
        {
            let pool = pool.clone();
            let metrics = metrics.clone();
            move || {
                let store = PgLedger::new(pool.clone());
                let metrics = metrics.clone();
                async move {
                    let violations = store.check_invariants().await?;
                    if violations > 0 {
                        metrics
                            .invariant_violations
                            .inc_by(u64::try_from(violations).unwrap_or(0));
                        tracing::error!(violations, "ledger invariant violations detected");
                    }
                    Ok(())
                }
            }
        },
    );

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.grpc_port));
    ready.store(true, Ordering::SeqCst);
    tracing::info!(service = observability::SERVICE, %addr, "service started");
    let mut grpc_shutdown = shutdown_rx.clone();
    let server = Server::builder()
        .add_service(pb::ledger_server::LedgerServer::new(LedgerService::new(
            store,
        )))
        .serve_with_shutdown(addr, async move {
            let _ = grpc_shutdown.changed().await;
        });
    tokio::spawn(async move {
        let mut term =
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(err = %e, "signal handler failed");
                    return;
                }
            };
        tokio::select! {
            _ = term.recv() => {}
            _ = tokio::signal::ctrl_c() => {}
        }
        tracing::info!("graceful shutdown started");
        let _ = shutdown_tx.send(true);
    });
    server.await?;
    pool.close().await;
    Ok(())
}

/// `GET /readyz` contra el puerto de administración (imagen distroless sin shell ni curl).
async fn healthcheck() -> bool {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let port = std::env::var("ADMIN_PORT").unwrap_or_else(|_| "9100".into());
    let probe = async {
        let mut s = tokio::net::TcpStream::connect(format!("127.0.0.1:{port}"))
            .await
            .ok()?;
        s.write_all(b"GET /readyz HTTP/1.0\r\nHost: localhost\r\n\r\n")
            .await
            .ok()?;
        let mut buf = [0u8; 16];
        let n = s.read(&mut buf).await.ok()?;
        Some(
            buf.get(..n)?.starts_with(b"HTTP/1.0 200")
                || buf.get(..n)?.starts_with(b"HTTP/1.1 200"),
        )
    };
    matches!(
        tokio::time::timeout(Duration::from_secs(2), probe).await,
        Ok(Some(true))
    )
}

/// Ejecuta un job periódico; cada fallo se registra una sola vez aquí (borde del bucle).
fn spawn_job<F, Fut>(
    name: &'static str,
    every: Duration,
    metrics: Arc<Metrics>,
    mut shutdown: watch::Receiver<bool>,
    job: F,
) where
    F: Fn() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<(), plentypay_ledger::store::StoreError>> + Send,
{
    tokio::spawn(async move {
        loop {
            if let Err(e) = job().await {
                metrics.job_failures.with_label_values(&[name]).inc();
                tracing::error!(job = name, err = %e, "job failed");
            }
            tokio::select! {
                _ = tokio::time::sleep(every) => {}
                _ = shutdown.changed() => return,
            }
        }
    });
}
