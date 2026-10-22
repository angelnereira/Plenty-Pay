//! Pruebas L2 de payments-core contra servicios reales y efímeros (SPEC §12, F11.3/F11.5):
//! PostgreSQL (base `plentypay_l2_*`), ledger, identity e infra-management levantados por
//! `test/test_l2.sh`. Nada aquí toca la base `plentypay` ni los contenedores en servicio.
//! Se ejecutan con `--include-ignored`; sin `PP_PAYMENTS_TEST_DSN` no corren.
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::sync::Arc;
use std::time::Duration;

use plentypay_payments_core::clients::Clients;
use plentypay_payments_core::events::{apply_tenant_event, build_envelope};
use plentypay_payments_core::grpc::service::PaymentsService;
use plentypay_payments_core::observability::Metrics;
use plentypay_payments_core::pb;
use plentypay_payments_core::pb::identity::identity_client::IdentityClient;
use plentypay_payments_core::pb::ledger::ledger_client::LedgerClient;
use plentypay_payments_core::pb::payments_server::Payments;
use plentypay_payments_core::service::{PaymentsCore, PLATFORM_PARTY};
use plentypay_payments_core::store::{FrozenFees, PgPayments, SplitFees};
use prost::Message;
use sqlx::{PgPool, Row};
use tonic::transport::Channel;
use tonic::{Request, Status};
use tonic_types::StatusExt;
use uuid::Uuid;

use pb::ledger::AccountType as T;

struct Env {
    svc: PaymentsService,
    core: Arc<PaymentsCore>,
    store: PgPayments,
    pool: PgPool,
    ledger: LedgerClient<Channel>,
    identity: IdentityClient<Channel>,
}

fn var(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("{name} es obligatorio (test/test_l2.sh)"))
}

fn clients(ledger_addr: &str) -> Arc<Clients> {
    Arc::new(
        Clients::new(
            ledger_addr,
            &var("PP_TEST_IDENTITY_ADDR"),
            &var("PP_TEST_INFRA_ADDR"),
            Duration::from_secs(2),
            Duration::from_secs(2),
        )
        .unwrap(),
    )
}

async fn env() -> Env {
    let dsn = var("PP_PAYMENTS_TEST_DSN");
    let db = dsn
        .rsplit('/')
        .next()
        .unwrap_or("")
        .split('?')
        .next()
        .unwrap_or("");
    assert!(
        db.starts_with("plentypay_l2_"),
        "las L2 solo corren contra una base efímera plentypay_l2_*"
    );
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(8)
        .connect(&dsn)
        .await
        .unwrap();
    let store = PgPayments::new(pool.clone());
    let metrics = Arc::new(Metrics::new().unwrap());
    let core = Arc::new(PaymentsCore::new(
        store.clone(),
        clients(&var("PP_TEST_LEDGER_ADDR")),
        metrics,
        Duration::from_secs(900),
    ));
    let ledger = LedgerClient::new(
        Channel::from_shared(var("PP_TEST_LEDGER_ADDR"))
            .unwrap()
            .connect_lazy(),
    );
    let identity = IdentityClient::new(
        Channel::from_shared(var("PP_TEST_IDENTITY_ADDR"))
            .unwrap()
            .connect_lazy(),
    );
    Env {
        svc: PaymentsService::new(core.clone()),
        core,
        store,
        pool,
        ledger,
        identity,
    }
}

// ── metadatos ───────────────────────────────────────────────────────────────────────────────

fn with_md<M>(
    msg: M,
    service: &str,
    user: Option<Uuid>,
    tenant: Option<Uuid>,
    perms: &str,
) -> Request<M> {
    let mut r = Request::new(msg);
    let m = r.metadata_mut();
    m.insert("x-pp-actor-service", service.parse().unwrap());
    if let Some(u) = user {
        m.insert("x-pp-user-id", u.to_string().parse().unwrap());
    }
    if let Some(t) = tenant {
        m.insert("x-pp-tenant-id", t.to_string().parse().unwrap());
    }
    m.insert("x-pp-permissions", perms.parse().unwrap());
    m.insert(
        "x-pp-request-id",
        format!("l2-{}", Uuid::new_v4()).parse().unwrap(),
    );
    r
}

/// Persona desde el gateway (permisos de núcleo de wallet).
fn person<M>(msg: M, user: Uuid) -> Request<M> {
    with_md(
        msg,
        "api-gateway",
        Some(user),
        None,
        "wallet:pay,wallet:read",
    )
}

fn merchant<M>(msg: M, user: Uuid, tenant: Uuid, perms: &str) -> Request<M> {
    with_md(msg, "api-gateway", Some(user), Some(tenant), perms)
}

fn platform<M>(msg: M) -> Request<M> {
    with_md(
        msg,
        "api-gateway",
        Some(Uuid::new_v4()),
        None,
        "platform:flags:manage",
    )
}

fn as_payments<M>(msg: M) -> Request<M> {
    let mut r = Request::new(msg);
    r.metadata_mut()
        .insert("x-pp-actor-service", "payments-core".parse().unwrap());
    r
}

fn reason(s: &Status) -> String {
    s.get_error_details()
        .error_info()
        .map(|i| i.reason.clone())
        .unwrap_or_default()
}

fn key() -> String {
    format!("l2-{}", Uuid::new_v4())
}

fn usd(amount_minor: i64) -> Option<pb::Money> {
    Some(pb::Money {
        amount_minor,
        currency: "USD".into(),
    })
}

// ── preparación con servicios reales ────────────────────────────────────────────────────────

