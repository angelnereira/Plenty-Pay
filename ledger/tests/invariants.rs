#![allow(clippy::unwrap_used, clippy::expect_used)]

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::fs;

async fn setup_pool() -> Option<PgPool> {
    let url = std::env::var("DATABASE_URL").ok()?;
    let pool = PgPoolOptions::new().max_connections(2).connect(&url).await.ok()?;
    // create schema + run migration
    sqlx::query("CREATE SCHEMA IF NOT EXISTS ledger")
        .execute(&pool).await.ok();
    let sql = fs::read_to_string("migrations/0001_initial.sql").ok()?;
    // split by semicolon-naive: execute whole file
    if sqlx::raw_sql(&sql).execute(&pool).await.is_err() {
        // ignore errors (already applied)
    }
    Some(pool)
}

#[tokio::test]
async fn transaction_balanced_posts() {
    let Some(pool) = setup_pool().await else { return; };
    // cleanup
    let _ = sqlx::query("DELETE FROM ledger.entries").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM ledger.transactions").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM ledger.accounts").execute(&pool).await;

    sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,$3,$4)")
        .bind(uuid::Uuid::new_v4()).bind(uuid::Uuid::new_v4()).bind(1i16).bind("USD")
        .execute(&pool).await.unwrap();
    // Use fixed ids for simplicity
    let a1 = uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let a2 = uuid::Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.accounts WHERE id IN ($1,$2)").bind(a1).bind(a2).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,1,'USD'),($3,$4,2,'USD')")
        .bind(a1).bind(uuid::Uuid::new_v4()).bind(a2).bind(uuid::Uuid::new_v4())
        .execute(&pool).await.unwrap();

    let tx = uuid::Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','r1','USD','DRAFT',$2,$3,now())")
        .bind(tx).bind("key-1").bind(vec![0u8])
        .execute(&pool).await.unwrap();

    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',10000,'USD'),($4,$2,$5,'C',10000,'USD')")
        .bind(e1).bind(tx).bind(a1).bind(e2).bind(a2)
        .execute(&pool).await.unwrap();

    // post should succeed
    let res = sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1")
        .bind(tx).execute(&pool).await.unwrap();
    assert_eq!(res.rows_affected(), 1);
}

#[tokio::test]
async fn transaction_unbalanced_fails() {
    let Some(pool) = setup_pool().await else { return; };
    let a1 = uuid::Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap();
    let a2 = uuid::Uuid::parse_str("55555555-5555-5555-5555-555555555555").unwrap();
    sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,1,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a1).bind(uuid::Uuid::new_v4()).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,2,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a2).bind(uuid::Uuid::new_v4()).execute(&pool).await.unwrap();

    let tx = uuid::Uuid::parse_str("66666666-6666-6666-6666-666666666666").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','r2','USD','DRAFT',$2,$3,now())")
        .bind(tx).bind("key-2").bind(vec![0u8])
        .execute(&pool).await.unwrap();

    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',10000,'USD'),($4,$2,$5,'C',9999,'USD')")
        .bind(e1).bind(tx).bind(a1).bind(e2).bind(a2)
        .execute(&pool).await.unwrap();

    let res = sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1")
        .bind(tx).execute(&pool).await;
    assert!(res.is_err(), "unbalanced should fail");
}

#[tokio::test]
async fn posted_transaction_immutable() {
    let Some(pool) = setup_pool().await else { return; };
    let a1 = uuid::Uuid::parse_str("77777777-7777-7777-7777-777777777777").unwrap();
    let a2 = uuid::Uuid::parse_str("88888888-8888-8888-8888-888888888888").unwrap();
    let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,1,'USD'),($3,$4,2,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a1).bind(uuid::Uuid::new_v4()).bind(a2).bind(uuid::Uuid::new_v4())
        .execute(&pool).await;
    let tx = uuid::Uuid::parse_str("99999999-9999-9999-9999-999999999999").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','r9','USD','DRAFT',$2,$3,now())")
        .bind(tx).bind("key-9").bind(vec![0u8])
        .execute(&pool).await.unwrap();
    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',5000,'USD'),($4,$2,$5,'C',5000,'USD')")
        .bind(e1).bind(tx).bind(a1).bind(e2).bind(a2)
        .execute(&pool).await.unwrap();
    sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1").bind(tx).execute(&pool).await.unwrap();
    let res = sqlx::query("UPDATE ledger.transactions SET description='hack' WHERE id=$1").bind(tx).execute(&pool).await;
    assert!(res.is_err(), "posted transaction update should fail");
}

