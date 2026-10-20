//! Pruebas L2 del ledger contra PostgreSQL real (SPEC §8, testing-strategy.md §1).
//!
//! AISLAMIENTO: esta máquina es producción. Estas pruebas solo corren con `ledger/test/test_l2.sh`,
//! que crea una base efímera `plentypay_l2_*`, la migra con `migrator_ledger` y conecta como
//! `ledger_svc` (RLS y sin DELETE, igual que el servicio). Se niegan a correr contra otra base.
//! Cada prueba usa partes nuevas (UUID v4), así que no dependen del orden.
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use plentypay_ledger::grpc::service::LedgerService;
use plentypay_ledger::pb::{self, ledger_server::Ledger};
use plentypay_ledger::store::PgLedger;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tonic::{Code, Request, Status};
use tonic_types::StatusExt;
use uuid::Uuid;

const PLATFORM: &str = "00000000-0000-0000-0000-000000000001";
const L2_ONLY: &str = "L2: corre con ledger/test/test_l2.sh (base efímera)";

use pb::AccountType as T;
use pb::EntrySide as S;

async fn pool() -> PgPool {
    let dsn = std::env::var("PP_LEDGER_TEST_DSN")
        .expect("PP_LEDGER_TEST_DSN (lo define ledger/test/test_l2.sh)");
    let db = dsn
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default();
    assert!(
        db.starts_with("plentypay_l2_"),
        "las pruebas L2 solo corren en una base efímera plentypay_l2_*, no en {db}"
    );
    PgPoolOptions::new()
        .max_connections(8)
        .connect(&dsn)
        .await
        .expect("conexión a la base efímera")
}

async fn svc() -> (LedgerService, PgPool) {
    let p = pool().await;
    (LedgerService::new(PgLedger::new(p.clone())), p)
}

fn as_service<M>(msg: M, service: &str) -> Request<M> {
    let mut r = Request::new(msg);
    r.metadata_mut()
        .insert("x-pp-actor-service", service.parse().unwrap());
    r
}

fn from_gateway<M>(msg: M, user_id: &str, tenant_id: &str, permissions: &str) -> Request<M> {
    let mut r = as_service(msg, "api-gateway");
    r.metadata_mut()
        .insert("x-pp-user-id", user_id.parse().unwrap());
    r.metadata_mut()
        .insert("x-pp-tenant-id", tenant_id.parse().unwrap());
    r.metadata_mut()
        .insert("x-pp-permissions", permissions.parse().unwrap());
    r
}

fn reason(s: &Status) -> String {
    s.get_error_details()
        .error_info()
        .map(|i| i.reason.clone())
        .unwrap_or_default()
}

fn acct(party: &str, t: T, currency: &str) -> pb::AccountRef {
    pb::AccountRef {
        party_id: party.into(),
        r#type: t as i32,
        currency: currency.into(),
        scope_id: String::new(),
    }
}

fn entry(party: &str, t: T, side: S, amount: i64) -> pb::EntryInput {
    pb::EntryInput {
        account: Some(acct(party, t, "USD")),
        side: side as i32,
        amount_minor: amount,
    }
}

fn key() -> String {
    Uuid::new_v4().to_string()
}

fn post_req(
    tx_type: &str,
    reference: &str,
    entries: Vec<pb::EntryInput>,
) -> pb::PostTransactionRequest {
    pb::PostTransactionRequest {
        idempotency_key: key(),
        tenant_id: String::new(),
        transaction_type: tx_type.into(),
        reference: Some(pb::Reference {
            r#type: "test".into(),
            id: reference.into(),
        }),
        currency: "USD".into(),
        description: String::new(),
        entries,
        effective_at: None,
    }
}

/// T1 recarga (domain-model §5.2): el riel debe a la plataforma, la billetera queda con fondos.
async fn top_up(s: &LedgerService, user: &str, amount: i64) -> pb::Transaction {
    let req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, amount),
            entry(user, T::Wallet, S::Credit, amount),
        ],
    );
    s.post_transaction(as_service(req, "payments-core"))
        .await
        .expect("recarga")
        .into_inner()
}

async fn balance(s: &LedgerService, a: pb::AccountRef) -> pb::Balance {
    s.get_balance(as_service(
        pb::GetBalanceRequest { account: Some(a) },
        "payments-core",
    ))
    .await
    .expect("saldo")
    .into_inner()
}