/// Alta de negocio en identity (queda PENDING_REVIEW).
async fn business(e: &Env) -> Uuid {
    let n = Uuid::new_v4().as_u128();
    // RUC de persona jurídica sintético: 5–15 dígitos (identity R17), único por prueba.
    let ruc = format!("155{:06}-2-2023", n % 1_000_000);
    let r = e
        .identity
        .clone()
        .create_business(as_payments(pb::identity::CreateBusinessRequest {
            owner_email: format!("l2-{}@example.com", Uuid::new_v4().simple()),
            owner_password: "L2-Pagos-Seguros-2026!".into(),
            owner_full_name: "Comercio L2".into(),
            legal_name: format!("Comercio L2 {} S.A.", n % 100_000),
            trade_name: format!("Tienda L2 {}", n % 100_000),
            tax_id: ruc,
            dv: "2".into(),
            country: "PA".into(),
            idempotency_key: key(),
            primary_vertical: "retail".into(),
            branch_name: "Casa matriz".into(),
            ..Default::default()
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(
        r.success,
        "CreateBusiness: {} {}",
        r.reason, r.error_message
    );
    Uuid::parse_str(&r.tenant.unwrap().tenant_id).unwrap()
}

/// Negocio aprobado (ACTIVE) con su política de comisión propia (pct 250, ITBMS 700, MERCHANT).
async fn active_merchant(e: &Env) -> Uuid {
    let t = business(e).await;
    e.identity
        .clone()
        .review_business(as_payments(pb::identity::ReviewBusinessRequest {
            tenant_id: t.to_string(),
            approve: true,
            notes: "L2".into(),
            idempotency_key: key(),
        }))
        .await
        .unwrap();
    policy(e, t, 250, 700, 1).await;
    t
}

async fn policy(e: &Env, tenant: Uuid, pct: i32, tax: i32, bearer: i32) -> pb::FeePolicy {
    e.svc
        .upsert_fee_policy(platform(pb::UpsertFeePolicyRequest {
            policy: Some(pb::FeePolicy {
                tenant_id: tenant.to_string(),
                rail: 1,
                percentage_bps: pct,
                tax_rate_bps: tax,
                bearer,
                active: true,
                effective_from: Some(prost_types::Timestamp {
                    seconds: 0,
                    nanos: 0,
                }),
                ..Default::default()
            }),
            idempotency_key: key(),
        }))
        .await
        .unwrap()
        .into_inner()
}

fn account(party: &str, t: T) -> pb::ledger::AccountRef {
    pb::ledger::AccountRef {
        party_id: party.into(),
        r#type: t as i32,
        currency: "USD".into(),
        scope_id: String::new(),
    }
}

/// Recarga real en el ledger (T1), como la hará el riel de recargas.
async fn fund(e: &Env, user: Uuid, amount: i64) {
    let entry = |party: &str, t: T, side: pb::ledger::EntrySide| pb::ledger::EntryInput {
        account: Some(account(party, t)),
        side: side as i32,
        amount_minor: amount,
    };
    e.ledger
        .clone()
        .post_transaction(as_payments(pb::ledger::PostTransactionRequest {
            idempotency_key: format!("topup:{}", Uuid::new_v4()),
            transaction_type: "WALLET_TOPUP".into(),
            reference: Some(pb::Reference {
                r#type: "topup".into(),
                id: Uuid::new_v4().to_string(),
            }),
            currency: "USD".into(),
            entries: vec![
                entry(
                    PLATFORM_PARTY,
                    T::RailReceivable,
                    pb::ledger::EntrySide::Debit,
                ),
                entry(&user.to_string(), T::Wallet, pb::ledger::EntrySide::Credit),
            ],
            ..Default::default()
        }))
        .await
        .unwrap();
}

async fn balance(e: &Env, party: &str, t: T) -> pb::ledger::Balance {
    e.ledger
        .clone()
        .get_balance(as_payments(pb::ledger::GetBalanceRequest {
            account: Some(account(party, t)),
        }))
        .await
        .unwrap()
        .into_inner()
}

async fn ledger_txs_for(e: &Env, payment_id: &str) -> usize {
    e.ledger
        .clone()
        .list_transactions(as_payments(pb::ledger::ListTransactionsRequest {
            reference: Some(pb::Reference {
                r#type: "payment".into(),
                id: payment_id.into(),
            }),
            ..Default::default()
        }))
        .await
        .unwrap()
        .into_inner()
        .transactions
        .len()
}

async fn terminal(e: &Env, tenant: Uuid) -> pb::Terminal {
    e.svc
        .create_terminal(merchant(
            pb::CreateTerminalRequest {
                label: "Caja 1".into(),
                idempotency_key: key(),
            },
            Uuid::new_v4(),
            tenant,
            "payments:terminal:manage",
        ))
        .await
        .unwrap()
        .into_inner()
}

fn intent_req(code: &str, amount: i64) -> pb::CreatePaymentIntentRequest {
    pb::CreatePaymentIntentRequest {
        idempotency_key: key(),
        amount: usd(amount),
        rail: 1,
        terminal_code: code.into(),
        ..Default::default()
    }
}

async fn pay_intent(e: &Env, payer: Uuid, code: &str, amount: i64) -> pb::PaymentIntent {
    e.svc
        .create_payment_intent(person(intent_req(code, amount), payer))
        .await
        .unwrap()
        .into_inner()
}

async fn confirm(e: &Env, payer: Uuid, intent: &str, k: &str) -> Result<pb::PaymentIntent, Status> {
    e.svc
        .confirm_payment_intent(person(
            pb::ConfirmPaymentIntentRequest {
                payment_intent_id: intent.into(),
                idempotency_key: k.into(),
                ..Default::default()
            },
            payer,
        ))
        .await
        .map(|r| r.into_inner())
}

async fn service_count(p: &PgPool, sql: &str, bind: &str) -> i64 {
    let mut tx = p.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let n: i64 = sqlx::query_scalar(sql)
        .bind(bind)
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    n
}

const CAPTURED: i32 = 5;
const FAILED: i32 = 6;
const CANCELLED: i32 = 7;
const EXPIRED: i32 = 8;
const UNKNOWN: i32 = 9;

// ── SPEC §12 prueba de aceptación 1 (F11.3) ─────────────────────────────────────────────────

/// Pago wallet de 25.00 USD de A al comercio M: saldo A −2500, MERCHANT_PAYABLE(M) + neto,
/// PLATFORM_FEES + comisión, TAX_PAYABLE + ITBMS; un solo asiento aunque Confirm se llame 3 veces
/// con la misma clave; un solo `PaymentCaptured` en el outbox.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_3_acceptance_1_wallet_payment_posts_t3_once() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 10_000).await;
    let fees_before = balance(&e, PLATFORM_PARTY, T::PlatformFees)
        .await
        .posted_minor;

    let intent = pay_intent(&e, a, &code, 2_500).await;
    assert_eq!(intent.status, 1);
    assert!(
        intent.sandbox,
        "N-AML-01: sin wallet.real_money la wallet es sandbox"
    );
    let k = key();
    let mut last = None;
    for _ in 0..3 {
        last = Some(confirm(&e, a, &intent.payment_intent_id, &k).await.unwrap());
    }
    let done = last.unwrap();
    assert_eq!(done.status, CAPTURED);

    // pf = half_up(2500, 250) = 63; tax = half_up(63, 700) = 4; neto = 2500 − 63 − 4 = 2433.
    let wa = balance(&e, &a.to_string(), T::Wallet).await;
    assert_eq!(
        (wa.posted_minor, wa.held_minor, wa.available_minor),
        (7_500, 0, 7_500)
    );
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        2_433
    );
    let fees_after = balance(&e, PLATFORM_PARTY, T::PlatformFees)
        .await
        .posted_minor;
    assert!(fees_after - fees_before >= 63);

    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
    assert_eq!(
        service_count(&e.pool, "SELECT count(*) FROM payments.outbox WHERE aggregate_id = $1 AND event_type = 'pp.payments.payment.captured.v1'", &done.payment_id).await,
        1
    );
    let p = e
        .svc
        .get_payment(merchant(
            pb::GetPaymentRequest {
                payment_id: done.payment_id.clone(),
            },
            Uuid::new_v4(),
            m,
            "payments:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(p.ledger_status, 2, "LedgerPostingStatus POSTED");
    assert_eq!(p.captured.unwrap().amount_minor, 2_500);
    let f = p.fees.unwrap();
    assert_eq!(f.merchant_net.unwrap().amount_minor, 2_433);
    let lines: i64 = f
        .lines
        .iter()
        .map(|l| l.amount.clone().unwrap().amount_minor)
        .sum();
    assert_eq!(f.gross.unwrap().amount_minor, 2_433 + lines);
    assert_eq!(p.attempts.len(), 1);
    assert_eq!(p.attempts[0].status, 4, "AttemptStatus CAPTURED");
}

/// 20 confirmaciones concurrentes del mismo intent con la misma clave: un solo asiento.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r9_concurrent_confirms_post_exactly_once() {
    let e = Arc::new(env().await);
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 5_000).await;
    let intent = pay_intent(&e, a, &code, 1_000).await;
    let k = key();
    let mut tasks = Vec::new();
    for _ in 0..20 {
        let (e, id, k) = (e.clone(), intent.payment_intent_id.clone(), k.clone());
        tasks.push(tokio::spawn(async move { confirm(&e, a, &id, &k).await }));
    }
    let mut payment_id = String::new();
    for t in tasks {
        if let Ok(Ok(i)) = t.await {
            if i.status == CAPTURED {
                payment_id = i.payment_id;
            }
        }
    }
    assert!(!payment_id.is_empty());
    assert_eq!(ledger_txs_for(&e, &payment_id).await, 1);
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        4_000
    );
}

/// 30 pagadores distintos pagan al mismo comercio a la vez: el comercio recibe la suma exacta.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r9_concurrent_payers_add_up_on_the_merchant() {
    let e = Arc::new(env().await);
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let mut tasks = Vec::new();
    for _ in 0..30 {
        let (e, code) = (e.clone(), code.clone());
        tasks.push(tokio::spawn(async move {
            let a = Uuid::new_v4();
            fund(&e, a, 1_000).await;
            let i = pay_intent(&e, a, &code, 1_000).await;
            confirm(&e, a, &i.payment_intent_id, &key())
                .await
                .unwrap()
                .status
        }));
    }
    for t in tasks {
        assert_eq!(t.await.unwrap(), CAPTURED);
    }
    // 1000: pf 25, tax 2, neto 973.
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        30 * 973
    );
}

