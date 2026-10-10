// Ejercita web/prisma/migrations/20260928000000_payment_core_and_ledger/migration.sql
// contra un PostgreSQL real (PGlite = Postgres compilado a WASM). No necesita Docker,
// ni el motor de Prisma, ni red. Uso:  npm install && npm test
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, '../../_legacy-typescript-reference/web/prisma/migrations/20260928000000_payment_core_and_ledger/migration.sql');
const db = new PGlite();

let passed = 0;
let failed = 0;
const ok = (name) => { passed++; console.log(`  ok   ${name}`); };
const bad = (name, why) => { failed++; console.log(`  FAIL ${name}\n       ${why}`); };

/** La sentencia DEBE fallar y el mensaje debe cumplir `pattern`. */
async function expectError(name, sql, params, pattern) {
  try {
    await db.query(sql, params);
    bad(name, 'se esperaba un error y la sentencia tuvo éxito');
  } catch (e) {
    pattern.test(String(e.message)) ? ok(name) : bad(name, `error inesperado: ${e.message}`);
  }
}
async function expectOk(name, sql, params) {
  try { await db.query(sql, params); ok(name); } catch (e) { bad(name, e.message); }
}

// ── Tablas preexistentes del sistema base que las FKs necesitan ────────────────────
try {
await db.exec(`CREATE TABLE clients (id TEXT PRIMARY KEY); CREATE TABLE motor_entities (id TEXT PRIMARY KEY);`);
await db.exec(readFileSync(migrationPath, 'utf8'));
ok('la migración completa se aplica sin errores');

// ── Datos base ────────────────────────────────────────────────────────────────
await db.exec(`
  INSERT INTO clients VALUES ('c1'), ('c2');
  INSERT INTO motor_entities VALUES ('m1'), ('m2');
  INSERT INTO ledger_accounts (id,"clientId","entityId","accountType",currency) VALUES
    ('a_recv','c1','PLATFORM','CUSTOMER_RECEIVABLE','USD'),
    ('a_merch','c1','m1','MERCHANT_PAYABLE','USD'),
    ('a_fees','c1','PLATFORM','PLATFORM_FEES','USD'),
    ('a_rail','c1','PLATFORM','RAIL_FEE_YAPPY','USD'),
    ('a_tax','c1','PLATFORM','TAX_PAYABLE','USD'),
    ('a_eur','c1','PLATFORM','EUR_ACCOUNT','EUR'),
    ('a_other_tenant','c2','PLATFORM','CUSTOMER_RECEIVABLE','USD');
  INSERT INTO payment_intents (id,"clientId","amountCents","paymentMethodType","idempotencyKey","updatedAt")
    VALUES ('pi1','c1',10000,'YAPPY','key-1',now());
  INSERT INTO payments (id,"paymentIntentId","clientId","capturedAmountCents","status","updatedAt")
    VALUES ('pay1','pi1','c1',10000,'CAPTURED',now());
`);

const newTx = (id, extra = {}) =>
  db.query(`INSERT INTO ledger_transactions (id,"clientId","transactionType",currency,"paymentId") VALUES ($1,'c1',$2,$3,$4)`,
    [id, extra.type ?? 'PAYMENT', extra.currency ?? 'USD', extra.paymentId ?? null]);
const entry = (id, tx, acc, type, cents) =>
  db.query(`INSERT INTO ledger_entries (id,"ledgerTransactionId","accountId","entryType","amountCents") VALUES ($1,$2,$3,$4,$5)`,
    [id, tx, acc, type, cents]);
const post = (tx) => db.query(`UPDATE ledger_transactions SET status='POSTED', "postedAt"=now() WHERE id=$1`, [tx]);

console.log('\nCaso feliz: B/.100.00 → comercio 97.86 | PlentyPay 0.50 | Yappy 1.50 | ITBMS 0.14');
await newTx('tx1', { paymentId: 'pay1' });
await entry('e1', 'tx1', 'a_recv', 'DEBIT', 10000);
await entry('e2', 'tx1', 'a_merch', 'CREDIT', 9786);
await entry('e3', 'tx1', 'a_fees', 'CREDIT', 50);
await entry('e4', 'tx1', 'a_rail', 'CREDIT', 150);
await entry('e5', 'tx1', 'a_tax', 'CREDIT', 14);
await expectOk('asiento balanceado pasa a POSTED', `UPDATE ledger_transactions SET status='POSTED', "postedAt"=now() WHERE id='tx1'`);
const sums = await db.query(`SELECT "entryType" t, SUM("amountCents")::int s FROM ledger_entries WHERE "ledgerTransactionId"='tx1' GROUP BY 1 ORDER BY 1`);
sums.rows.length === 2 && sums.rows[0].s === 10000 && sums.rows[1].s === 10000
  ? ok('SUM(CREDIT) = SUM(DEBIT) = 10000') : bad('suma', JSON.stringify(sums.rows));

console.log('\nInvariante de balance');
await newTx('tx_unbal');
await entry('u1', 'tx_unbal', 'a_recv', 'DEBIT', 10000);
await entry('u2', 'tx_unbal', 'a_merch', 'CREDIT', 9999);
await expectError('DR ≠ CR no puede pasar a POSTED', `UPDATE ledger_transactions SET status='POSTED' WHERE id='tx_unbal'`, [], /debitos.*creditos/);
await newTx('tx_empty');
await expectError('transacción vacía no puede pasar a POSTED', `UPDATE ledger_transactions SET status='POSTED' WHERE id='tx_empty'`, [], /sin movimientos/);
await expectError('no se puede crear ya POSTED', `INSERT INTO ledger_transactions (id,"clientId","transactionType",status) VALUES ('tx_direct','c1','PAYMENT','POSTED')`, [], /debe nacer DRAFT/);

console.log('\nInmutabilidad tras POSTED');
await expectError('UPDATE de la transacción POSTED', `UPDATE ledger_transactions SET description='hack' WHERE id='tx1'`, [], /inmutable/);
await expectError('DELETE de la transacción POSTED', `DELETE FROM ledger_transactions WHERE id='tx1'`, [], /inmutable/);
await expectError('UPDATE de una entry POSTED', `UPDATE ledger_entries SET "amountCents"=1 WHERE id='e1'`, [], /inmutable/);
await expectError('DELETE de una entry POSTED', `DELETE FROM ledger_entries WHERE id='e1'`, [], /inmutable/);
await expectError('INSERT de una entry en transacción POSTED', `INSERT INTO ledger_entries (id,"ledgerTransactionId","accountId","entryType","amountCents") VALUES ('late','tx1','a_recv','DEBIT',5)`, [], /ya POSTED/);

console.log('\nMoneda y tenant');
await newTx('tx_cur');
await entry('c1e', 'tx_cur', 'a_recv', 'DEBIT', 500);
await entry('c2e', 'tx_cur', 'a_eur', 'CREDIT', 500);
await expectError('mezclar monedas', `UPDATE ledger_transactions SET status='POSTED' WHERE id='tx_cur'`, [], /mezcla monedas/);
await newTx('tx_ten');
await entry('t1e', 'tx_ten', 'a_recv', 'DEBIT', 500);
await entry('t2e', 'tx_ten', 'a_other_tenant', 'CREDIT', 500);
await expectError('cuenta de otro tenant', `UPDATE ledger_transactions SET status='POSTED' WHERE id='tx_ten'`, [], /otro tenant/);

console.log('\nCHECK constraints');
await newTx('tx_chk');
await expectError('amountCents = 0', `INSERT INTO ledger_entries (id,"ledgerTransactionId","accountId","entryType","amountCents") VALUES ('z','tx_chk','a_recv','DEBIT',0)`, [], /chk_ledger_entries_amount_positive/);
await expectError('amountCents negativo', `INSERT INTO ledger_entries (id,"ledgerTransactionId","accountId","entryType","amountCents") VALUES ('n','tx_chk','a_recv','DEBIT',-5)`, [], /chk_ledger_entries_amount_positive/);
await db.exec(`INSERT INTO wallets (id,"clientId","entityId","updatedAt") VALUES ('w1','c1','m1',now())`);
await expectError('saldo de wallet negativo', `UPDATE wallets SET "availableBalanceCents" = -1 WHERE id='w1'`, [], /chk_wallets_balances_non_negative/);
await expectError('reembolso > capturado', `UPDATE payments SET "refundedAmountCents" = 10001 WHERE id='pay1'`, [], /chk_payments_amounts_consistent/);
await expectOk('reembolso parcial válido', `UPDATE payments SET "refundedAmountCents" = 2500 WHERE id='pay1'`);

console.log('\nExactly-once e idempotencia');
await expectError('segundo asiento PAYMENT del mismo pago (webhook duplicado) se rechaza al crearse',
  `INSERT INTO ledger_transactions (id,"clientId","transactionType",currency,"paymentId") VALUES ('tx_dup','c1','PAYMENT','USD','pay1')`,
  [], /ledger_transactions_one_payment_capture_per_payment/);
await expectOk('un REFUND del mismo pago sí puede existir (reembolsos parciales)',
  `INSERT INTO ledger_transactions (id,"clientId","transactionType",currency,"paymentId") VALUES ('tx_refund','c1','REFUND','USD','pay1')`);
await expectError('misma idempotencyKey en el mismo tenant', `INSERT INTO payment_intents (id,"clientId","amountCents","paymentMethodType","idempotencyKey","updatedAt") VALUES ('pi2','c1',5,'YAPPY','key-1',now())`, [], /payment_intents_clientId_idempotencyKey_key/);
await expectOk('misma idempotencyKey en OTRO tenant es válida', `INSERT INTO payment_intents (id,"clientId","amountCents","paymentMethodType","idempotencyKey","updatedAt") VALUES ('pi3','c2',5,'YAPPY','key-1',now())`);

await expectOk('primer movimiento con idempotencyKey',
  `INSERT INTO ledger_transactions (id,"clientId","transactionType","referenceType","referenceId") VALUES ('idem1','c1','WALLET_TOPUP','IDEMPOTENCY_KEY','topup-abc')`);
await expectError('reintento con la misma idempotencyKey (no acredita dos veces)',
  `INSERT INTO ledger_transactions (id,"clientId","transactionType","referenceType","referenceId") VALUES ('idem2','c1','WALLET_TOPUP','IDEMPOTENCY_KEY','topup-abc')`,
  [], /ledger_transactions_idempotency_key_once/);
await expectOk('la misma idempotencyKey en otro tenant es válida',
  `INSERT INTO ledger_transactions (id,"clientId","transactionType","referenceType","referenceId") VALUES ('idem3','c2','WALLET_TOPUP','IDEMPOTENCY_KEY','topup-abc')`);

console.log('\nReverso (nunca se edita la original)');
await newTx('tx_rev', { type: 'REVERSAL_OF_PAYMENT' });
await db.query(`UPDATE ledger_transactions SET "reversalOfId"='tx1' WHERE id='tx_rev'`);
for (const [id, acc, t, c] of [['r1','a_recv','CREDIT',10000],['r2','a_merch','DEBIT',9786],['r3','a_fees','DEBIT',50],['r4','a_rail','DEBIT',150],['r5','a_tax','DEBIT',14]]) {
  await entry(id, 'tx_rev', acc, t, c);
}
await expectOk('transacción de reverso invertida pasa a POSTED', `UPDATE ledger_transactions SET status='POSTED', "postedAt"=now() WHERE id='tx_rev'`);
const net = await db.query(`SELECT a.id, SUM(CASE WHEN e."entryType"='DEBIT' THEN e."amountCents" ELSE -e."amountCents" END)::int AS net
  FROM ledger_entries e JOIN ledger_accounts a ON a.id=e."accountId" WHERE e."ledgerTransactionId" IN ('tx1','tx_rev') GROUP BY a.id`);
net.rows.every((r) => r.net === 0) ? ok('original + reverso = saldo neto 0 en todas las cuentas') : bad('neto', JSON.stringify(net.rows));

} catch (e) {
  failed++;
  console.log('  FAIL error inesperado en el script de prueba: ' + String(e.message).slice(0, 300));
}
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