/// Cuenta filas como servicio (RLS exige `app.actor`).
async fn count(p: &PgPool, sql: &str, bind: &str) -> i64 {
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

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r1_unbalanced_transaction_is_rejected_and_nothing_is_written() {
    let (s, p) = svc().await;
    let (u1, u2) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u1, 5_000).await;
    let req = post_req(
        "P2P_TRANSFER",
        &key(),
        vec![
            entry(&u1, T::Wallet, S::Debit, 1_000),
            entry(&u2, T::Wallet, S::Credit, 999),
        ],
    );
    let k = req.idempotency_key.clone();
    let err = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(err.code(), Code::InvalidArgument);
    assert_eq!(reason(&err), "UNBALANCED_TRANSACTION");
    assert_eq!(
        count(
            &p,
            "SELECT count(*) FROM ledger.transactions WHERE idempotency_key = $1",
            &k
        )
        .await,
        0
    );
    assert_eq!(
        balance(&s, acct(&u1, T::Wallet, "USD")).await.posted_minor,
        5_000
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r2_non_positive_amount_is_rejected() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 0),
            entry(&u, T::Wallet, S::Credit, 0),
        ],
    );
    let err = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "INVALID_AMOUNT");
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r3_reversal_mirrors_the_original_and_only_once() {
    let (s, p) = svc().await;
    let u = Uuid::new_v4().to_string();
    let original = top_up(&s, &u, 2_500).await;
    let rev = s
        .reverse_transaction(as_service(
            pb::ReverseTransactionRequest {
                transaction_id: original.transaction_id.clone(),
                idempotency_key: key(),
                reason: "test".into(),
            },
            "payments-core",
        ))
        .await
        .expect("reverso")
        .into_inner();
    assert_eq!(rev.reversal_of, original.transaction_id);
    assert_eq!(
        balance(&s, acct(&u, T::Wallet, "USD")).await.posted_minor,
        0
    );
    let again = s
        .reverse_transaction(as_service(
            pb::ReverseTransactionRequest {
                transaction_id: original.transaction_id.clone(),
                idempotency_key: key(),
                reason: "test".into(),
            },
            "payments-core",
        ))
        .await
        .unwrap_err();
    assert_eq!(reason(&again), "ALREADY_REVERSED");
    let got = s
        .get_transaction(as_service(
            pb::GetTransactionRequest {
                transaction_id: original.transaction_id.clone(),
            },
            "payments-core",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(got.status, pb::TransactionStatus::Reversed as i32);

    // Segunda barrera: ni el rol del servicio puede editar ni borrar lo asentado.
    let mut tx = p.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let id = Uuid::parse_str(&original.transaction_id).unwrap();
    let edit = sqlx::query("UPDATE ledger.transactions SET description = 'x' WHERE id = $1")
        .bind(id)
        .execute(tx.as_mut())
        .await;
    assert!(edit.is_err(), "una transacción asentada no se edita");
    tx.rollback().await.unwrap();
    let mut tx = p.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let del = sqlx::query("DELETE FROM ledger.entries WHERE transaction_id = $1")
        .bind(id)
        .execute(tx.as_mut())
        .await;
    assert!(del.is_err(), "ledger_svc no tiene DELETE");
    tx.rollback().await.unwrap();
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r4_idempotent_replay_returns_the_original_and_reuse_with_other_content_fails() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 700),
            entry(&u, T::Wallet, S::Credit, 700),
        ],
    );
    let first = s
        .post_transaction(as_service(req.clone(), "payments-core"))
        .await
        .unwrap()
        .into_inner();
    let replay = s
        .post_transaction(as_service(req.clone(), "payments-core"))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(first.transaction_id, replay.transaction_id);
    assert_eq!(
        balance(&s, acct(&u, T::Wallet, "USD")).await.posted_minor,
        700,
        "el reintento no asienta dos veces"
    );
    let mut other = req;
    other.entries = vec![
        entry(PLATFORM, T::RailReceivable, S::Debit, 800),
        entry(&u, T::Wallet, S::Credit, 800),
    ];
    let err = s
        .post_transaction(as_service(other, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(err.code(), Code::AlreadyExists);
    assert_eq!(reason(&err), "IDEMPOTENCY_KEY_REUSED");
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r4_missing_idempotency_key_is_rejected() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let mut req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 1),
            entry(&u, T::Wallet, S::Credit, 1),
        ],
    );
    req.idempotency_key.clear();
    let err = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "IDEMPOTENCY_KEY_REQUIRED");
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r5_second_capture_of_the_same_payment_is_rejected() {
    let (s, _) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 10_000).await;
    let payment = key();
    let pay = || {
        post_req(
            "WALLET_PAYMENT",
            &payment,
            vec![
                entry(&u, T::Wallet, S::Debit, 1_000),
                entry(&merchant, T::MerchantPayable, S::Credit, 1_000),
            ],
        )
    };
    s.post_transaction(as_service(pay(), "payments-core"))
        .await
        .expect("primera captura");
    let err = s
        .post_transaction(as_service(pay(), "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "DUPLICATE_CAPTURE");
    assert_eq!(
        balance(&s, acct(&u, T::Wallet, "USD")).await.posted_minor,
        9_000
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r6_wallet_cannot_go_negative_counting_holds() {
    let (s, _) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 1_000).await;
    let hold = pb::CreateHoldRequest {
        idempotency_key: key(),
        account: Some(acct(&u, T::Wallet, "USD")),
        amount_minor: 600,
        reference: Some(pb::Reference {
            r#type: "test".into(),
            id: key(),
        }),
        ttl_seconds: 60,
    };
    s.create_hold(as_service(hold, "payments-core"))
        .await
        .expect("hold");
    // 1000 - 600 retenidos = 400 disponibles: un pago de 500 no cabe.
    let req = post_req(
        "WALLET_PAYMENT",
        &key(),
        vec![
            entry(&u, T::Wallet, S::Debit, 500),
            entry(&merchant, T::MerchantPayable, S::Credit, 500),
        ],
    );
    let err = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(err.code(), Code::FailedPrecondition);
    assert_eq!(reason(&err), "INSUFFICIENT_FUNDS");
    let b = balance(&s, acct(&u, T::Wallet, "USD")).await;
    assert_eq!(
        (b.posted_minor, b.held_minor, b.available_minor),
        (1_000, 600, 400)
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r7_crossed_transfers_do_not_deadlock_and_conserve_money() {
    // SPEC §11.4: 1 000 transferencias T4 cruzadas entre 10 billeteras en 50 tareas.
    let (s, _) = svc().await;
    let s = std::sync::Arc::new(s);
    let wallets: Vec<String> = (0..10).map(|_| Uuid::new_v4().to_string()).collect();
    for w in &wallets {
        top_up(&s, w, 100_000).await;
    }
    let wallets = std::sync::Arc::new(wallets);
    let mut tasks = Vec::new();
    for task in 0..50usize {
        let (s, wallets) = (s.clone(), wallets.clone());
        tasks.push(tokio::spawn(async move {
            for i in 0..20usize {
                let from = (task + i) % 10;
                let to = (task * 7 + i * 3 + 1) % 10;
                let to = if to == from { (to + 1) % 10 } else { to };
                let req = post_req(
                    "P2P_TRANSFER",
                    &key(),
                    vec![
                        entry(&wallets[from], T::Wallet, S::Debit, 37),
                        entry(&wallets[to], T::Wallet, S::Credit, 37),
                    ],
                );
                s.post_transaction(as_service(req, "payments-core")).await?;
            }
            Ok::<(), Status>(())
        }));
    }
    let run = async {
        for t in tasks {
            t.await.unwrap().expect("transferencia cruzada");
        }
    };
    tokio::time::timeout(std::time::Duration::from_secs(120), run)
        .await
        .expect("sin interbloqueo");
    let mut total = 0;
    for w in wallets.iter() {
        let b = balance(&s, acct(w, T::Wallet, "USD")).await;
        assert!(b.available_minor >= 0, "ninguna billetera negativa");
        total += b.posted_minor;
    }
    assert_eq!(total, 1_000_000);
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r8_shape_outside_the_template_is_rejected() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    top_up(&s, &u, 1_000).await;
    // Un P2P no puede acreditar comisiones de plataforma.
    let req = post_req(
        "P2P_TRANSFER",
        &key(),
        vec![
            entry(&u, T::Wallet, S::Debit, 10),
            entry(PLATFORM, T::PlatformFees, S::Credit, 10),
        ],
    );
    let err = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "UNKNOWN_TEMPLATE");
    let req = post_req(
        "FREE_MONEY",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 10),
            entry(&u, T::Wallet, S::Credit, 10),
        ],
    );
    assert_eq!(
        reason(
            &s.post_transaction(as_service(req, "payments-core"))
                .await
                .unwrap_err()
        ),
        "UNKNOWN_TEMPLATE"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r9_expired_hold_is_freed_and_cannot_be_captured() {
    let (s, p) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 1_000).await;
    let hold = pb::CreateHoldRequest {
        idempotency_key: key(),
        account: Some(acct(&u, T::Wallet, "USD")),
        amount_minor: 300,
        reference: Some(pb::Reference {
            r#type: "test".into(),
            id: key(),
        }),
        ttl_seconds: 1,
    };
    let h = s
        .create_hold(as_service(hold, "payments-core"))
        .await
        .unwrap()
        .into_inner();
    tokio::time::sleep(std::time::Duration::from_millis(1_200)).await;
    let expired = PgLedger::new(p.clone())
        .expire_holds()
        .await
        .expect("job de expiración");
    assert!(expired >= 1);
    let got = s
        .get_hold(as_service(
            pb::GetHoldRequest {
                hold_id: h.hold_id.clone(),
            },
            "payments-core",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(got.status, pb::HoldStatus::Expired as i32);
    assert_eq!(balance(&s, acct(&u, T::Wallet, "USD")).await.held_minor, 0);
    let cap = pb::CaptureHoldRequest {
        hold_id: h.hold_id.clone(),
        idempotency_key: key(),
        tenant_id: merchant.clone(),
        transaction_type: "WALLET_PAYMENT".into(),
        reference: Some(pb::Reference {
            r#type: "test".into(),
            id: key(),
        }),
        legs: vec![pb::CreditLeg {
            account: Some(acct(&merchant, T::MerchantPayable, "USD")),
            amount_minor: 300,
        }],
    };
    let err = s
        .capture_hold(as_service(cap, "payments-core"))
        .await
        .unwrap_err();
    assert_eq!(reason(&err), "HOLD_NOT_ACTIVE");
    // El cambio de estado sale por outbox (ADR 0012).
    assert!(count(&p, "SELECT count(*) FROM ledger.outbox WHERE event_type = 'pp.ledger.hold.status_changed.v1' AND aggregate_id = $1", &h.hold_id).await >= 2);
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r9_hold_requires_a_ttl() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let hold = pb::CreateHoldRequest {
        idempotency_key: key(),
        account: Some(acct(&u, T::Wallet, "USD")),
        amount_minor: 1,
        reference: None,
        ttl_seconds: 0,
    };
    assert_eq!(
        reason(
            &s.create_hold(as_service(hold, "payments-core"))
                .await
                .unwrap_err()
        ),
        "INVALID_HOLD_TTL"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r10_capture_is_atomic_debits_wallet_and_credits_legs() {
    let (s, p) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 1_000).await;
    let hold = pb::CreateHoldRequest {
        idempotency_key: key(),
        account: Some(acct(&u, T::Wallet, "USD")),
        amount_minor: 500,
        reference: Some(pb::Reference {
            r#type: "order".into(),
            id: key(),
        }),
        ttl_seconds: 60,
    };
    let h = s
        .create_hold(as_service(hold, "payments-core"))
        .await
        .unwrap()
        .into_inner();

    // Legs que no suman el monto retenido: nada cambia (ni hold ni saldos).
    let bad = pb::CaptureHoldRequest {
        hold_id: h.hold_id.clone(),
        idempotency_key: key(),
        tenant_id: merchant.clone(),
        transaction_type: "WALLET_PAYMENT".into(),
        reference: Some(pb::Reference {
            r#type: "payment".into(),
            id: key(),
        }),
        legs: vec![pb::CreditLeg {
            account: Some(acct(&merchant, T::MerchantPayable, "USD")),
            amount_minor: 499,
        }],
    };
    assert_eq!(
        reason(
            &s.capture_hold(as_service(bad, "payments-core"))
                .await
                .unwrap_err()
        ),
        "UNBALANCED_TRANSACTION"
    );
    let b = balance(&s, acct(&u, T::Wallet, "USD")).await;
    assert_eq!((b.posted_minor, b.held_minor), (1_000, 500));

    let payment = key();
    let ok = pb::CaptureHoldRequest {
        hold_id: h.hold_id.clone(),
        idempotency_key: key(),
        tenant_id: merchant.clone(),
        transaction_type: "WALLET_PAYMENT".into(),
        reference: Some(pb::Reference {
            r#type: "payment".into(),
            id: payment.clone(),
        }),
        legs: vec![
            pb::CreditLeg {
                account: Some(acct(&merchant, T::MerchantPayable, "USD")),
                amount_minor: 470,
            },
            pb::CreditLeg {
                account: Some(acct(PLATFORM, T::PlatformFees, "USD")),
                amount_minor: 30,
            },
        ],
    };
    let res = s
        .capture_hold(as_service(ok, "payments-core"))
        .await
        .expect("captura")
        .into_inner();
    assert_eq!(res.hold.unwrap().status, pb::HoldStatus::Captured as i32);
    let t = res.transaction.unwrap();
    let b = balance(&s, acct(&u, T::Wallet, "USD")).await;
    assert_eq!(
        (b.posted_minor, b.held_minor, b.available_minor),
        (500, 0, 500)
    );
    assert_eq!(
        balance(&s, acct(&merchant, T::MerchantPayable, "USD"))
            .await
            .posted_minor,
        470
    );
    // La transacción sale por outbox en la misma transacción SQL.
    assert_eq!(count(&p, "SELECT count(*) FROM ledger.outbox WHERE event_type = 'pp.ledger.transaction.posted.v1' AND aggregate_id = $1", &t.transaction_id).await, 1);
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r11_invariants_hold_after_mixed_activity() {
    let (s, p) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 3_000).await;
    let req = post_req(
        "WALLET_PAYMENT",
        &key(),
        vec![
            entry(&u, T::Wallet, S::Debit, 1_000),
            entry(&merchant, T::MerchantPayable, S::Credit, 950),
            entry(PLATFORM, T::PlatformFees, S::Credit, 50),
        ],
    );
    s.post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap();
    assert_eq!(
        PgLedger::new(p)
            .check_invariants()
            .await
            .expect("chequeo de invariantes"),
        0
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r12_amount_above_the_limit_is_rejected() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let big = 1_000_000_000_000_001;
    let req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, big),
            entry(&u, T::Wallet, S::Credit, big),
        ],
    );
    assert_eq!(
        reason(
            &s.post_transaction(as_service(req, "payments-core"))
                .await
                .unwrap_err()
        ),
        "INVALID_AMOUNT"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r13_effective_at_outside_the_window_is_rejected() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let mut req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 5),
            entry(&u, T::Wallet, S::Credit, 5),
        ],
    );
    let now = chrono::Utc::now().timestamp();
    req.effective_at = Some(prost_types::Timestamp {
        seconds: now + 600,
        nanos: 0,
    });
    assert_eq!(
        reason(
            &s.post_transaction(as_service(req.clone(), "payments-core"))
                .await
                .unwrap_err()
        ),
        "INVALID_EFFECTIVE_AT"
    );
    req.idempotency_key = key();
    req.effective_at = Some(prost_types::Timestamp {
        seconds: now - 36 * 86_400,
        nanos: 0,
    });
    assert_eq!(
        reason(
            &s.post_transaction(as_service(req, "payments-core"))
                .await
                .unwrap_err()
        ),
        "INVALID_EFFECTIVE_AT"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn adr0011_only_payments_core_and_settlement_write() {
    let (s, _) = svc().await;
    let u = Uuid::new_v4().to_string();
    let req = post_req(
        "WALLET_TOPUP",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 5),
            entry(&u, T::Wallet, S::Credit, 5),
        ],
    );
    let err = s
        .post_transaction(as_service(req.clone(), "api-gateway"))
        .await
        .unwrap_err();
    assert_eq!(err.code(), Code::PermissionDenied);
    assert_eq!(reason(&err), "PERMISSION_DENIED");
    assert_eq!(
        s.post_transaction(as_service(req, ""))
            .await
            .unwrap_err()
            .code(),
        Code::PermissionDenied
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn adr0014_a_person_reads_only_their_own_wallet() {
    let (s, _) = svc().await;
    let (me, other) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &me, 1_200).await;
    top_up(&s, &other, 900).await;
    let mine = s
        .get_balance(from_gateway(
            pb::GetBalanceRequest {
                account: Some(acct(&me, T::Wallet, "USD")),
            },
            &me,
            "",
            "wallet:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(mine.available_minor, 1_200);
    let theirs = s
        .get_balance(from_gateway(
            pb::GetBalanceRequest {
                account: Some(acct(&other, T::Wallet, "USD")),
            },
            &me,
            "",
            "wallet:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(
        theirs.code(),
        Code::NotFound,
        "una parte ajena no revela existencia"
    );
    let no_perm = s
        .get_balance(from_gateway(
            pb::GetBalanceRequest {
                account: Some(acct(&me, T::Wallet, "USD")),
            },
            &me,
            "",
            "",
        ))
        .await
        .unwrap_err();
    assert_eq!(no_perm.code(), Code::NotFound);
    let list = s
        .list_transactions(from_gateway(
            pb::ListTransactionsRequest {
                party_id: me.clone(),
                ..Default::default()
            },
            &me,
            "",
            "wallet:read",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(list.transactions.len(), 1);
    // Las retenciones solo las leen servicios.
    let h = s
        .create_hold(as_service(
            pb::CreateHoldRequest {
                idempotency_key: key(),
                account: Some(acct(&me, T::Wallet, "USD")),
                amount_minor: 10,
                reference: None,
                ttl_seconds: 60,
            },
            "payments-core",
        ))
        .await
        .unwrap()
        .into_inner();
    let err = s
        .get_hold(from_gateway(
            pb::GetHoldRequest { hold_id: h.hold_id },
            &me,
            "",
            "wallet:read",
        ))
        .await
        .unwrap_err();
    assert_eq!(err.code(), Code::NotFound);
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn statement_running_balance_matches_the_entries() {
    let (s, _) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 2_000).await;
    let req = post_req(
        "WALLET_PAYMENT",
        &key(),
        vec![
            entry(&u, T::Wallet, S::Debit, 750),
            entry(&merchant, T::MerchantPayable, S::Credit, 750),
        ],
    );
    s.post_transaction(as_service(req, "payments-core"))
        .await
        .unwrap();
    let now = chrono::Utc::now().timestamp();
    let range = pb::TimeRange {
        from: Some(prost_types::Timestamp {
            seconds: now - 3_600,
            nanos: 0,
        }),
        to: Some(prost_types::Timestamp {
            seconds: now + 60,
            nanos: 0,
        }),
    };
    let st = s
        .get_statement(as_service(
            pb::GetStatementRequest {
                account: Some(acct(&u, T::Wallet, "USD")),
                range: Some(range),
                page: None,
            },
            "payments-core",
        ))
        .await
        .unwrap()
        .into_inner();
    assert_eq!(st.opening_balance_minor, 0);
    assert_eq!(
        st.lines
            .iter()
            .map(|l| l.running_balance_minor)
            .collect::<Vec<_>>(),
        vec![2_000, 1_250]
    );
    assert_eq!(st.closing_balance_minor, 1_250);
}

#[test]
fn l2_marker_is_documented() {
    // Recordatorio para quien lea `cargo test`: las pruebas L2 aparecen como `ignored` a propósito.
    assert!(L2_ONLY.contains("test_l2.sh"));
}

// ── Casos de referencia (scripts/ledger-tests, rust-standards.md §9) ─────────────────────────────
// Segunda barrera: lo que el código ya impide, la base también lo rechaza aunque alguien con el
// rol del servicio escriba SQL directo.

/// Ejecuta SQL como el servicio en su propia transacción; confirma solo si no falla.
async fn exec_as_service(p: &PgPool, sql: &str) -> Result<u64, sqlx::Error> {
    let mut tx = p.begin().await?;
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await?;
    let n = sqlx::raw_sql(sql)
        .execute(tx.as_mut())
        .await?
        .rows_affected();
    tx.commit().await?;
    Ok(n)
}

async fn account_id(p: &PgPool, party: &str, t: T) -> Uuid {
    let mut tx = p.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let id: Uuid = sqlx::query_scalar("SELECT id FROM ledger.accounts WHERE party_id = $1::uuid AND account_type = $2 AND currency = 'USD' AND scope_id = ''")
        .bind(party)
        .bind(t as i16)
        .fetch_one(tx.as_mut())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    id
}

async fn draft(p: &PgPool, tx_type: &str, reference: &str) -> Uuid {
    let id = Uuid::new_v4();
    exec_as_service(
        p,
        &format!(
            "INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at)
             VALUES ('{id}', '{tx_type}', 'test', '{reference}', 'USD', 'DRAFT', '{}', '\\x00', now())",
            Uuid::new_v4()
        ),
    )
    .await
    .expect("borrador");
    id
}

async fn raw_entry(
    p: &PgPool,
    tx: Uuid,
    account: Uuid,
    side: &str,
    amount: i64,
    currency: &str,
) -> Result<u64, sqlx::Error> {
    exec_as_service(
        p,
        &format!("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ('{}', '{tx}', '{account}', '{side}', {amount}, '{currency}')", Uuid::new_v4()),
    )
    .await
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn ref_vector_payment_capture_100_00_splits_exactly() {
    // B/.100.00 -> comercio 97.86 | PlentyPay 0.50 | riel 1.50 | ITBMS 0.14 (domain-model §4.5).
    let (s, _) = svc().await;
    let merchant = Uuid::new_v4().to_string();
    let mut req = post_req(
        "PAYMENT_CAPTURE",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 10_000),
            entry(&merchant, T::MerchantPayable, S::Credit, 9_786),
            entry(PLATFORM, T::PlatformFees, S::Credit, 50),
            entry(PLATFORM, T::RailFeesPayable, S::Credit, 150),
            entry(PLATFORM, T::TaxPayable, S::Credit, 14),
        ],
    );
    req.tenant_id = merchant.clone();
    let t = s
        .post_transaction(as_service(req, "payments-core"))
        .await
        .expect("captura")
        .into_inner();
    let debits: i64 = t
        .entries
        .iter()
        .filter(|e| e.side == S::Debit as i32)
        .map(|e| e.amount_minor)
        .sum();
    let credits: i64 = t
        .entries
        .iter()
        .filter(|e| e.side == S::Credit as i32)
        .map(|e| e.amount_minor)
        .sum();
    assert_eq!((debits, credits), (10_000, 10_000));
    assert_eq!(
        balance(&s, acct(&merchant, T::MerchantPayable, "USD"))
            .await
            .posted_minor,
        9_786
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn ref_sql_balance_barriers() {
    let (s, p) = svc().await;
    let (u, merchant) = (Uuid::new_v4().to_string(), Uuid::new_v4().to_string());
    top_up(&s, &u, 10_000).await;
    let pay = post_req(
        "WALLET_PAYMENT",
        &key(),
        vec![
            entry(&u, T::Wallet, S::Debit, 1),
            entry(&merchant, T::MerchantPayable, S::Credit, 1),
        ],
    );
    s.post_transaction(as_service(pay, "payments-core"))
        .await
        .unwrap();
    let (wallet, payable) = (
        account_id(&p, &u, T::Wallet).await,
        account_id(&p, &merchant, T::MerchantPayable).await,
    );

    // DR != CR no pasa a POSTED.
    let unbal = draft(&p, "P2P_TRANSFER", &key()).await;
    raw_entry(&p, unbal, wallet, "D", 10_000, "USD")
        .await
        .unwrap();
    raw_entry(&p, unbal, payable, "C", 9_999, "USD")
        .await
        .unwrap();
    assert!(
        exec_as_service(
            &p,
            &format!("UPDATE ledger.transactions SET status = 'POSTED' WHERE id = '{unbal}'")
        )
        .await
        .is_err(),
        "desbalanceada"
    );
    // Transacción vacía no pasa a POSTED.
    let empty = draft(&p, "P2P_TRANSFER", &key()).await;
    assert!(
        exec_as_service(
            &p,
            &format!("UPDATE ledger.transactions SET status = 'POSTED' WHERE id = '{empty}'")
        )
        .await
        .is_err(),
        "vacía"
    );
    // No se puede crear ya POSTED (saltaría el trigger de balance).
    let born_posted = format!(
        "INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at)
         VALUES ('{}', 'P2P_TRANSFER', 'test', 'x', 'USD', 'POSTED', '{}', '\\x00', now())",
        Uuid::new_v4(),
        Uuid::new_v4()
    );
    assert!(
        exec_as_service(&p, &born_posted).await.is_err(),
        "nace POSTED"
    );
    // Mezclar monedas no pasa a POSTED.
    let mixed = draft(&p, "P2P_TRANSFER", &key()).await;
    raw_entry(&p, mixed, wallet, "D", 500, "USD").await.unwrap();
    raw_entry(&p, mixed, payable, "C", 500, "EUR")
        .await
        .unwrap();
    assert!(
        exec_as_service(
            &p,
            &format!("UPDATE ledger.transactions SET status = 'POSTED' WHERE id = '{mixed}'")
        )
        .await
        .is_err(),
        "mezcla monedas"
    );
    // Montos 0 y negativos: CHECK.
    let chk = draft(&p, "P2P_TRANSFER", &key()).await;
    assert!(
        raw_entry(&p, chk, wallet, "D", 0, "USD").await.is_err(),
        "monto 0"
    );
    assert!(
        raw_entry(&p, chk, wallet, "D", -5, "USD").await.is_err(),
        "monto negativo"
    );
    // Una billetera no queda con disponible negativo ni por SQL directo (I5).
    assert!(
        exec_as_service(
            &p,
            &format!("UPDATE ledger.accounts SET balance_minor = -1 WHERE id = '{wallet}'")
        )
        .await
        .is_err(),
        "billetera negativa"
    );
    assert!(
        exec_as_service(
            &p,
            &format!(
                "UPDATE ledger.accounts SET held_minor = balance_minor + 1 WHERE id = '{wallet}'"
            )
        )
        .await
        .is_err(),
        "retenido > saldo"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn ref_sql_immutability_after_posted() {
    let (s, p) = svc().await;
    let u = Uuid::new_v4().to_string();
    let t = top_up(&s, &u, 4_000).await;
    let (tid, eid) = (t.transaction_id.clone(), t.entries[0].entry_id.clone());
    let wallet = account_id(&p, &u, T::Wallet).await;
    for (what, sql) in [
        ("UPDATE de la transacción", format!("UPDATE ledger.transactions SET description = 'hack' WHERE id = '{tid}'")),
        ("UPDATE de la fecha efectiva", format!("UPDATE ledger.transactions SET effective_at = now() - interval '1 day' WHERE id = '{tid}'")),
        ("DELETE de la transacción", format!("DELETE FROM ledger.transactions WHERE id = '{tid}'")),
        ("UPDATE de una entrada", format!("UPDATE ledger.entries SET amount_minor = 1 WHERE id = '{eid}'")),
        ("DELETE de una entrada", format!("DELETE FROM ledger.entries WHERE id = '{eid}'")),
        ("volver a DRAFT", format!("UPDATE ledger.transactions SET status = 'DRAFT' WHERE id = '{tid}'")),
    ] {
        assert!(exec_as_service(&p, &sql).await.is_err(), "{what} debe fallar");
    }
    let late = raw_entry(&p, Uuid::parse_str(&tid).unwrap(), wallet, "C", 5, "USD").await;
    assert!(late.is_err(), "entrada nueva en una transacción POSTED");
    assert_eq!(
        balance(&s, acct(&u, T::Wallet, "USD")).await.posted_minor,
        4_000
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn ref_exactly_once_capture_but_refunds_allowed() {
    let (s, p) = svc().await;
    let merchant = Uuid::new_v4().to_string();
    let payment = key();
    let mut cap = post_req(
        "PAYMENT_CAPTURE",
        &payment,
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 1_000),
            entry(&merchant, T::MerchantPayable, S::Credit, 1_000),
        ],
    );
    cap.tenant_id = merchant.clone();
    s.post_transaction(as_service(cap, "payments-core"))
        .await
        .unwrap();
    // Webhook duplicado con otra clave: lo rechaza el índice único parcial.
    let mut dup = post_req(
        "PAYMENT_CAPTURE",
        &payment,
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 1_000),
            entry(&merchant, T::MerchantPayable, S::Credit, 1_000),
        ],
    );
    dup.tenant_id = merchant.clone();
    assert_eq!(
        reason(
            &s.post_transaction(as_service(dup, "payments-core"))
                .await
                .unwrap_err()
        ),
        "DUPLICATE_CAPTURE"
    );
    // Dos reembolsos parciales del mismo pago sí pueden existir.
    for amount in [250, 300] {
        let mut refund = post_req(
            "REFUND",
            &payment,
            vec![
                entry(&merchant, T::MerchantPayable, S::Debit, amount),
                entry(PLATFORM, T::RailReceivable, S::Credit, amount),
            ],
        );
        refund.tenant_id = merchant.clone();
        s.post_transaction(as_service(refund, "payments-core"))
            .await
            .expect("reembolso parcial");
    }
    assert_eq!(
        balance(&s, acct(&merchant, T::MerchantPayable, "USD"))
            .await
            .posted_minor,
        450
    );
    // La misma clave de idempotencia no se puede insertar dos veces ni por SQL.
    let k = Uuid::new_v4();
    let ins = |id: Uuid| {
        format!(
            "INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at)
             VALUES ('{id}', 'WALLET_TOPUP', 'test', 'r', 'USD', 'DRAFT', '{k}', '\\x00', now())"
        )
    };
    exec_as_service(&p, &ins(Uuid::new_v4())).await.unwrap();
    assert!(
        exec_as_service(&p, &ins(Uuid::new_v4())).await.is_err(),
        "clave repetida"
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn ref_original_plus_reversal_nets_zero_on_every_account() {
    let (s, p) = svc().await;
    let merchant = Uuid::new_v4().to_string();
    let mut cap = post_req(
        "PAYMENT_CAPTURE",
        &key(),
        vec![
            entry(PLATFORM, T::RailReceivable, S::Debit, 10_000),
            entry(&merchant, T::MerchantPayable, S::Credit, 9_786),
            entry(PLATFORM, T::PlatformFees, S::Credit, 50),
            entry(PLATFORM, T::RailFeesPayable, S::Credit, 150),
            entry(PLATFORM, T::TaxPayable, S::Credit, 14),
        ],
    );
    cap.tenant_id = merchant.clone();
    let t = s
        .post_transaction(as_service(cap, "payments-core"))
        .await
        .unwrap()
        .into_inner();
    let rev = s
        .reverse_transaction(as_service(
            pb::ReverseTransactionRequest {
                transaction_id: t.transaction_id.clone(),
                idempotency_key: key(),
                reason: "test".into(),
            },
            "payments-core",
        ))
        .await
        .unwrap()
        .into_inner();
    let nonzero = count(
        &p,
        "SELECT count(*) FROM (SELECT e.account_id FROM ledger.entries e
           WHERE e.transaction_id IN ($1::uuid, (SELECT id FROM ledger.transactions WHERE reversal_of = $1::uuid))
           GROUP BY e.account_id HAVING sum(CASE WHEN e.side = 'D' THEN e.amount_minor ELSE -e.amount_minor END) <> 0) x",
        &t.transaction_id,
    )
    .await;
    assert_eq!(
        nonzero, 0,
        "original + reverso = neto 0 en todas las cuentas"
    );
    assert_eq!(rev.entries.len(), t.entries.len());
    assert_eq!(
        balance(&s, acct(&merchant, T::MerchantPayable, "USD"))
            .await
            .posted_minor,
        0
    );
}

#[tokio::test]
#[ignore = "L2: corre con ledger/test/test_l2.sh (base efímera)"]
async fn r11_random_operations_with_reversals_keep_i1_i5_i7() {
    // SPEC §11.3: secuencias pseudoaleatorias (semilla fija, reproducibles) de transferencias,
    // pagos, retenciones, capturas, liberaciones y reversos. Los rechazos esperados (saldo
    // insuficiente, ya reversada) son parte de la secuencia; nada más puede fallar.
    let (s, p) = svc().await;
    let wallets: Vec<String> = (0..6).map(|_| Uuid::new_v4().to_string()).collect();
    let merchant = Uuid::new_v4().to_string();
    for w in &wallets {
        top_up(&s, w, 5_000).await;
    }
    let mut seed: u64 = 0x005e_ed1e_d6e2;
    let mut next = |n: u64| {
        seed = seed
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        (seed >> 33) % n
    };
    let mut posted: Vec<String> = Vec::new();
    let mut holds: Vec<(String, i64)> = Vec::new();
    let allowed = ["INSUFFICIENT_FUNDS", "ALREADY_REVERSED", "HOLD_NOT_ACTIVE"];
    for _ in 0..400 {
        let a = &wallets[next(6) as usize];
        let b = &wallets[next(6) as usize];
        let amount = i64::try_from(next(3_000) + 1).unwrap();
        let res: Result<(), Status> = match next(6) {
            0 if a != b => {
                let req = post_req(
                    "P2P_TRANSFER",
                    &key(),
                    vec![
                        entry(a, T::Wallet, S::Debit, amount),
                        entry(b, T::Wallet, S::Credit, amount),
                    ],
                );
                s.post_transaction(as_service(req, "payments-core"))
                    .await
                    .map(|t| posted.push(t.into_inner().transaction_id))
            }
            1 => {
                let req = post_req(
                    "WALLET_PAYMENT",
                    &key(),
                    vec![
                        entry(a, T::Wallet, S::Debit, amount),
                        entry(&merchant, T::MerchantPayable, S::Credit, amount),
                    ],
                );
                s.post_transaction(as_service(req, "payments-core"))
                    .await
                    .map(|t| posted.push(t.into_inner().transaction_id))
            }
            2 => {
                let req = pb::CreateHoldRequest {
                    idempotency_key: key(),
                    account: Some(acct(a, T::Wallet, "USD")),
                    amount_minor: amount,
                    reference: None,
                    ttl_seconds: 300,
                };
                s.create_hold(as_service(req, "payments-core"))
                    .await
                    .map(|h| holds.push((h.into_inner().hold_id, amount)))
            }
            3 if !holds.is_empty() => {
                let (id, amt) = holds.swap_remove(next(holds.len() as u64) as usize);
                let req = pb::CaptureHoldRequest {
                    hold_id: id,
                    idempotency_key: key(),
                    tenant_id: merchant.clone(),
                    transaction_type: "WALLET_PAYMENT".into(),
                    reference: Some(pb::Reference {
                        r#type: "payment".into(),
                        id: key(),
                    }),
                    legs: vec![pb::CreditLeg {
                        account: Some(acct(&merchant, T::MerchantPayable, "USD")),
                        amount_minor: amt,
                    }],
                };
                s.capture_hold(as_service(req, "payments-core"))
                    .await
                    .map(|r| posted.push(r.into_inner().transaction.unwrap().transaction_id))
            }
            4 if !holds.is_empty() => {
                let (id, _) = holds.swap_remove(next(holds.len() as u64) as usize);
                s.release_hold(as_service(
                    pb::ReleaseHoldRequest {
                        hold_id: id,
                        idempotency_key: key(),
                    },
                    "payments-core",
                ))
                .await
                .map(|_| ())
            }
            5 if !posted.is_empty() => {
                let id = posted[next(posted.len() as u64) as usize].clone();
                s.reverse_transaction(as_service(
                    pb::ReverseTransactionRequest {
                        transaction_id: id,
                        idempotency_key: key(),
                        reason: "test".into(),
                    },
                    "payments-core",
                ))
                .await
                .map(|_| ())
            }
            _ => Ok(()),
        };
        if let Err(e) = res {
            assert!(
                allowed.contains(&reason(&e).as_str()),
                "rechazo inesperado: {} {}",
                reason(&e),
                e.message()
            );
        }
    }
    for w in &wallets {
        let b = balance(&s, acct(w, T::Wallet, "USD")).await;
        assert!(b.available_minor >= 0 && b.held_minor >= 0, "I5");
    }
    assert_eq!(
        PgLedger::new(p).check_invariants().await.unwrap(),
        0,
        "I1/I7 tras la secuencia"
    );
}