// ── Reglas ──────────────────────────────────────────────────────────────────────────────────

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r1_create_intent_is_idempotent_and_detects_reuse() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    let req = intent_req(&code, 1_500);
    let first = e
        .svc
        .create_payment_intent(person(req.clone(), a))
        .await
        .unwrap()
        .into_inner();
    let again = e
        .svc
        .create_payment_intent(person(req.clone(), a))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(first.payment_intent_id, again.payment_intent_id);
    let mut other = req;
    other.amount = usd(1_600);
    let err = e
        .svc
        .create_payment_intent(person(other, a))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "IDEMPOTENCY_KEY_REUSED");
}

/// SPEC §12 prueba 5: un negocio PENDING_REVIEW no cobra (R2 por identity, sin proyección).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r2_acceptance_5_pending_review_tenant_cannot_charge() {
    let e = env().await;
    let t = business(&e).await;
    policy(&e, t, 250, 700, 1).await;
    let err = e
        .svc
        .create_payment_intent(merchant(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(1_000),
                rail: 1,
                ..Default::default()
            },
            Uuid::new_v4(),
            t,
            "payments:charge",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "TENANT_NOT_ACTIVE");
    let err = e
        .svc
        .create_terminal(merchant(
            pb::CreateTerminalRequest {
                label: "Caja".into(),
                idempotency_key: key(),
            },
            Uuid::new_v4(),
            t,
            "payments:terminal:manage",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "TENANT_NOT_ACTIVE");
}

/// R2: la proyección de TenantStatusChanged manda sobre identity y es idempotente por event_id.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r2_tenant_projection_suspends_charges() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let envelope = pb::EventEnvelope {
        event_id: Uuid::now_v7().to_string(),
        event_type: "identity.tenant.status_changed".into(),
        schema_version: 1,
        producer: "identity".into(),
        tenant_id: m.to_string(),
        aggregate_id: m.to_string(),
        occurred_at: Some(prost_types::Timestamp {
            seconds: chrono::Utc::now().timestamp(),
            nanos: 0,
        }),
        trace_id: String::new(),
        payload: Some(prost_types::Any {
            type_url: "type.googleapis.com/plentypay.identity.v1.TenantStatusChanged".into(),
            value: pb::identity::TenantStatusChanged {
                tenant_id: m.to_string(),
                status: 3,
                previous_status: 2,
            }
            .encode_to_vec(),
        }),
    }
    .encode_to_vec();
    assert!(apply_tenant_event(&e.store, &envelope).await.unwrap());
    assert!(
        !apply_tenant_event(&e.store, &envelope).await.unwrap(),
        "duplicado sin efecto"
    );
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&code, 1_000), Uuid::new_v4()))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "TENANT_NOT_ACTIVE");
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r3_fee_policy_missing_blocks_the_charge() {
    let e = env().await;
    let t = business(&e).await;
    e.identity
        .clone()
        .review_business(as_payments(pb::identity::ReviewBusinessRequest {
            tenant_id: t.to_string(),
            approve: true,
            notes: String::new(),
            idempotency_key: key(),
        }))
        .await
        .unwrap();
    let err = e
        .svc
        .create_payment_intent(merchant(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(1_000),
                rail: 1,
                ..Default::default()
            },
            Uuid::new_v4(),
            t,
            "payments:charge",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "FEE_POLICY_MISSING");
}

/// R3 vector C-err: el monto no cubre la comisión fija.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r3_amount_below_fees_is_rejected() {
    let e = env().await;
    let m = active_merchant(&e).await;
    e.svc
        .upsert_fee_policy(platform(pb::UpsertFeePolicyRequest {
            policy: Some(pb::FeePolicy {
                tenant_id: m.to_string(),
                rail: 1,
                fixed_fee_minor: 10,
                percentage_bps: 290,
                tax_rate_bps: 700,
                bearer: 1,
                active: true,
                effective_from: Some(prost_types::Timestamp {
                    seconds: 1,
                    nanos: 0,
                }),
                ..Default::default()
            }),
            idempotency_key: key(),
        }))
        .await
        .unwrap();
    let code = terminal(&e, m).await.public_code;
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&code, 10), Uuid::new_v4()))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "AMOUNT_BELOW_FEES");
}

/// R3 portador CUSTOMER (vector D): el pagador paga base + comisión + ITBMS y el comercio la base.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r3_customer_bearer_charges_the_payer() {
    let e = env().await;
    let m = active_merchant(&e).await;
    e.svc
        .upsert_fee_policy(platform(pb::UpsertFeePolicyRequest {
            policy: Some(pb::FeePolicy {
                tenant_id: m.to_string(),
                rail: 1,
                fixed_fee_minor: 10,
                percentage_bps: 250,
                tax_rate_bps: 700,
                bearer: 2,
                active: true,
                effective_from: Some(prost_types::Timestamp {
                    seconds: 2,
                    nanos: 0,
                }),
                ..Default::default()
            }),
            idempotency_key: key(),
        }))
        .await
        .unwrap();
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 6_000).await;
    let i = pay_intent(&e, a, &code, 5_000).await;
    assert_eq!(
        confirm(&e, a, &i.payment_intent_id, &key())
            .await
            .unwrap()
            .status,
        CAPTURED
    );
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        6_000 - 5_144
    );
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        5_000
    );
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r4_splits_must_add_up_to_the_amount() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let err = e
        .svc
        .create_payment_intent(merchant(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(1_000),
                rail: 1,
                splits: vec![pb::Split {
                    merchant_party_id: m.to_string(),
                    amount: usd(900),
                    reference: None,
                }],
                ..Default::default()
            },
            Uuid::new_v4(),
            m,
            "payments:charge",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "SPLITS_MISMATCH");
}

/// R5: ≥ umbral de infra-management (`stepup.threshold_minor`) exige step-up; un token que identity
/// no reconoce es STEP_UP_INVALID.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r5_step_up_required_at_threshold() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&code, 10_000), a))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "STEP_UP_REQUIRED");
    let mut req = intent_req(&code, 10_000);
    req.step_up_token = "no-emitido-por-identity".into();
    let err = e
        .svc
        .create_payment_intent(person(req, a))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "STEP_UP_INVALID");
    // Por debajo del umbral no se pide.
    assert!(e
        .svc
        .create_payment_intent(person(intent_req(&code, 9_999), a))
        .await
        .is_ok());
}

/// R15: por encima de `limits.payment.max_minor` → AMOUNT_OUT_OF_RANGE (antes del step-up).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r15_amount_above_limit_is_rejected() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&code, 1_000_001), Uuid::new_v4()))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "AMOUNT_OUT_OF_RANGE");
}

