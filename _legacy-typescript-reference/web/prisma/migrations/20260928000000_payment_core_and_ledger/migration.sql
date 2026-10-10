-- ============================================================================
-- PlentyPay: Payment Core + Ledger + Wallet + Settlement
-- ============================================================================
-- ESCRITA A MANO. El motor de Prisma no se pudo descargar en el entorno donde se
-- generó este proyecto (binaries.prisma.sh bloqueado), así que `prisma migrate dev`
-- no pudo emitir esta migración. Sigue las convenciones de nombres de Prisma
-- (<tabla>_pkey, _key, _idx, _fkey) para que no haya "drift" espurio.
--
-- PRIMER PASO en tu máquina (obligatorio, ver MIGRATION_STATUS.md):
--   npx prisma migrate diff --from-migrations prisma/migrations \
--       --to-schema-datamodel prisma/schema.prisma \
--       --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code
-- Si reporta diferencias, esta migración se regenera con `prisma migrate dev`
-- y SOLO se conserva la sección "INVARIANTES" (de abajo), que Prisma no modela.
--
-- Esta migración se ejercitó contra un PostgreSQL real (PGlite/WASM) — ver
-- scripts/test-ledger-invariants.mjs. Eso valida el SQL y los triggers, NO la
-- equivalencia exacta con lo que generaría Prisma.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'PROCESSING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PROCESSING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'UNKNOWN');
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('DRAFT', 'VALIDATING', 'POSTED', 'REJECTED');
CREATE TYPE "PaymentRail" AS ENUM ('WALLET_INTERNAL', 'YAPPY', 'TELERED_CLAVE', 'CARD_VISA', 'CARD_MASTERCARD', 'APPLE_PAY', 'GOOGLE_PAY', 'QR_INTEROPERABLE');
CREATE TYPE "WalletHoldStatus" AS ENUM ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED');
CREATE TYPE "SettlementBatchStatus" AS ENUM ('OPEN', 'PROCESSING', 'PAID', 'FAILED');

-- ─── Tablas ─────────────────────────────────────────────────────────────────
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "customerEntityId" TEXT,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "paymentMethodType" "PaymentRail" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "riskScore" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "merchantEntityId" TEXT,
    "capturedAmountCents" BIGINT NOT NULL DEFAULT 0,
    "refundedAmountCents" BIGINT NOT NULL DEFAULT 0,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "rail" "PaymentRail" NOT NULL,
    "externalRef" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "failureCode" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_terminals" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_terminals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fee_policies" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rail" "PaymentRail",
    "fixedFeeCents" BIGINT NOT NULL DEFAULT 0,
    "percentageFeeBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "bornBy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fee_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_transactions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "paymentId" TEXT,
    "transactionType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "availableBalanceCents" BIGINT NOT NULL DEFAULT 0,
    "heldBalanceCents" BIGINT NOT NULL DEFAULT 0,
    "pendingSettlementCents" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_holds" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" "WalletHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "wallet_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlement_batches" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "merchantEntityId" TEXT NOT NULL,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'OPEN',
    "grossAmountCents" BIGINT NOT NULL DEFAULT 0,
    "commissionCents" BIGINT NOT NULL DEFAULT 0,
    "netAmountCents" BIGINT NOT NULL DEFAULT 0,
    "payoutRail" "PaymentRail",
    "payoutExternalRef" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlement_items" (
    "id" TEXT NOT NULL,
    "settlementBatchId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "payment_intents_clientId_idempotencyKey_key" ON "payment_intents"("clientId", "idempotencyKey");
