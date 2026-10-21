//! Pruebas L2 de settlement (SPEC §11) contra PostgreSQL efímero y un ledger real efímero, ambos
//! levantados por `test/test_l2.sh`. payments-core, identity y security son dobles: aquí se prueba
//! cómo settlement arma, paga y confirma lotes contra asientos reales del ledger.
//! Se ejecutan con `--include-ignored`; sin `PP_SETTLEMENT_TEST_DSN` no corren.
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects
)]

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, TimeZone, Utc};
use plentypay_settlement::clients::{
    Clients, DependencyError, Deps, PayableMovement, PLATFORM_PARTY,
};
use plentypay_settlement::domain::{BatchStatus, DomainError, ItemKind};
use plentypay_settlement::observability::Metrics;
use plentypay_settlement::pb;
use plentypay_settlement::pb::ledger::ledger_client::LedgerClient;
use plentypay_settlement::pb::ledger::{AccountType as T, EntrySide};
use plentypay_settlement::service::{Actor, DestinationInput, Error, ScheduleInput, Settlement};
use plentypay_settlement::store::{DestinationUpdate, PgSettlement, ScheduleUpdate, Scope};
use sqlx::{PgPool, Row};
use tonic::metadata::MetadataValue;
use tonic::transport::Channel;
use tonic::Request;
use uuid::Uuid;

fn var(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("{name} es obligatorio (test/test_l2.sh)"))
}

/// Reloj de las pruebas: pasado mañana a las 23:00 UTC (18:00 en Panamá, después del corte), así
/// lo asentado hoy ya pasó la retención T+1 (R4).
fn clock() -> DateTime<Utc> {
    let d = (Utc::now() + chrono::Duration::days(2)).date_naive();
    Utc.from_utc_datetime(&d.and_hms_opt(23, 0, 0).unwrap())
}

/// Ledger real; payments-core, identity y security como dobles.
struct Hybrid {
    real: Clients,
    sandbox: Mutex<HashSet<String>>,         // ids de cobro de prueba
    refunds: Mutex<HashMap<String, String>>, // reembolso → cobro
    step_ups: AtomicUsize,
}