/// R9: sin saldo → INSUFFICIENT_FUNDS; el pago queda FAILED, sin asiento ni retención, con
/// `PaymentFailed` en el outbox.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r9_insufficient_funds_fails_without_posting() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 500).await;
    let i = pay_intent(&e, a, &code, 1_000).await;
    let err = confirm(&e, a, &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "INSUFFICIENT_FUNDS");
    let after = e
        .svc
        .get_payment_intent(person(
            pb::GetPaymentIntentRequest {
                payment_intent_id: i.payment_intent_id.clone(),
            },
            a,
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(after.status, FAILED);
    let w = balance(&e, &a.to_string(), T::Wallet).await;
    assert_eq!((w.posted_minor, w.held_minor), (500, 0));
    assert_eq!(ledger_txs_for(&e, &after.payment_id).await, 0);
    assert_eq!(
        service_count(&e.pool, "SELECT count(*) FROM payments.outbox WHERE aggregate_id = $1 AND event_type = 'pp.payments.payment.failed.v1'", &after.payment_id).await,
        1
    );
    // Reintentar la misma confirmación devuelve el estado final; otra clave no reabre el intent.
    let again = confirm(&e, a, &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(reason(&again), "INVALID_STATE_TRANSITION");
}

/// R7: el ledger no responde → UNKNOWN (nunca FAILED). Cuando vuelve, el job lo resuelve a
/// CAPTURED con un solo asiento (SPEC §12 prueba 2 con el riel WALLET).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r7_ledger_down_goes_unknown_then_resolves_once() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 3_000).await;
    let i = pay_intent(&e, a, &code, 2_000).await;

    let down = PaymentsService::new(Arc::new(PaymentsCore::new(
        e.store.clone(),
        clients("http://127.0.0.1:1"),
        Arc::new(Metrics::new().unwrap()),
        Duration::from_secs(900),
    )));
    let k = key();
    let unknown = down
        .confirm_payment_intent(person(
            pb::ConfirmPaymentIntentRequest {
                payment_intent_id: i.payment_intent_id.clone(),
                idempotency_key: k.clone(),
                ..Default::default()
            },
            a,
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(unknown.status, UNKNOWN);
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        3_000
    );

    // Se adelanta la próxima consulta (en vez de esperar 30 s) y corre el job real.
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    sqlx::query("UPDATE payments.payments SET next_check_at = now() - interval '1 second' WHERE intent_id = $1::uuid")
        .bind(&i.payment_intent_id)
        .execute(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    e.core.resume_wallet_payments().await.unwrap();

    let done = confirm(&e, a, &i.payment_intent_id, &k).await.unwrap();
    assert_eq!(done.status, CAPTURED);
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        1_000
    );
    assert_eq!(
        service_count(&e.pool, "SELECT count(*) FROM payments.outbox WHERE aggregate_id = $1 AND event_type = 'pp.payments.payment.unknown.v1'", &done.payment_id).await,
        1
    );
}

/// R6/R9: caída entre "pago PROCESSING persistido" y la llamada al ledger: el job lo retoma.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r9_crash_after_processing_is_resumed_by_the_job() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 1_000).await;
    let i = pay_intent(&e, a, &code, 1_000).await;
    let fees = FrozenFees {
        fee_policy_id: Uuid::nil(),
        splits: vec![SplitFees {
            merchant_party_id: m,
            gross_minor: 1_000,
            platform_fee_minor: 25,
            tax_minor: 2,
            rail_fee_minor: 0,
            merchant_net_minor: 973,
            total_charged_minor: 1_000,
        }],
    };
    let k = key();
    e.store
        .start_payment(
            Uuid::parse_str(&i.payment_intent_id).unwrap(),
            a,
            &k,
            &fees,
            1_000,
            chrono::Utc::now(),
        )
        .await
        .unwrap();
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    sqlx::query("UPDATE payments.payments SET next_check_at = now() - interval '1 second' WHERE intent_id = $1::uuid")
        .bind(&i.payment_intent_id)
        .execute(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    e.core.resume_wallet_payments().await.unwrap();
    let done = confirm(&e, a, &i.payment_intent_id, &k).await.unwrap();
    assert_eq!(done.status, CAPTURED);
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        973
    );
}

/// R14: un intent vencido no se confirma y el job lo marca EXPIRED.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r14_expired_intent_cannot_be_confirmed() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 1_000).await;
    let mut req = intent_req(&code, 500);
    req.expires_in_seconds = 1;
    let i = e
        .svc
        .create_payment_intent(person(req, a))
        .await
        .unwrap()
        .into_inner();
    let other = {
        let mut r = intent_req(&code, 500);
        r.expires_in_seconds = 1;
        e.svc
            .create_payment_intent(person(r, a))
            .await
            .unwrap()
            .into_inner()
    };
    tokio::time::sleep(Duration::from_millis(1_500)).await;
    let err = confirm(&e, a, &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "INVALID_STATE_TRANSITION");
    e.core.expire_intents().await.unwrap();
    for id in [&i.payment_intent_id, &other.payment_intent_id] {
        let s = e
            .svc
            .get_payment_intent(person(
                pb::GetPaymentIntentRequest {
                    payment_intent_id: id.clone(),
                },
                a,
            ))
            .await
            .unwrap()
            .into_inner();
        assert_eq!(s.status, EXPIRED);
    }
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        1_000
    );
}