CREATE INDEX "payments_clientId_status_createdAt_idx" ON "payments"("clientId", "status", "createdAt");
CREATE INDEX "payment_attempts_paymentId_attemptNumber_idx" ON "payment_attempts"("paymentId", "attemptNumber");
CREATE INDEX "payment_attempts_externalRef_idx" ON "payment_attempts"("externalRef");
CREATE UNIQUE INDEX "payment_terminals_publicCode_key" ON "payment_terminals"("publicCode");
CREATE INDEX "payment_terminals_clientId_isActive_idx" ON "payment_terminals"("clientId", "isActive");
CREATE INDEX "fee_policies_clientId_active_idx" ON "fee_policies"("clientId", "active");
CREATE UNIQUE INDEX "ledger_accounts_clientId_entityId_accountType_currency_key" ON "ledger_accounts"("clientId", "entityId", "accountType", "currency");
CREATE INDEX "ledger_transactions_clientId_status_createdAt_idx" ON "ledger_transactions"("clientId", "status", "createdAt");
CREATE INDEX "ledger_entries_ledgerTransactionId_idx" ON "ledger_entries"("ledgerTransactionId");
CREATE INDEX "ledger_entries_accountId_createdAt_idx" ON "ledger_entries"("accountId", "createdAt");
CREATE UNIQUE INDEX "wallets_entityId_key" ON "wallets"("entityId");
CREATE INDEX "wallets_clientId_idx" ON "wallets"("clientId");
CREATE UNIQUE INDEX "wallet_holds_idempotencyKey_key" ON "wallet_holds"("idempotencyKey");
CREATE INDEX "wallet_holds_walletId_status_idx" ON "wallet_holds"("walletId", "status");
CREATE INDEX "settlement_batches_clientId_merchantEntityId_status_idx" ON "settlement_batches"("clientId", "merchantEntityId", "status");
CREATE UNIQUE INDEX "settlement_items_paymentId_key" ON "settlement_items"("paymentId");

-- ─── Claves foráneas ────────────────────────────────────────────────────────
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_terminals" ADD CONSTRAINT "payment_terminals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_policies" ADD CONSTRAINT "fee_policies_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "motor_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_merchantEntityId_fkey" FOREIGN KEY ("merchantEntityId") REFERENCES "motor_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "settlement_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- INVARIANTES (Prisma NO las modela — se conservan aunque regeneres lo de arriba)
-- ============================================================================
-- El ledger no debe depender de que "la aplicación se acuerde" de cuadrar los
-- números: la base de datos es la única capa que ningún bug, servicio ni
-- migración futura puede saltarse.

-- ─── CHECK constraints ──────────────────────────────────────────────────────
ALTER TABLE "ledger_entries"   ADD CONSTRAINT "chk_ledger_entries_amount_positive"   CHECK ("amountCents" > 0);
ALTER TABLE "payment_intents"  ADD CONSTRAINT "chk_payment_intents_amount_positive"  CHECK ("amountCents" > 0);
ALTER TABLE "wallet_holds"     ADD CONSTRAINT "chk_wallet_holds_amount_positive"     CHECK ("amountCents" > 0);
ALTER TABLE "wallets"          ADD CONSTRAINT "chk_wallets_balances_non_negative"    CHECK ("availableBalanceCents" >= 0 AND "heldBalanceCents" >= 0 AND "pendingSettlementCents" >= 0);
ALTER TABLE "payments"         ADD CONSTRAINT "chk_payments_amounts_consistent"      CHECK ("capturedAmountCents" >= 0 AND "refundedAmountCents" >= 0 AND "refundedAmountCents" <= "capturedAmountCents");
ALTER TABLE "fee_policies"     ADD CONSTRAINT "chk_fee_policies_ranges"              CHECK ("fixedFeeCents" >= 0 AND "percentageFeeBasisPoints" BETWEEN 0 AND 10000);

-- ─── Exactly-once: una captura de pago se asienta UNA sola vez ──────────────
-- Un webhook duplicado no puede generar un segundo asiento PAYMENT del mismo pago.
CREATE UNIQUE INDEX "ledger_transactions_one_payment_capture_per_payment"
    ON "ledger_transactions" ("paymentId")
    WHERE "transactionType" = 'PAYMENT' AND "paymentId" IS NOT NULL;