#[tonic::async_trait]
impl Deps for Hybrid {
    async fn payable_movements(
        &self,
        r: &str,
        t: Uuid,
        c: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<PayableMovement>, DependencyError> {
        self.real.payable_movements(r, t, c, from, to).await
    }
    async fn payable_available(&self, r: &str, t: Uuid, c: &str) -> Result<i64, DependencyError> {
        self.real.payable_available(r, t, c).await
    }
    async fn is_sandbox(&self, _: &str, kind: ItemKind, id: &str) -> Result<bool, DependencyError> {
        let payment = match kind {
            ItemKind::Payment => id.to_string(),
            ItemKind::Refund => self
                .refunds
                .lock()
                .unwrap()
                .get(id)
                .cloned()
                .unwrap_or_default(),
        };
        Ok(self.sandbox.lock().unwrap().contains(&payment))
    }
    async fn post_payout(
        &self,
        r: &str,
        b: Uuid,
        t: Uuid,
        c: &str,
        a: i64,
        k: &str,
    ) -> Result<Uuid, DependencyError> {
        self.real.post_payout(r, b, t, c, a, k).await
    }
    async fn tenant_names(&self, _: &str, _: Uuid) -> Result<Vec<String>, DependencyError> {
        Ok(vec!["Barbería Demo S.A.".into(), "Barbería Demo".into()])
    }
    async fn consume_step_up(
        &self,
        _: &str,
        token: &str,
        _: Uuid,
        op: &str,
    ) -> Result<Option<String>, DependencyError> {
        self.step_ups.fetch_add(1, Ordering::SeqCst);
        assert_eq!(op, "settlement.destination.update");
        Ok((token != "ok").then(|| "NOT_FOUND".to_string()))
    }
    async fn encrypt_destination(
        &self,
        _: &str,
        _: Uuid,
        p: &[u8],
    ) -> Result<(Vec<u8>, String), DependencyError> {
        Ok((p.iter().rev().copied().collect(), "v1".into()))
    }
}

struct Env {
    core: Settlement,
    deps: Arc<Hybrid>,
    store: PgSettlement,
    pool: PgPool,
    ledger: LedgerClient<Channel>,
}

async fn env() -> Env {
    let pool = PgPool::connect(&var("PP_SETTLEMENT_TEST_DSN"))
        .await
        .unwrap();
    let addr = var("PP_TEST_LEDGER_ADDR");
    let real = Clients::new(
        &addr,
        &addr,
        &addr,
        &addr,
        Duration::from_secs(3),
        Duration::from_secs(3),
    )
    .unwrap();
    let deps = Arc::new(Hybrid {
        real,
        sandbox: Mutex::new(HashSet::new()),
        refunds: Mutex::new(HashMap::new()),
        step_ups: AtomicUsize::new(0),
    });
    let store = PgSettlement::new(pool.clone());
    let core = Settlement::with_clock(
        store.clone(),
        deps.clone(),
        Arc::new(Metrics::new().unwrap()),
        clock,
    );
    let ledger = LedgerClient::connect(addr).await.unwrap();
    Env {
        core,
        deps,
        store,
        pool,
        ledger,
    }
}

fn owner(t: Uuid) -> Actor {
    Actor {
        service: "api-gateway".into(),
        user_id: Some(Uuid::now_v7()),
        tenant_id: Some(t),
        permissions: vec![
            "settlement:read".into(),
            "settlement:schedule:manage".into(),
        ],
        request_id: "req-l2".into(),
        step_up: String::new(),
    }
}

fn platform() -> Actor {
    Actor {
        service: "api-gateway".into(),
        user_id: Some(Uuid::now_v7()),
        tenant_id: None,
        permissions: vec!["platform:reconcile".into()],
        request_id: "req-l2".into(),
        step_up: String::new(),
    }
}

fn acct(party: &str, t: T, scope: &str) -> Option<pb::ledger::AccountRef> {
    Some(pb::ledger::AccountRef {
        party_id: party.into(),
        r#type: t as i32,
        currency: "USD".into(),
        scope_id: scope.into(),
    })
}

fn entry(party: &str, t: T, scope: &str, debit: bool, amount: i64) -> pb::ledger::EntryInput {
    pb::ledger::EntryInput {
        account: acct(party, t, scope),
        side: if debit {
            EntrySide::Debit
        } else {
            EntrySide::Credit
        } as i32,
        amount_minor: amount,
    }
}

async fn post(
    ledger: &LedgerClient<Channel>,
    kind: &str,
    key: String,
    reference: (&str, &str),
    entries: Vec<pb::ledger::EntryInput>,
    tenant: Uuid,
) {
    let mut req = Request::new(pb::ledger::PostTransactionRequest {
        idempotency_key: key,
        tenant_id: tenant.to_string(),
        transaction_type: kind.into(),
        reference: Some(pb::Reference {
            r#type: reference.0.into(),
            id: reference.1.into(),
        }),
        currency: "USD".into(),
        description: String::new(),
        entries,
        effective_at: None,
    });
    req.metadata_mut().insert(
        "x-pp-actor-service",
        MetadataValue::from_static("payments-core"),
    );
    ledger
        .clone()
        .post_transaction(req)
        .await
        .unwrap_or_else(|s| panic!("{kind}: {s:?}"));
}

/// T2 del vector A (domain-model §4.5): bruto 10000 → comercio 9632, comisión 250, ITBMS 18, riel 100.
async fn capture_vector_a(e: &Env, m: Uuid) -> String {
    let p = Uuid::now_v7().to_string();
    let pl = PLATFORM_PARTY;
    post(
        &e.ledger,
        "PAYMENT_CAPTURE",
        format!("pay:{p}"),
        ("payment", &p),
        vec![
            entry(pl, T::RailReceivable, "YAPPY", true, 10_000),
            entry(&m.to_string(), T::MerchantPayable, "", false, 9_632),
            entry(pl, T::PlatformFees, "", false, 250),
            entry(pl, T::TaxPayable, "", false, 18),
            entry(pl, T::RailFeesPayable, "YAPPY", false, 100),
        ],
        m,
    )
    .await;
    p
}

/// T5: el riel deposita a PlentyPay el cobro del vector A (10000 − comisión del riel 100).
async fn rail_deposit(e: &Env, m: Uuid) {
    let line = Uuid::now_v7().to_string();
    let pl = PLATFORM_PARTY;
    post(
        &e.ledger,
        "RAIL_SETTLEMENT",
        format!("railsettle:{line}"),
        ("rail_statement_line", &line),
        vec![
            entry(pl, T::BankCash, "", true, 9_900),
            entry(pl, T::RailFeesPayable, "YAPPY", true, 100),
            entry(pl, T::RailReceivable, "YAPPY", false, 10_000),
        ],
        m,
    )
    .await;
}

/// T7 del reembolso R1 (2500 de A): al comercio se le descuentan 2432.
async fn refund_r1(e: &Env, m: Uuid, payment: &str) {
    let r = Uuid::now_v7().to_string();
    e.deps
        .refunds
        .lock()
        .unwrap()
        .insert(r.clone(), payment.to_string());
    let pl = PLATFORM_PARTY;
    post(
        &e.ledger,
        "REFUND",
        format!("refund:{r}"),
        ("refund", &r),
        vec![
            entry(&m.to_string(), T::MerchantPayable, "", true, 2_432),
            entry(pl, T::PlatformFees, "", true, 63),
            entry(pl, T::TaxPayable, "", true, 5),
            entry(pl, T::RailReceivable, "YAPPY", false, 2_500),
        ],
        m,
    )
    .await;
}

async fn balance(e: &Env, party: Uuid, t: T) -> i64 {
    let mut req = Request::new(pb::ledger::GetBalanceRequest {
        account: acct(&party.to_string(), t, ""),
    });
    req.metadata_mut().insert(
        "x-pp-actor-service",
        MetadataValue::from_static("settlement"),
    );
    e.ledger
        .clone()
        .get_balance(req)
        .await
        .unwrap()
        .into_inner()
        .available_minor
}

fn key() -> String {
    format!("l2-settle-{}", Uuid::now_v7())
}

async fn outbox_count(e: &Env, tenant: Uuid, subject: &str) -> i64 {
    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let n: i64 = sqlx::query(
        "SELECT count(*) AS n FROM settlement.outbox WHERE tenant_id = $1 AND event_type = $2",
    )
    .bind(tenant)
    .bind(subject)
    .fetch_one(tx.as_mut())
    .await
    .unwrap()
    .get("n");
    tx.commit().await.unwrap();
    n
}

/// Aceptación 1 (SPEC §11): 3 cobros del vector A y el reembolso R1 → lote por 3×9632 − 2432 pagado a
/// la billetera con T6b; repetir la clave devuelve el mismo lote y no hay nada más que liquidar (R1).
#[tokio::test]
#[ignore]
async fn l2_acceptance1_vector_a_minus_r1_to_wallet() {
    let e = env().await;
    let m = Uuid::now_v7();
    let p1 = capture_vector_a(&e, m).await;
    capture_vector_a(&e, m).await;
    capture_vector_a(&e, m).await;
    refund_r1(&e, m, &p1).await;
    let k = key();
    let b = e.core.create_batch(&owner(m), &k).await.unwrap();
    assert_eq!(b.status, BatchStatus::Paid, "{b:?}");
    assert_eq!(
        (b.gross_minor, b.refunds_minor, b.net_minor),
        (3 * 9632, 2432, 3 * 9632 - 2432)
    );
    assert_eq!(
        (b.item_count, b.destination_kind.as_str(), b.sandbox),
        (4, "WALLET", false)
    );
    assert!(b.ledger_transaction_id.is_some());
    assert_eq!(balance(&e, m, T::MerchantPayable).await, 0);
    assert_eq!(
        balance(&e, m, T::Wallet).await,
        3 * 9632 - 2432,
        "T6b acredita la billetera del negocio"
    );
    assert_eq!(outbox_count(&e, m, "pp.settlement.batch.paid.v1").await, 1);

    let again = e.core.create_batch(&owner(m), &k).await.unwrap();
    assert_eq!(again.id, b.id, "misma clave = mismo lote");
    let next = e.core.create_batch(&owner(m), &key()).await;
    assert!(
        matches!(next, Err(Error::Domain(DomainError::NothingToSettle))),
        "{next:?}"
    );
    let (_, items) = e.core.get_batch(&owner(m), b.id).await.unwrap();
    assert_eq!(
        items.iter().filter(|i| i.kind == ItemKind::Refund).count(),
        1
    );
}

/// R5 y aceptación 3: cambiar el destino exige step-up; el titular se valida antes de gastarlo; un
/// destino bancario detiene los pagos 48 h y queda cifrado (solo últimos 4).
#[tokio::test]
#[ignore]
async fn l2_r5_destination_change_requires_step_up_and_blocks() {
    let e = env().await;
    let m = Uuid::now_v7();
    let mut a = owner(m);
    let bank = |holder: &str| ScheduleInput {
        frequency: 1,
        weekday: 0,
        minimum_payout_minor: 100,
        destination: Some(DestinationInput {
            kind: "BANK".into(),
            bank: "Banco General".into(),
            account_type: "CHECKING".into(),
            account_number: "04-01-0012345-6".into(),
            holder: holder.into(),
        }),
        step_up_token: String::new(),
        idempotency_key: key(),
    };
    let r = e.core.set_schedule(&a, bank("Otra Persona")).await;
    assert!(
        matches!(r, Err(Error::Domain(DomainError::InvalidDestination))),
        "{r:?}"
    );
    assert_eq!(
        e.deps.step_ups.load(Ordering::SeqCst),
        0,
        "un dato inválido no gasta el step-up"
    );
    let r = e.core.set_schedule(&a, bank("Barbería Demo, S.A.")).await;
    assert!(matches!(r, Err(Error::StepUpRequired)), "{r:?}");
    a.step_up = "malo".into();
    let r = e.core.set_schedule(&a, bank("Barbería Demo, S.A.")).await;
    assert!(matches!(r, Err(Error::StepUpInvalid(_))), "{r:?}");
    a.step_up = "ok".into();
    let v = e
        .core
        .set_schedule(&a, bank("Barbería Demo, S.A."))
        .await
        .unwrap();
    assert_eq!(
        (
            v.row.destination_kind.as_str(),
            v.row.destination_last4.as_str()
        ),
        ("BANK", "3456")
    );
    assert_eq!(
        v.row.payouts_blocked_until,
        Some(clock() + chrono::Duration::hours(48))
    );
    assert_eq!(
        outbox_count(&e, m, "pp.settlement.payout_destination.changed.v1").await,
        1
    );

    let mut tx = e.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.actor', 'service', true)")
        .execute(tx.as_mut())
        .await
        .unwrap();
    let stored: Vec<u8> = sqlx::query(
        "SELECT destination_ciphertext FROM settlement.payout_schedules WHERE tenant_id = $1",
    )
    .bind(m)
    .fetch_one(tx.as_mut())
    .await
    .unwrap()
    .get("destination_ciphertext");
    tx.commit().await.unwrap();
    assert!(
        !String::from_utf8_lossy(&stored).contains("040100123456"),
        "el número nunca se guarda en claro"
    );

    capture_vector_a(&e, m).await;
    let r = e.core.create_batch(&owner(m), &key()).await;
    assert!(
        matches!(r, Err(Error::Domain(DomainError::PayoutsBlocked))),
        "{r:?}"
    );
}

/// Destino bancario sin bloqueo para las pruebas de lote al banco.
async fn bank_schedule(e: &Env, m: Uuid) {
    e.store
        .upsert_schedule(
            &ScheduleUpdate {
                tenant_id: m,
                frequency: 3,
                weekday: 0,
                minimum_payout_minor: 100,
                destination: Some(DestinationUpdate {
                    kind: "BANK".into(),
                    bank: "Banco General".into(),
                    account_type: "SAVINGS".into(),
                    ciphertext: Some(vec![1, 2, 3]),
                    key_version: "v1".into(),
                    last4: "3456".into(),
                    holder: "Barbería Demo".into(),
                    blocked_until: None,
                }),
                idempotency_key: key(),
                updated_by: None,
                at: Utc::now(),
            },
            None,
        )
        .await
        .unwrap();
}

/// R2 y F12.4: al banco no van cobros de prueba; el lote queda en proceso hasta que la plataforma
/// confirma la transferencia (T6 contra BANK_CASH). Un lote fallido libera sus partidas.
#[tokio::test]
#[ignore]
async fn l2_r2_bank_batches_exclude_sandbox_and_need_confirmation() {
    let e = env().await;
    let m = Uuid::now_v7();
    bank_schedule(&e, m).await;
    let fake = capture_vector_a(&e, m).await;
    e.deps.sandbox.lock().unwrap().insert(fake);
    let r = e.core.create_batch(&owner(m), &key()).await;
    assert!(
        matches!(r, Err(Error::Domain(DomainError::SandboxFunds))),
        "solo hay cobros de prueba: {r:?}"
    );

    capture_vector_a(&e, m).await;
    let b = e.core.create_batch(&owner(m), &key()).await.unwrap();
    assert_eq!(
        (b.status, b.net_minor, b.sandbox, b.item_count),
        (BatchStatus::Processing, 9632, false, 1)
    );
    let s = e.core.summary(&owner(m)).await.unwrap();
    assert_eq!(
        (s.processing_minor, s.pending_minor),
        (9632, 9632),
        "el de prueba sigue por liquidar"
    );

    let r = e.core.confirm_payout(&owner(m), b.id, "ACH-123").await;
    assert!(
        matches!(r, Err(Error::PermissionDenied)),
        "solo la plataforma confirma"
    );
    // Sin el depósito del riel asentado (T5) no hay BANK_CASH de dónde pagar.
    let r = e.core.confirm_payout(&platform(), b.id, "ACH-123").await;
    assert!(
        matches!(r, Err(Error::Domain(DomainError::BankFundsPending))),
        "{r:?}"
    );
    rail_deposit(&e, m).await;
    let paid = e
        .core
        .confirm_payout(&platform(), b.id, "ACH-123")
        .await
        .unwrap();
    assert_eq!(
        (paid.status, paid.payout_external_ref.as_str()),
        (BatchStatus::Paid, "ACH-123")
    );
    assert_eq!(
        balance(&e, m, T::MerchantPayable).await,
        9632,
        "queda el cobro de prueba"
    );
    let again = e
        .core
        .confirm_payout(&platform(), b.id, "ACH-123")
        .await
        .unwrap();
    assert_eq!(
        again.id, paid.id,
        "confirmar dos veces no asienta dos veces"
    );

    // Otro cobro real → lote → falla → sus partidas vuelven a ser elegibles.
    capture_vector_a(&e, m).await;
    let b2 = e.core.create_batch(&owner(m), &key()).await.unwrap();
    let failed = e
        .core
        .fail_payout(&platform(), b2.id, "cuenta cerrada")
        .await
        .unwrap();
    assert_eq!(
        (failed.status, failed.failure_reason.as_str()),
        (BatchStatus::Failed, "cuenta cerrada")
    );
    let b3 = e.core.create_batch(&owner(m), &key()).await.unwrap();
    assert_eq!(
        b3.net_minor, 9632,
        "la partida liberada entra en el lote siguiente"
    );
    let list = e
        .core
        .list_batches(&owner(m), None, 10, None)
        .await
        .unwrap();
    assert_eq!(list.len(), 3);
    let all = e
        .core
        .list_batches(&platform(), Some(BatchStatus::Processing), 200, None)
        .await
        .unwrap();
    assert!(
        all.iter().any(|x| x.id == b3.id),
        "la plataforma ve los lotes en proceso de todos"
    );
}

/// R9 (F12.7): el job crea un lote por día después del corte de las 17:00 en Panamá.
#[tokio::test]
#[ignore]
async fn l2_r9_scheduled_batch_once_per_day() {
    let e = env().await;
    let m = Uuid::now_v7();
    let a = owner(m);
    e.core
        .set_schedule(
            &a,
            ScheduleInput {
                frequency: 1,
                weekday: 0,
                minimum_payout_minor: 100,
                destination: None,
                step_up_token: String::new(),
                idempotency_key: key(),
            },
        )
        .await
        .unwrap();
    capture_vector_a(&e, m).await;
    let before = e.core.list_batches(&a, None, 10, None).await.unwrap().len();
    e.core.run_schedules().await.unwrap();
    e.core.run_schedules().await.unwrap();
    let after = e.core.list_batches(&a, None, 10, None).await.unwrap();
    assert_eq!(
        after.len(),
        before + 1,
        "un lote por día aunque el job corra varias veces"
    );
    assert_eq!(after[0].status, BatchStatus::Paid);
    // RLS: otro negocio no ve este lote.
    let other = e.core.get_batch(&owner(Uuid::now_v7()), after[0].id).await;
    assert!(matches!(other, Err(Error::NotFound)), "{other:?}");
    assert!(e
        .store
        .schedule(&Scope::tenant(m), m)
        .await
        .unwrap()
        .is_some());
}