/// domain-model §8.1: el creador cancela un intent CREATED; ya no se puede confirmar.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn cancel_intent_then_confirm_is_invalid() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    let i = pay_intent(&e, a, &code, 700).await;
    let c = e
        .svc
        .cancel_payment_intent(person(
            pb::CancelPaymentIntentRequest {
                payment_intent_id: i.payment_intent_id.clone(),
                reason: String::new(),
                idempotency_key: key(),
            },
            a,
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(c.status, CANCELLED);
    let err = confirm(&e, a, &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "INVALID_STATE_TRANSITION");
}

/// Cobro creado por el comercio (`payments:charge`): lo paga quien lo confirma.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn merchant_created_intent_is_paid_by_the_confirmer() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let a = Uuid::new_v4();
    fund(&e, a, 2_000).await;
    let i = e
        .svc
        .create_payment_intent(merchant(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(1_200),
                rail: 1,
                reference: Some(pb::Reference {
                    r#type: "sale".into(),
                    id: "venta-l2-1".into(),
                }),
                ..Default::default()
            },
            Uuid::new_v4(),
            m,
            "payments:charge",
        ))
        .await
        .unwrap()
        .into_inner();
    assert!(i.payer_party_id.is_empty());
    let done = confirm(&e, a, &i.payment_intent_id, &key()).await.unwrap();
    assert_eq!(
        (done.status, done.payer_party_id.clone()),
        (CAPTURED, a.to_string())
    );
    let listed = e
        .svc
        .list_payments(merchant(
            pb::ListPaymentsRequest {
                reference: Some(pb::Reference {
                    r#type: "sale".into(),
                    id: "venta-l2-1".into(),
                }),
                ..Default::default()
            },
            Uuid::new_v4(),
            m,
            "payments:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(listed.payments.len(), 1);
}

/// F11.5 y R16: ResolveTerminal devuelve el nombre comercial verificado en identity; inactiva →
/// TERMINAL_INACTIVE; código inexistente → NOT_FOUND.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_5_resolve_terminal_shows_verified_name() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let t = terminal(&e, m).await;
    assert_eq!(t.public_code.len(), 22);
    let info = e
        .svc
        .resolve_terminal(person(
            pb::ResolveTerminalRequest {
                public_code: t.public_code.clone(),
            },
            Uuid::new_v4(),
        ))
        .await
        .unwrap()
        .into_inner();
    let tenant = e
        .identity
        .clone()
        .get_tenant(as_payments(pb::identity::GetTenantRequest {
            tenant_id: m.to_string(),
        }))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(info.merchant_name, tenant.trade_name);
    assert_eq!(info.label, "Caja 1");
    let owner = Uuid::new_v4();
    e.svc
        .set_terminal_active(merchant(
            pb::SetTerminalActiveRequest {
                terminal_id: t.terminal_id.clone(),
                active: false,
                idempotency_key: key(),
            },
            owner,
            m,
            "payments:terminal:manage",
        ))
        .await
        .unwrap();
    let err = e
        .svc
        .resolve_terminal(person(
            pb::ResolveTerminalRequest {
                public_code: t.public_code.clone(),
            },
            Uuid::new_v4(),
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "TERMINAL_INACTIVE");
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&t.public_code, 100), Uuid::new_v4()))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "TERMINAL_INACTIVE");
    let err = e
        .svc
        .resolve_terminal(person(
            pb::ResolveTerminalRequest {
                public_code: "noexiste-noexiste-000".into(),
            },
            Uuid::new_v4(),
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "NOT_FOUND");
    let listed = e
        .svc
        .list_terminals(merchant(
            pb::ListTerminalsRequest::default(),
            owner,
            m,
            "payments:terminal:manage",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(listed.terminals.len(), 1);
}

/// ADR 0011: el actor sale de los metadatos. Otro pagador no ve ni confirma un intent ajeno; sin
/// permiso no se cobra.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn adr0011_actor_comes_from_metadata() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    let i = pay_intent(&e, a, &code, 300).await;
    let err = confirm(&e, Uuid::new_v4(), &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "NOT_FOUND");
    let err = e
        .svc
        .create_payment_intent(with_md(
            intent_req(&code, 300),
            "api-gateway",
            Some(a),
            None,
            "wallet:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "PERMISSION_DENIED");
    let err = e
        .svc
        .create_payment_intent(merchant(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(300),
                rail: 1,
                ..Default::default()
            },
            a,
            m,
            "payments:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "PERMISSION_DENIED");
}

/// ADR 0014: un negocio no ve los pagos de otro (NOT_FOUND, RLS como segunda barrera).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn adr0014_tenant_cannot_read_another_tenants_payment() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let other = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 1_000).await;
    let i = pay_intent(&e, a, &code, 400).await;
    let done = confirm(&e, a, &i.payment_intent_id, &key()).await.unwrap();
    let err = e
        .svc
        .get_payment(merchant(
            pb::GetPaymentRequest {
                payment_id: done.payment_id.clone(),
            },
            Uuid::new_v4(),
            other,
            "payments:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "NOT_FOUND");
    let listed = e
        .svc
        .list_payments(merchant(
            pb::ListPaymentsRequest::default(),
            Uuid::new_v4(),
            other,
            "payments:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert!(listed
        .payments
        .iter()
        .all(|p| p.tenant_id == other.to_string()));
}

/// La base protege lo capturado aunque el código fallara: monto y comisiones congelados, sin DELETE.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r8_captured_payment_is_frozen_in_the_database() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 1_000).await;
    let i = pay_intent(&e, a, &code, 600).await;
    let done = confirm(&e, a, &i.payment_intent_id, &key()).await.unwrap();
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let err = sqlx::query("UPDATE payments.payments SET amount_minor = 1 WHERE id = $1::uuid")
        .bind(&done.payment_id)
        .execute(tx.as_mut())
        .await
        .unwrap_err();
    assert!(err.to_string().contains("is final"), "{err}");
    tx.rollback().await.unwrap();
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let err = sqlx::query("DELETE FROM payments.payments WHERE id = $1::uuid")
        .bind(&done.payment_id)
        .execute(tx.as_mut())
        .await
        .unwrap_err();
    assert!(err.to_string().contains("permission denied"), "{err}");
}

/// ADR 0012: cada fila del outbox se empaqueta como EventEnvelope con el mensaje del contrato.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn adr0012_outbox_rows_build_contract_envelopes() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    fund(&e, a, 1_000).await;
    let i = pay_intent(&e, a, &code, 800).await;
    let done = confirm(&e, a, &i.payment_intent_id, &key()).await.unwrap();
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let row = sqlx::query("SELECT id, event_type, tenant_id, aggregate_id, payload, created_at FROM payments.outbox WHERE aggregate_id = $1")
        .bind(&done.payment_id)
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let bytes = build_envelope(
        row.get("id"),
        &row.get::<String, _>("event_type"),
        &row.get::<String, _>("tenant_id"),
        &row.get::<String, _>("aggregate_id"),
        row.get("payload"),
        row.get("created_at"),
    )
    .unwrap();
    let env = pb::EventEnvelope::decode(bytes.as_slice()).unwrap();
    assert_eq!(
        (env.event_type.as_str(), env.producer.as_str()),
        ("payments.payment.captured", "payments-core")
    );
    let any = env.payload.unwrap();
    assert_eq!(
        any.type_url,
        "type.googleapis.com/plentypay.payments.v1.PaymentCaptured"
    );
    let ev = pb::PaymentCaptured::decode(any.value.as_slice()).unwrap();
    assert_eq!(
        (ev.payment_id, ev.tenant_id, ev.gross.unwrap().amount_minor),
        (done.payment_id, m.to_string(), 800)
    );
    assert_eq!(ev.splits.len(), 1);
}

/// QuoteFees aplica §4 sin persistir, con la política del negocio del contexto.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r3_quote_fees_matches_the_capture() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let q = e
        .svc
        .quote_fees(merchant(
            pb::QuoteFeesRequest {
                amount: usd(2_500),
                rail: 1,
            },
            Uuid::new_v4(),
            m,
            "payments:charge",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(q.merchant_net.unwrap().amount_minor, 2_433);
    let policies = e
        .svc
        .list_fee_policies(merchant(
            pb::ListFeePoliciesRequest::default(),
            Uuid::new_v4(),
            m,
            "payments:fees:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert!(policies
        .policies
        .iter()
        .all(|p| p.tenant_id == m.to_string() || p.tenant_id.is_empty()));
    assert!(!policies.policies.is_empty());
}

/// Lo que todavía no existe responde UNIMPLEMENTED y un webhook nunca se acepta (R12 fail-closed).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r12_webhooks_are_rejected_until_their_adapter_exists() {
    let e = env().await;
    let err = e
        .svc
        .handle_rail_webhook(with_md(
            pb::HandleRailWebhookRequest {
                rail: 2,
                raw_body: b"{}".to_vec(),
                headers: Default::default(),
            },
            "api-gateway",
            None,
            None,
            "",
        ))
        .await
        .unwrap_err();
    assert_eq!(err.code(), tonic::Code::Unimplemented);
    let row = sqlx::query("SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'payments'")
        .fetch_one(&e.pool)
        .await
        .unwrap();
    assert!(row.get::<i64, _>("n") >= 10);
}

/// R5 vía gateway: el token llega en `x-pp-step-up` (cabecera `X-Step-Up-Token`), no en el cuerpo.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r5_step_up_token_from_metadata_is_consumed() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let mut req = person(intent_req(&code, 10_000), Uuid::new_v4());
    req.metadata_mut()
        .insert("x-pp-step-up", "no-emitido-por-identity".parse().unwrap());
    let err = e.svc.create_payment_intent(req).await.unwrap_err();
    assert_eq!(reason(&err), "STEP_UP_INVALID");
}

// ── F11.7: rieles externos sandbox, recargas (T1), cobros externos (T2) y UNKNOWN ───────────────

const YAPPY: i32 = 2;

fn topup_req(amount: i64, rail: i32) -> pb::CreatePaymentIntentRequest {
    pb::CreatePaymentIntentRequest {
        idempotency_key: key(),
        amount: usd(amount),
        rail,
        reference: Some(pb::Reference {
            r#type: "topup".into(),
            id: String::new(),
        }),
        ..Default::default()
    }
}

fn topper<M>(msg: M, user: Uuid) -> Request<M> {
    with_md(
        msg,
        "api-gateway",
        Some(user),
        None,
        "wallet:topup,wallet:read,wallet:pay",
    )
}

/// Crea y confirma una recarga; devuelve el intent tras confirmar.
async fn topup(e: &Env, user: Uuid, amount: i64) -> pb::PaymentIntent {
    let i = e
        .svc
        .create_payment_intent(topper(topup_req(amount, YAPPY), user))
        .await
        .unwrap()
        .into_inner();
    e.svc
        .confirm_payment_intent(topper(
            pb::ConfirmPaymentIntentRequest {
                payment_intent_id: i.payment_intent_id,
                idempotency_key: key(),
                ..Default::default()
            },
            user,
        ))
        .await
        .unwrap()
        .into_inner()
}

async fn due_now(e: &Env, payment_id: &str) {
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    sqlx::query("UPDATE payments.payments SET next_check_at = now() - interval '1 second' WHERE id = $1::uuid")
        .bind(payment_id)
        .execute(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
}

/// R10/T1: la recarga aprobada por el riel acredita la wallet una sola vez (asiento `topup:<id>`).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_7_topup_credits_the_wallet_exactly_once() {
    let e = env().await;
    let u = Uuid::new_v4();
    let done = topup(&e, u, 5_000).await;
    assert_eq!(done.status, CAPTURED);
    assert!(done.sandbox, "R13: riel sin credenciales = sandbox");
    assert_eq!(
        balance(&e, &u.to_string(), T::Wallet).await.posted_minor,
        5_000
    );
    e.core.post_pending().await.unwrap();
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
    let p = e
        .store
        .payment(
            &plentypay_payments_core::store::Scope::service(),
            Uuid::parse_str(&done.payment_id).unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(p.ledger_posting, 2, "LedgerPostingStatus POSTED");
    assert_eq!(
        service_count(&e.pool, "SELECT count(*) FROM payments.outbox WHERE aggregate_id = $1 AND event_type = 'pp.payments.payment.captured.v1'", &done.payment_id).await,
        1
    );
}

/// SPEC §12 prueba de aceptación 2: el riel no responde → UNKNOWN (sin saldo); el job consulta,
/// lo resuelve a CAPTURED y se asienta una sola vez.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_7_acceptance_2_rail_timeout_unknown_then_captured_once() {
    let e = env().await;
    let u = Uuid::new_v4();
    let i = topup(&e, u, 1_013).await;
    assert_eq!(i.status, UNKNOWN);
    assert_eq!(balance(&e, &u.to_string(), T::Wallet).await.posted_minor, 0);
    due_now(&e, &i.payment_id).await;
    e.core.resume_external_payments().await.unwrap();
    e.core.post_pending().await.unwrap();
    e.core.resume_external_payments().await.unwrap();
    let after = e
        .svc
        .get_payment_intent(topper(
            pb::GetPaymentIntentRequest {
                payment_intent_id: i.payment_intent_id,
            },
            u,
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(after.status, CAPTURED);
    assert_eq!(
        balance(&e, &u.to_string(), T::Wallet).await.posted_minor,
        1_013
    );
    assert_eq!(ledger_txs_for(&e, &i.payment_id).await, 1);
}

/// R7: un rechazo del riel es FAILED sin asiento; un riel sin flag está deshabilitado (R17).
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r17_declined_and_disabled_rails() {
    let e = env().await;
    let u = Uuid::new_v4();
    let i = topup(&e, u, 1_066).await;
    assert_eq!(i.status, FAILED);
    assert_eq!(ledger_txs_for(&e, &i.payment_id).await, 0);
    let err = e
        .svc
        .create_payment_intent(topper(topup_req(1_000, 4), u))
        .await
        .unwrap_err();
    assert_eq!(
        reason(&err),
        "RAIL_DISABLED",
        "CARD no tiene flag hasta tener PSP"
    );
    let err = e
        .svc
        .create_payment_intent(topper(topup_req(1_000, 1), u))
        .await
        .unwrap_err();
    assert_eq!(
        reason(&err),
        "INVALID_REFERENCE",
        "una recarga no sale de la wallet"
    );
    let err = e
        .svc
        .create_payment_intent(person(topup_req(1_000, YAPPY), u))
        .await
        .unwrap_err();
    assert_eq!(
        reason(&err),
        "PERMISSION_DENIED",
        "recargar exige wallet:topup"
    );
}

/// T2: cobro a un comercio por riel externo: MERCHANT_PAYABLE + neto, comisión e ITBMS, asiento
/// `PAYMENT_CAPTURE` único; la recarga y el cobro aparecen en el extracto como movimientos reales.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_7_external_rail_payment_posts_t2() {
    let e = env().await;
    let m = active_merchant(&e).await;
    // Política del comercio para el riel (la de active_merchant es solo de WALLET).
    e.svc
        .upsert_fee_policy(platform(pb::UpsertFeePolicyRequest {
            policy: Some(pb::FeePolicy {
                tenant_id: m.to_string(),
                rail: YAPPY,
                percentage_bps: 250,
                tax_rate_bps: 700,
                bearer: 1,
                active: true,
                effective_from: Some(prost_types::Timestamp {
                    seconds: 0,
                    nanos: 0,
                }),
                ..Default::default()
            }),
            idempotency_key: key(),
        }))
        .await
        .unwrap();
    let code = terminal(&e, m).await.public_code;
    let a = Uuid::new_v4();
    let mut req = intent_req(&code, 2_500);
    req.rail = YAPPY;
    let i = e
        .svc
        .create_payment_intent(person(req, a))
        .await
        .unwrap()
        .into_inner();
    assert!(i.sandbox);
    let done = confirm(&e, a, &i.payment_intent_id, &key()).await.unwrap();
    assert_eq!(done.status, CAPTURED);
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        2_433
    );
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.posted_minor,
        0,
        "no sale de la wallet"
    );
}

/// domain-model §6.3 paso 5: resolución manual con evidencia, solo plataforma.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_7_resolve_unknown_requires_evidence_and_platform() {
    let e = env().await;
    let u = Uuid::new_v4();
    let i = topup(&e, u, 2_099).await;
    assert_eq!(i.status, UNKNOWN);
    let resolve = |evidence: &str, perms: &str| {
        with_md(
            pb::ResolveUnknownPaymentRequest {
                payment_id: i.payment_id.clone(),
                resolution: CAPTURED,
                evidence: evidence.into(),
                idempotency_key: key(),
            },
            "api-gateway",
            Some(Uuid::new_v4()),
            None,
            perms,
        )
    };
    let err = e
        .svc
        .resolve_unknown_payment(resolve("", "platform:reconcile"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "EVIDENCE_REQUIRED");
    let err = e
        .svc
        .resolve_unknown_payment(resolve("extracto 2026-10-20 línea 4", "payments:read"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "PERMISSION_DENIED");
    let p = e
        .svc
        .resolve_unknown_payment(resolve("extracto 2026-10-20 línea 4", "platform:reconcile"))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(p.status, CAPTURED);
    assert_eq!(
        balance(&e, &u.to_string(), T::Wallet).await.posted_minor,
        2_099
    );
    assert_eq!(ledger_txs_for(&e, &i.payment_id).await, 1);
}

/// La cadena completa del dinero: recargar acredita, pagar debita y ambos quedan en el extracto
/// de la persona; el comercio ve el cobro en su lista y en su saldo por liquidar.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn chain_topup_then_pay_is_consistent_everywhere() {
    let e = env().await;
    let m = active_merchant(&e).await;
    let code = terminal(&e, m).await.public_code;
    let u = Uuid::new_v4();
    assert_eq!(topup(&e, u, 3_000).await.status, CAPTURED);
    let i = pay_intent(&e, u, &code, 1_000).await;
    let paid = confirm(&e, u, &i.payment_intent_id, &key()).await.unwrap();
    assert_eq!(paid.status, CAPTURED);
    let stmt = e
        .ledger
        .clone()
        .get_statement(as_payments(pb::ledger::GetStatementRequest {
            account: Some(account(&u.to_string(), T::Wallet)),
            range: Some(pb::TimeRange {
                from: Some(prost_types::Timestamp {
                    seconds: chrono::Utc::now().timestamp() - 3_600,
                    nanos: 0,
                }),
                to: None,
            }),
            page: None,
        }))
        .await
        .unwrap()
        .into_inner();
    let kinds: Vec<_> = stmt
        .lines
        .iter()
        .map(|l| l.transaction_type.as_str())
        .collect();
    assert_eq!(kinds, vec!["WALLET_TOPUP", "WALLET_PAYMENT"]);
    assert_eq!(stmt.closing_balance_minor, 2_000);
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .posted_minor,
        973
    );
    let listed = e
        .svc
        .list_payments(merchant(
            pb::ListPaymentsRequest::default(),
            Uuid::new_v4(),
            m,
            "payments:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(listed.payments.len(), 1);
}

/// orders R3.4 (marketplace): orders crea el cobro a nombre del comprador, sin un comercio único,
/// con un split por comercio. Solo el
/// comprador lo confirma; cada comercio recibe su neto en MERCHANT_PAYABLE en un solo asiento.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn orders_marketplace_intent_splits_to_each_merchant_and_only_buyer_pays() {
    let e = env().await;
    let (a, b) = (active_merchant(&e).await, active_merchant(&e).await);
    let buyer = Uuid::new_v4();
    fund(&e, buyer, 20_000).await;
    let order_id = Uuid::new_v4().to_string();
    let split = |m: Uuid, amount: i64| pb::Split {
        merchant_party_id: m.to_string(),
        amount: usd(amount),
        reference: Some(pb::Reference {
            r#type: "sub_order".into(),
            id: Uuid::new_v4().to_string(),
        }),
    };
    let req = pb::CreatePaymentIntentRequest {
        idempotency_key: key(),
        amount: usd(5_000),
        rail: 1,
        splits: vec![split(a, 3_000), split(b, 2_000)],
        reference: Some(pb::Reference {
            r#type: "order".into(),
            id: order_id.clone(),
        }),
        ..Default::default()
    };
    // Sin splits: no hay a quién cobrar.
    let none = e
        .svc
        .create_payment_intent(with_md(
            pb::CreatePaymentIntentRequest {
                splits: vec![],
                idempotency_key: key(),
                ..req.clone()
            },
            "orders",
            Some(buyer),
            None,
            "",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&none), "SPLITS_MISMATCH");

    let i = e
        .svc
        .create_payment_intent(with_md(req.clone(), "orders", Some(buyer), None, ""))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(i.payer_party_id, buyer.to_string());
    // Reintento de orders con la misma clave: el mismo intent.
    let again = e
        .svc
        .create_payment_intent(with_md(req, "orders", Some(buyer), None, ""))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(again.payment_intent_id, i.payment_intent_id);

    // Otra persona no puede pagarlo.
    let stranger = Uuid::new_v4();
    fund(&e, stranger, 20_000).await;
    let err = confirm(&e, stranger, &i.payment_intent_id, &key())
        .await
        .unwrap_err();
    assert_eq!(err.code(), tonic::Code::NotFound);

    let done = confirm(&e, buyer, &i.payment_intent_id, &key())
        .await
        .unwrap();
    assert_eq!(done.status, CAPTURED);
    assert_eq!(
        balance(&e, &buyer.to_string(), T::Wallet)
            .await
            .available_minor,
        15_000
    );
    // Bajo el umbral de step-up del entorno (R5). A: 3000 − 75 − 5 = 2920 · B: 2000 − 50 − 4 = 1946
    // (half_up de domain-model §4, como el vector E sin comisión de riel).
    assert_eq!(
        balance(&e, &a.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        2_920
    );
    assert_eq!(
        balance(&e, &b.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        1_946
    );
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1);
}

// ── F11.6: reembolsos (R11, domain-model §4.4, T7) ──────────────────────────────────────────

fn refund_req(payment: &str, amount: i64, merchant: Option<Uuid>) -> pb::RefundPaymentRequest {
    pb::RefundPaymentRequest {
        payment_id: payment.into(),
        amount: if amount == 0 { None } else { usd(amount) },
        reason: "devolución L2".into(),
        idempotency_key: key(),
        merchant_party_id: merchant.map(|m| m.to_string()).unwrap_or_default(),
        ..Default::default()
    }
}

/// Reembolso de sistema (orders o pos): sin step-up, auditado por su clave.
async fn system_refund(e: &Env, req: pb::RefundPaymentRequest) -> Result<pb::Refund, Status> {
    e.svc
        .refund_payment(with_md(req, "orders", None, None, ""))
        .await
        .map(|r| r.into_inner())
}

/// Paga 40.00 con wallet al comercio (pct 250, ITBMS 700, MERCHANT): pf 100, tax 7, neto 3893.
async fn paid_4000(e: &Env) -> (Uuid, Uuid, pb::PaymentIntent) {
    let m = active_merchant(e).await;
    let payer = Uuid::new_v4();
    fund(e, payer, 10_000).await;
    let code = terminal(e, m).await.public_code;
    let i = pay_intent(e, payer, &code, 4_000).await;
    let done = confirm(e, payer, &i.payment_intent_id, &key())
        .await
        .unwrap();
    assert_eq!(done.status, CAPTURED);
    (m, payer, done)
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_6_partial_then_final_refund_returns_exact_fees() {
    let e = env().await;
    let (m, payer, p) = paid_4000(&e).await;
    // 10.00: pf_r = round(100·1000/4000) = 25 · tax_r = round(7·1000/4000) = 2 · debit 973.
    let mut req = refund_req(&p.payment_id, 1_000, None);
    let r1 = system_refund(&e, req.clone()).await.unwrap();
    assert_eq!(r1.status, 2, "SUCCEEDED");
    // R1: la misma clave devuelve el mismo reembolso y no asienta otra vez.
    let again = system_refund(&e, req.clone()).await.unwrap();
    assert_eq!(again.refund_id, r1.refund_id);
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        3_893 - 973
    );
    // El último (0 = remanente) usa el resto exacto: 75 de comisión y 5 de ITBMS.
    req.idempotency_key = key();
    req.amount = None;
    let r2 = system_refund(&e, req.clone()).await.unwrap();
    assert_eq!(r2.amount.unwrap().amount_minor, 3_000);
    assert_eq!(
        balance(&e, &m.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        0
    );
    assert_eq!(
        balance(&e, &payer.to_string(), T::Wallet)
            .await
            .available_minor,
        10_000
    );
    // Nada más por devolver.
    req.idempotency_key = key();
    req.amount = usd(1);
    let err = system_refund(&e, req).await.unwrap_err();
    assert_eq!(reason(&err), "REFUND_EXCEEDS_CAPTURED");
    // Un asiento T7 por reembolso, y un RefundSucceeded por cada uno.
    assert_eq!(
        service_count(&e.pool, "SELECT count(*) FROM payments.outbox WHERE event_type = 'pp.payments.refund.succeeded.v1' AND aggregate_id = $1", &p.payment_id).await,
        2
    );
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_6_marketplace_refund_only_touches_that_merchants_split() {
    let e = env().await;
    let (a, b) = (active_merchant(&e).await, active_merchant(&e).await);
    let buyer = Uuid::new_v4();
    fund(&e, buyer, 10_000).await;
    let split = |m: Uuid, amount: i64| pb::Split {
        merchant_party_id: m.to_string(),
        amount: usd(amount),
        reference: Some(pb::Reference {
            r#type: "sub_order".into(),
            id: Uuid::new_v4().to_string(),
        }),
    };
    let i = e
        .svc
        .create_payment_intent(with_md(
            pb::CreatePaymentIntentRequest {
                idempotency_key: key(),
                amount: usd(5_000),
                rail: 1,
                splits: vec![split(a, 3_000), split(b, 2_000)],
                reference: Some(pb::Reference {
                    r#type: "order".into(),
                    id: Uuid::new_v4().to_string(),
                }),
                ..Default::default()
            },
            "orders",
            Some(buyer),
            None,
            "",
        ))
        .await
        .unwrap()
        .into_inner();
    let p = confirm(&e, buyer, &i.payment_intent_id, &key())
        .await
        .unwrap();
    // Sin decir de qué comercio: el pago tiene dos splits.
    let err = system_refund(&e, refund_req(&p.payment_id, 0, None))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "REFUND_SPLIT_REQUIRED");
    // B rechazó su sub-pedido: se devuelve todo su split (1946 neto + 54 de comisiones).
    let r = system_refund(&e, refund_req(&p.payment_id, 0, Some(b)))
        .await
        .unwrap();
    assert_eq!((r.status, r.merchant_party_id.clone()), (2, b.to_string()));
    assert_eq!(
        balance(&e, &b.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        0
    );
    assert_eq!(
        balance(&e, &a.to_string(), T::MerchantPayable)
            .await
            .available_minor,
        2_920
    );
    assert_eq!(
        balance(&e, &buyer.to_string(), T::Wallet)
            .await
            .available_minor,
        7_000
    );
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_6_merchant_without_balance_cannot_refund() {
    let e = env().await;
    let (m, _payer, p) = paid_4000(&e).await;
    // El comercio ya retiró su saldo (T6b a su propia billetera).
    e.ledger
        .clone()
        .post_transaction(as_payments(pb::ledger::PostTransactionRequest {
            idempotency_key: format!("payout:{}", Uuid::new_v4()),
            transaction_type: "PAYOUT_TO_WALLET".into(),
            reference: Some(pb::Reference {
                r#type: "settlement_batch".into(),
                id: Uuid::new_v4().to_string(),
            }),
            currency: "USD".into(),
            entries: vec![
                pb::ledger::EntryInput {
                    account: Some(account(&m.to_string(), T::MerchantPayable)),
                    side: pb::ledger::EntrySide::Debit as i32,
                    amount_minor: 3_893,
                },
                pb::ledger::EntryInput {
                    account: Some(account(&m.to_string(), T::Wallet)),
                    side: pb::ledger::EntrySide::Credit as i32,
                    amount_minor: 3_893,
                },
            ],
            ..Default::default()
        }))
        .await
        .unwrap();
    let err = system_refund(&e, refund_req(&p.payment_id, 1_000, None))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "MERCHANT_BALANCE_INSUFFICIENT");
    assert_eq!(
        service_count(
            &e.pool,
            "SELECT count(*) FROM payments.refunds WHERE payment_id = $1::uuid AND status = 3",
            &p.payment_id
        )
        .await,
        1,
        "queda registrado como FAILED; nada se borra"
    );
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_6_r5_people_need_step_up_and_only_refund_their_own_split() {
    let e = env().await;
    let (m, _payer, p) = paid_4000(&e).await;
    let cashier = Uuid::new_v4();
    let err = e
        .svc
        .refund_payment(merchant(
            refund_req(&p.payment_id, 1_000, None),
            cashier,
            m,
            "payments:refund",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "STEP_UP_REQUIRED");
    assert_eq!(
        service_count(
            &e.pool,
            "SELECT count(*) FROM payments.refunds WHERE payment_id = $1::uuid",
            &p.payment_id
        )
        .await,
        0,
        "sin step-up no nace el reembolso"
    );
    let other = active_merchant(&e).await;
    let err = e
        .svc
        .refund_payment(merchant(
            refund_req(&p.payment_id, 1_000, None),
            cashier,
            other,
            "payments:refund",
        ))
        .await
        .unwrap_err();
    assert!(matches!(
        reason(&err).as_str(),
        "REFUND_SPLIT_REQUIRED" | "PERMISSION_DENIED" | "STEP_UP_REQUIRED"
    ));
    let err = e
        .svc
        .refund_payment(merchant(
            refund_req(&p.payment_id, 1_000, None),
            cashier,
            m,
            "payments:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "PERMISSION_DENIED");
}

#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn f11_6_refund_of_an_uncaptured_payment_is_rejected() {
    let e = env().await;
    let err = system_refund(&e, refund_req(&Uuid::new_v4().to_string(), 100, None))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "NOT_FOUND");
}

// ── F11.10: transferencias entre personas (R10, T4) y código personal para recibir ──────────

/// Persona registrada de verdad en identity (CUSTOMER): una transferencia exige que el
/// destinatario exista y esté activo.
async fn registered(e: &Env, full_name: &str) -> Uuid {
    let consent = |purpose: &str| pb::identity::ConsentGrant {
        purpose: purpose.into(),
        text_version: "l2-v1".into(),
        granted: true,
    };
    let r = e
        .identity
        .clone()
        .register(as_payments(pb::identity::RegisterRequest {
            email: format!("l2-p2p-{}@example.com", Uuid::new_v4().simple()),
            password: "L2-Transferencias-2026!".into(),
            full_name: full_name.into(),
            role: 4,
            consents: vec![
                consent("AGE_CONFIRMATION"),
                consent("TERMS"),
                consent("PRIVACY_DATA_PROCESSING"),
            ],
            ..Default::default()
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(r.success, "registro: {}", r.reason);
    Uuid::parse_str(&r.user_id).unwrap()
}

/// Persona con todos los permisos de núcleo de wallet, incluido enviar.
fn sender<M>(msg: M, user: Uuid) -> Request<M> {
    with_md(
        msg,
        "api-gateway",
        Some(user),
        None,
        "wallet:pay,wallet:read,wallet:transfer",
    )
}

async fn my_code(e: &Env, user: Uuid) -> pb::ReceiveCode {
    e.svc
        .get_my_receive_code(sender(pb::GetMyReceiveCodeRequest {}, user))
        .await
        .unwrap()
        .into_inner()
}

/// R10 · T4: A le envía 12.50 a B con el código personal de B. Tres confirmaciones con la misma
/// clave dejan un solo asiento P2P_TRANSFER; A baja exactamente 12.50 y B sube 12.50, sin
/// comisión. El código se resuelve como persona con nombre abreviado y se reutiliza mientras esté
/// vigente.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r10_transfer_moves_exact_amount_once_with_t4() {
    let e = env().await;
    let a = registered(&e, "Andrés Sánchez").await;
    let b = registered(&e, "Bárbara Rodríguez Pérez").await;
    fund(&e, a, 5_000).await;

    let code = my_code(&e, b).await;
    assert_eq!(code.display_name, "Bárbara P.");
    assert_eq!(code.link, format!("https://plentypay.app/t/{}", code.code));
    assert_eq!(my_code(&e, b).await.code, code.code, "vigente: el mismo código");

    let who = e
        .svc
        .resolve_terminal(sender(
            pb::ResolveTerminalRequest {
                public_code: code.code.clone(),
            },
            a,
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(
        (who.kind.as_str(), who.merchant_name.as_str()),
        ("PERSON", "Bárbara P.")
    );

    let intent = e
        .svc
        .create_payment_intent(sender(intent_req(&code.code, 1_250), a))
        .await
        .unwrap()
        .into_inner();
    let k = key();
    let mut last = None;
    for _ in 0..3 {
        last = Some(
            e.svc
                .confirm_payment_intent(sender(
                    pb::ConfirmPaymentIntentRequest {
                        payment_intent_id: intent.payment_intent_id.clone(),
                        idempotency_key: k.clone(),
                        ..Default::default()
                    },
                    a,
                ))
                .await
                .unwrap()
                .into_inner(),
        );
    }
    let done = last.unwrap();
    assert_eq!(done.status, CAPTURED);
    assert_eq!(
        balance(&e, &a.to_string(), T::Wallet).await.available_minor,
        3_750
    );
    assert_eq!(
        balance(&e, &b.to_string(), T::Wallet).await.available_minor,
        1_250
    );
    assert_eq!(ledger_txs_for(&e, &done.payment_id).await, 1, "un solo asiento T4");
}

/// R10: nadie se envía dinero a sí mismo; sin `wallet:transfer` no se envía; un código vencido
/// ya no resuelve ni sirve para enviar.
#[tokio::test]
#[ignore = "L2: test/test_l2.sh"]
async fn r10_transfer_rejects_self_missing_permission_and_expired_code() {
    let e = env().await;
    let a = registered(&e, "Ana López").await;
    let b = registered(&e, "Beto Díaz").await;
    fund(&e, a, 5_000).await;

    let own = my_code(&e, a).await;
    let err = e
        .svc
        .create_payment_intent(sender(intent_req(&own.code, 100), a))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "SELF_TRANSFER");

    let theirs = my_code(&e, b).await;
    let err = e
        .svc
        .create_payment_intent(person(intent_req(&theirs.code, 100), a))
        .await
        .unwrap_err();
    assert_eq!(err.code(), tonic::Code::PermissionDenied, "sin wallet:transfer");

    // Un código de B que ya venció (emitido hace 2 días). Los códigos no se modifican: el rol
    // del servicio solo puede leerlos e insertarlos.
    let expired = format!("vencido{}", Uuid::new_v4().simple());
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    sqlx::query("INSERT INTO payments.receive_codes (code, user_id, display_name, created_at, expires_at) VALUES ($1, $2, 'Beto D.', now() - interval '2 days', now() - interval '1 day')")
        .bind(&expired)
        .bind(b)
        .execute(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();

    let err = e
        .svc
        .create_payment_intent(sender(intent_req(&expired, 100), a))
        .await
        .unwrap_err();
    assert_eq!(err.code(), tonic::Code::NotFound, "código vencido");
    let err = e
        .svc
        .resolve_terminal(sender(
            pb::ResolveTerminalRequest {
                public_code: expired.clone(),
            },
            a,
        ))
        .await
        .unwrap_err();
    assert_eq!(err.code(), tonic::Code::NotFound);
    assert_eq!(my_code(&e, b).await.code, theirs.code, "el vigente sigue siendo el mismo");
}