-- Movimientos directos de wallet (top-up, débito): la idempotencyKey del cliente vive en
-- referenceType/referenceId y es única por tenant → un reintento NO puede acreditar dos veces.
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_once"
    ON "ledger_transactions" ("clientId", "referenceId")
    WHERE "referenceType" = 'IDEMPOTENCY_KEY';

-- ─── Guardia de LedgerTransaction ───────────────────────────────────────────
--  • Nace siempre DRAFT; solo llega a POSTED vía UPDATE, y ahí se valida:
--      débitos = créditos > 0, misma moneda y mismo tenant en cada cuenta.
--  • Una vez POSTED es inmutable (ni UPDATE ni DELETE): un error se corrige con
--    una transacción de reverso, nunca editando la original.
CREATE OR REPLACE FUNCTION plentypay_ledger_tx_guard()
RETURNS TRIGGER AS $$
DECLARE
  total_debit  NUMERIC;
  total_credit NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" = 'POSTED' THEN
      RAISE EXCEPTION 'LedgerTransaction % no puede crearse ya POSTED: debe nacer DRAFT y pasar a POSTED por UPDATE tras validar el balance.', NEW."id";
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'LedgerTransaction % ya esta POSTED (inmutable): % bloqueado. Usa una transaccion de reverso (reversalOfId).', OLD."id", TG_OP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW."status" = 'POSTED' THEN
    SELECT
      COALESCE(SUM(CASE WHEN "entryType" = 'DEBIT'  THEN "amountCents" ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amountCents" ELSE 0 END), 0)
    INTO total_debit, total_credit
    FROM "ledger_entries"
    WHERE "ledgerTransactionId" = NEW."id";

    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'LedgerTransaction % no puede pasar a POSTED: debitos (%) <> creditos (%)', NEW."id", total_debit, total_credit;
    END IF;
    IF total_debit = 0 THEN
      RAISE EXCEPTION 'LedgerTransaction % no puede pasar a POSTED sin movimientos (0 = 0 no es valido)', NEW."id";
    END IF;

    IF EXISTS (
      SELECT 1 FROM "ledger_entries" e
      JOIN "ledger_accounts" a ON a."id" = e."accountId"
      WHERE e."ledgerTransactionId" = NEW."id" AND a."currency" <> NEW."currency"
    ) THEN
      RAISE EXCEPTION 'LedgerTransaction % mezcla monedas: todas las cuentas deben ser %', NEW."id", NEW."currency";
    END IF;

    IF EXISTS (
      SELECT 1 FROM "ledger_entries" e
      JOIN "ledger_accounts" a ON a."id" = e."accountId"
      WHERE e."ledgerTransactionId" = NEW."id" AND a."clientId" <> NEW."clientId"
    ) THEN
      RAISE EXCEPTION 'LedgerTransaction % usa cuentas de otro tenant (aislamiento multi-tenant)', NEW."id";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_ledger_tx_guard" ON "ledger_transactions";
CREATE TRIGGER "trg_ledger_tx_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION plentypay_ledger_tx_guard();

-- ─── Guardia de LedgerEntry: solo se toca mientras la transacción no esté POSTED ─
CREATE OR REPLACE FUNCTION plentypay_ledger_entry_guard()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status"::TEXT INTO old_status FROM "ledger_transactions" WHERE "id" = OLD."ledgerTransactionId";
    IF old_status = 'POSTED' THEN
      RAISE EXCEPTION 'LedgerEntry % pertenece a una LedgerTransaction POSTED: % bloqueado (inmutable).', OLD."id", TG_OP;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status"::TEXT INTO new_status FROM "ledger_transactions" WHERE "id" = NEW."ledgerTransactionId";
    IF new_status = 'POSTED' THEN
      RAISE EXCEPTION 'No se pueden agregar/mover LedgerEntry hacia una LedgerTransaction ya POSTED (%).', NEW."ledgerTransactionId";
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_ledger_entry_guard" ON "ledger_entries";
CREATE TRIGGER "trg_ledger_entry_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION plentypay_ledger_entry_guard();