#[tokio::test]
async fn post_and_reverse_transaction() {
    let Some(pool) = setup_pool().await else { return; };
    let a1 = uuid::Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap();
    let a2 = uuid::Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap();
    for (id, atype) in [(a1, 1i16), (a2, 2i16)] {
        let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,$3,'USD') ON CONFLICT (id) DO NOTHING")
            .bind(id).bind(uuid::Uuid::new_v4()).bind(atype).execute(&pool).await;
    }
    let tx = uuid::Uuid::parse_str("cccccccc-cccc-cccc-cccc-cccccccccccc").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','r10','USD','DRAFT',$2,$3,now())")
        .bind(tx).bind("key-10").bind(vec![0u8]).execute(&pool).await.unwrap();
    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',5000,'USD'),($4,$2,$5,'C',5000,'USD')")
        .bind(e1).bind(tx).bind(a1).bind(e2).bind(a2).execute(&pool).await.unwrap();
    // post
    sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1").bind(tx).execute(&pool).await.unwrap();
    // verify posted
    let (status,): (String,) = sqlx::query_as("SELECT status FROM ledger.transactions WHERE id=$1").bind(tx).fetch_one(&pool).await.unwrap();
    assert_eq!(status, "POSTED");
    // reverse
    let rev = uuid::Uuid::parse_str("dddddddd-dddd-dddd-dddd-dddddddddddd").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(rev).execute(&pool).await;
    sqlx::query("UPDATE ledger.transactions SET status='REVERSED' WHERE id=$1 AND status='POSTED'").bind(tx).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, reversal_of, idempotency_key, request_hash, effective_at) VALUES ($1,'REVERSAL','reversal',$2,'USD','DRAFT',$3,$4,$5,now())")
        .bind(rev).bind(tx.to_string()).bind(tx).bind("key-rev").bind(vec![0u8]).execute(&pool).await.unwrap();
    sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1").bind(rev).execute(&pool).await.unwrap();
    let (orig_status,): (String,) = sqlx::query_as("SELECT status FROM ledger.transactions WHERE id=$1").bind(tx).fetch_one(&pool).await.unwrap();
    assert_eq!(orig_status, "REVERSED");
    let (rev_status,): (String,) = sqlx::query_as("SELECT status FROM ledger.transactions WHERE id=$1").bind(rev).fetch_one(&pool).await.unwrap();
    assert_eq!(rev_status, "POSTED");
}

#[tokio::test]
async fn balance_aggregation() {
    let Some(pool) = setup_pool().await else { return; };
    let a = uuid::Uuid::parse_str("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee").unwrap();
    let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,1,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a).bind(uuid::Uuid::new_v4()).execute(&pool).await;
    // insert a posted transaction with entries
    let tx = uuid::Uuid::parse_str("ffffffff-ffff-ffff-ffff-ffffffffffff").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','rb','USD','DRAFT',$2,$3,now())")
        .bind(tx).bind("key-b").bind(vec![0u8]).execute(&pool).await.unwrap();
    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    let a2 = uuid::Uuid::parse_str("12121212-1212-1212-1212-121212121212").unwrap();
    let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,2,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a2).bind(uuid::Uuid::new_v4()).execute(&pool).await;
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',3000,'USD'),($4,$2,$5,'C',3000,'USD')")
        .bind(e1).bind(tx).bind(a).bind(e2).bind(a2).execute(&pool).await.unwrap();
    sqlx::query("UPDATE ledger.transactions SET status='POSTED' WHERE id=$1").bind(tx).execute(&pool).await.unwrap();
    let (posted,): (i64,) = sqlx::query_as("SELECT COALESCE(SUM(CASE WHEN side='D' THEN amount_minor ELSE -amount_minor END),0) FROM ledger.entries WHERE account_id=$1")
        .bind(a).fetch_one(&pool).await.unwrap();
    assert_eq!(posted, 3000);
}

#[tokio::test]
async fn holds_lifecycle() {
    let Some(pool) = setup_pool().await else { return; };
    let a = uuid::Uuid::parse_str("34343434-3434-3434-3434-343434343434").unwrap();
    let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,1,'USD') ON CONFLICT (id) DO NOTHING")
        .bind(a).bind(uuid::Uuid::new_v4()).execute(&pool).await;
    let hold = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.holds (id, account_id, amount_minor, status, reference_type, reference_id, idempotency_key, expires_at) VALUES ($1,$2,1000,'ACTIVE','ref','r','kh', now() + interval '1 hour')")
        .bind(hold).bind(a).execute(&pool).await.unwrap();
    // capture
    sqlx::query("UPDATE ledger.holds SET status='CAPTURED', updated_at=now() WHERE id=$1 AND status='ACTIVE'").bind(hold).execute(&pool).await.unwrap();
    let (st,): (String,) = sqlx::query_as("SELECT status FROM ledger.holds WHERE id=$1").bind(hold).fetch_one(&pool).await.unwrap();
    assert_eq!(st, "CAPTURED");
    // release a new hold
    let hold2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.holds (id, account_id, amount_minor, status, reference_type, reference_id, idempotency_key, expires_at) VALUES ($1,$2,500,'ACTIVE','ref','r2','kh2', now() + interval '1 hour')")
        .bind(hold2).bind(a).execute(&pool).await.unwrap();
    sqlx::query("UPDATE ledger.holds SET status='RELEASED', updated_at=now() WHERE id=$1 AND status='ACTIVE'").bind(hold2).execute(&pool).await.unwrap();
    let (st2,): (String,) = sqlx::query_as("SELECT status FROM ledger.holds WHERE id=$1").bind(hold2).fetch_one(&pool).await.unwrap();
    assert_eq!(st2, "RELEASED");
}

#[tokio::test]
async fn imbalance_detection_query() {
    let Some(pool) = setup_pool().await else { return; };
    // disable trigger to inject an imbalanced posted transaction
    let a1 = uuid::Uuid::parse_str("56565656-5656-5656-5656-565656565656").unwrap();
    let a2 = uuid::Uuid::parse_str("78787878-7878-7878-7878-787878787878").unwrap();
    for (id, atype) in [(a1, 1i16), (a2, 2i16)] {
        let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,$3,'USD') ON CONFLICT (id) DO NOTHING")
            .bind(id).bind(uuid::Uuid::new_v4()).bind(atype).execute(&pool).await;
    }
    let tx = uuid::Uuid::parse_str("9a9a9a9a-9a9a-9a9a-9a9a-9a9a9a9a9a9a").unwrap();
    let _ = sqlx::query("DELETE FROM ledger.transactions WHERE id=$1").bind(tx).execute(&pool).await;
    // disable trigger
    let _ = sqlx::query("ALTER TABLE ledger.transactions DISABLE TRIGGER transaction_posted_balance").execute(&pool).await;
    sqlx::query("INSERT INTO ledger.transactions (id, transaction_type, reference_type, reference_id, currency, status, idempotency_key, request_hash, effective_at) VALUES ($1,'PAYMENT','ref','rx','USD','POSTED',$2,$3,now())")
        .bind(tx).bind("key-x").bind(vec![0u8]).execute(&pool).await.unwrap();
    let e1 = uuid::Uuid::new_v4();
    let e2 = uuid::Uuid::new_v4();
    sqlx::query("INSERT INTO ledger.entries (id, transaction_id, account_id, side, amount_minor, currency) VALUES ($1,$2,$3,'D',1000,'USD'),($4,$2,$5,'C',999,'USD')")
        .bind(e1).bind(tx).bind(a1).bind(e2).bind(a2).execute(&pool).await.unwrap();
    // re-enable trigger
    let _ = sqlx::query("ALTER TABLE ledger.transactions ENABLE TRIGGER transaction_posted_balance").execute(&pool).await;
    // run detection query
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ledger.transactions t WHERE t.status='POSTED' AND (SELECT COALESCE(SUM(CASE WHEN e.side='D' THEN e.amount_minor ELSE -e.amount_minor END),0) FROM ledger.entries e WHERE e.transaction_id=t.id) <> 0")
        .fetch_one(&pool).await.unwrap();
    assert!(count >= 1, "should detect imbalance");
}

#[tokio::test]
async fn service_post_transaction_inserts_outbox() {
    let Some(pool) = setup_pool().await else { return; };
    use plentypay_ledger::grpc::service::LedgerService;
    use plentypay_ledger::pb;
    use plentypay_ledger::pb::ledger_server::Ledger;
    use tonic::Request;
    let a1 = uuid::Uuid::parse_str("abababab-abab-abab-abab-abababababab").unwrap();
    let a2 = uuid::Uuid::parse_str("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd").unwrap();
    for (id, atype) in [(a1, 1i16), (a2, 2i16)] {
        let _ = sqlx::query("INSERT INTO ledger.accounts (id, party_id, account_type, currency) VALUES ($1,$2,$3,'USD') ON CONFLICT (id) DO NOTHING")
            .bind(id).bind(uuid::Uuid::new_v4()).bind(atype).execute(&pool).await;
    }
    let svc = LedgerService::new(pool.clone());
    let req = pb::PostTransactionRequest {
        idempotency_key: "svc-key-1".to_string(),
        transaction_type: "PAYMENT".to_string(),
        currency: "USD".to_string(),
        entries: vec![
            pb::EntryInput { account: Some(pb::AccountRef { party_id: "p1".to_string(), r#type: 1, currency: "USD".to_string(), scope_id: String::new() }), side: 1, amount_minor: 1000 },
            pb::EntryInput { account: Some(pb::AccountRef { party_id: "p2".to_string(), r#type: 2, currency: "USD".to_string(), scope_id: String::new() }), side: 2, amount_minor: 1000 },
        ],
        ..Default::default()
    };
    let resp = svc.post_transaction(Request::new(req)).await.unwrap();
    let tx_id = resp.into_inner().transaction_id;
    // check outbox has a row
    let (cnt,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ledger.outbox WHERE aggregate_id=$1 AND event_type='TransactionPosted'")
        .bind(&tx_id).fetch_one(&pool).await.unwrap();
    assert!(cnt >= 1, "outbox should have TransactionPosted row");
}
