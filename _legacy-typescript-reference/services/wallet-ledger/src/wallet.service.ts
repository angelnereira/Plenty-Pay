import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

// ── WALLET: sin cambios de fondo respecto al primer borrador ────────────────

async function getOrCreateWallet(clientId: string, entityId: string) {
  const existing = await prisma.wallet.findUnique({ where: { entityId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { clientId, entityId } });
}

export async function getBalance(tenantId: string, entityId: string) {
  return getOrCreateWallet(tenantId, entityId);
}

export interface CreateHoldInput {
  tenantId: string;
  entityId: string;
  amountCents: bigint;
  reason?: string;
  idempotencyKey: string;
  expiresInSeconds: number;
}

export async function createHold(input: CreateHoldInput) {
  const existing = await prisma.walletHold.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  if (!input.expiresInSeconds || input.expiresInSeconds <= 0) {
    throw new Error('createHold requiere expiresInSeconds > 0.');
  }

  const wallet = await getOrCreateWallet(input.tenantId, input.entityId);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (fresh.availableBalanceCents < input.amountCents) {
      throw new Error('Saldo disponible insuficiente para crear el hold.');
    }
    const updateResult = await tx.wallet.updateMany({
      where: { id: fresh.id, version: fresh.version },
      data: {
        availableBalanceCents: fresh.availableBalanceCents - input.amountCents,
        heldBalanceCents: fresh.heldBalanceCents + input.amountCents,
        version: { increment: 1 },
      },
    });
    if (updateResult.count === 0) {
      throw new Error('Conflicto de concurrencia (version) al crear el hold — reintentar con la misma idempotencyKey.');
    }
    return tx.walletHold.create({
      data: {
        walletId: fresh.id,
        amountCents: input.amountCents,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      },
    });
  });
}

export async function releaseHold(holdId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: holdId } });
    if (hold.status !== 'ACTIVE') throw new Error(`Solo se puede liberar un hold ACTIVE (estado: ${hold.status}).`);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });

    const updateResult = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version },
      data: {
        availableBalanceCents: wallet.availableBalanceCents + hold.amountCents,
        heldBalanceCents: wallet.heldBalanceCents - hold.amountCents,
        version: { increment: 1 },
      },
    });
    if (updateResult.count === 0) throw new Error('Conflicto de concurrencia al liberar el hold — reintentar.');

    return tx.walletHold.update({ where: { id: hold.id }, data: { status: 'RELEASED', resolvedAt: new Date() } });
  });
}

// ── LEDGER: doble entrada, invariante DEBIT=CREDIT, inmutable tras POSTED ───
// (feedback arquitectónico puntos 2, 3, 6, 12 — ver README.md de este servicio)

async function getOrCreateAccount(
  tx: Prisma.TransactionClient,
  clientId: string,
  entityId: string, // usar "PLATFORM" para cuentas internas — nunca null (ver nota en el schema)
  accountType: string,
  currency: string
) {
  const existing = await tx.ledgerAccount.findUnique({
    where: { clientId_entityId_accountType_currency: { clientId, entityId, accountType, currency } },
  });
  if (existing) return existing;
  return tx.ledgerAccount.create({ data: { clientId, entityId, accountType, currency } });
}


/** true si el error es una violación de unicidad de Prisma (P2002) — incluye los índices únicos parciales del ledger. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

interface LedgerLine {
  accountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountCents: bigint;
}

/**
 * Crea y postea (POSTED) una LedgerTransaction balanceada. Esta función es el
 * ÚNICO lugar del servicio que escribe en ledger_transactions/ledger_entries —
 * todo movimiento de dinero real pasa por aquí, nunca por un INSERT directo
 * en otro lado. El trigger de base de datos (ver web/prisma/migrations/
 * 20261001000000_ledger_invariants) es el cinturón de seguridad final: si esta
 * validación en memoria tuviera un bug, la base de datos rechaza el POSTED.
 */
async function postBalancedTransaction(
  tx: Prisma.TransactionClient,
  params: {
    clientId: string;
    paymentId?: string;
    transactionType: string;
    currency: string;
    description?: string;
    /** Clave de idempotencia del cliente: un índice único parcial en Postgres impide asentar dos veces la misma. */
    idempotencyKey?: string;
    lines: LedgerLine[];
  }
) {
  const lines = params.lines.filter((l) => l.amountCents > 0n);
  const totalDebit = lines.filter((l) => l.entryType === 'DEBIT').reduce((a, l) => a + l.amountCents, 0n);
  const totalCredit = lines.filter((l) => l.entryType === 'CREDIT').reduce((a, l) => a + l.amountCents, 0n);

  if (totalDebit !== totalCredit || totalDebit === 0n) {
    throw new Error(
      `postBalancedTransaction: no balancea (DEBIT=${totalDebit}, CREDIT=${totalCredit}) — ` +
        `revisa el desglose antes de llamar a esta función. La base de datos rechazaría esto de todas formas.`
    );
  }

  const ledgerTx = await tx.ledgerTransaction.create({
    data: {
      clientId: params.clientId,
      paymentId: params.paymentId,
      transactionType: params.transactionType,
      currency: params.currency,
      description: params.description,
      ...(params.idempotencyKey
        ? { referenceType: 'IDEMPOTENCY_KEY', referenceId: params.idempotencyKey }
        : {}),
      status: 'DRAFT',
    },
  });

  await tx.ledgerEntry.createMany({
    data: lines.map((l) => ({ ledgerTransactionId: ledgerTx.id, ...l })),
  });

  // status -> POSTED dispara el trigger `trg_check_ledger_balance` en Postgres.
  return tx.ledgerTransaction.update({
    where: { id: ledgerTx.id },
    data: { status: 'POSTED', postedAt: new Date() },
  });
}

export interface CaptureHoldInput {
  holdId: string;
  clientId: string;
  merchantEntityId: string; // comercio que recibe el pago
}

/**
 * Caso simple: capturar un hold y pagarle directo a un comercio, sin fees.
 * Para el caso completo con reparto de fees (comercio/plataforma/riel/impuesto),
 * ver `postPaymentCapture` más abajo — ese es el que de verdad usa PlentyPay
 * en el checkout real.
 */
export async function captureHold(input: CaptureHoldInput) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: input.holdId } });
    if (hold.status !== 'ACTIVE') throw new Error(`Solo se puede capturar un hold ACTIVE (estado: ${hold.status}).`);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });

    const updateResult = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version },
      data: { heldBalanceCents: wallet.heldBalanceCents - hold.amountCents, version: { increment: 1 } },
    });
    if (updateResult.count === 0) throw new Error('Conflicto de concurrencia al capturar el hold — reintentar.');

    await tx.walletHold.update({ where: { id: hold.id }, data: { status: 'CAPTURED', resolvedAt: new Date() } });

    const customerReceivable = await getOrCreateAccount(tx, input.clientId, 'PLATFORM', 'CUSTOMER_RECEIVABLE', wallet.currency);
    const merchantPayable = await getOrCreateAccount(tx, input.clientId, input.merchantEntityId, 'MERCHANT_PAYABLE', wallet.currency);

    return postBalancedTransaction(tx, {
      clientId: input.clientId,
      transactionType: 'PAYMENT',
      currency: wallet.currency,
      description: `Captura de hold ${hold.id} (wallet interno, sin fees)`,
      lines: [
        { accountId: customerReceivable.id, entryType: 'DEBIT', amountCents: hold.amountCents },
        { accountId: merchantPayable.id, entryType: 'CREDIT', amountCents: hold.amountCents },
      ],
    });
  });
}

export interface PostPaymentCaptureInput {
  clientId: string;
  paymentId: string;
  currency: string;
  merchantEntityId: string;
  grossAmountCents: bigint;
  merchantNetCents: bigint;
  platformFeeCents: bigint;
  railFeeCents: bigint;
  railName: string; // "YAPPY" | "TELERED_CLAVE" | "CARD_NETWORK" | ...
  taxCents: bigint; // ej. ITBMS
}

/**
 * El caso completo: un pago que entra por un riel externo se reparte entre el
 * comercio, la comisión de PlentyPay, la comisión del riel y el impuesto.
 * Ejemplo real (feedback arquitectónico, punto 5): B/.100.00 →
 *   Comercio 97.86 | PlentyPay 0.50 | Yappy 1.50 | ITBMS 0.14
 * Los 4 números DEBEN sumar exactamente el bruto — si no, esta función lanza
 * un error ANTES de tocar la base de datos (y aunque no lo hiciera, el trigger
 * de Postgres igual rechazaría el POSTED).
 */
export async function postPaymentCapture(input: PostPaymentCaptureInput) {
  try {
    return await postPaymentCaptureOnce(input);
  } catch (err) {
    // Webhook duplicado / reintento: el índice único parcial garantiza UN asiento PAYMENT por pago.
    // El resultado correcto de un reintento es el asiento original, no un error.
    if (isUniqueViolation(err)) {
      const existing = await prisma.ledgerTransaction.findFirst({
        where: { paymentId: input.paymentId, transactionType: 'PAYMENT' },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

async function postPaymentCaptureOnce(input: PostPaymentCaptureInput) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const customerReceivable = await getOrCreateAccount(tx, input.clientId, 'PLATFORM', 'CUSTOMER_RECEIVABLE', input.currency);
    const merchantPayable = await getOrCreateAccount(tx, input.clientId, input.merchantEntityId, 'MERCHANT_PAYABLE', input.currency);
    const platformFees = await getOrCreateAccount(tx, input.clientId, 'PLATFORM', 'PLATFORM_FEES', input.currency);
    const taxPayable = await getOrCreateAccount(tx, input.clientId, 'PLATFORM', 'TAX_PAYABLE', input.currency);
    const railFeePayable = await getOrCreateAccount(tx, input.clientId, 'PLATFORM', `RAIL_FEE_${input.railName}`, input.currency);

    return postBalancedTransaction(tx, {
      clientId: input.clientId,
      paymentId: input.paymentId,
      transactionType: 'PAYMENT',
      currency: input.currency,
      description: `Captura de pago ${input.paymentId} vía ${input.railName}`,
      lines: [
        { accountId: customerReceivable.id, entryType: 'DEBIT', amountCents: input.grossAmountCents },
        { accountId: merchantPayable.id, entryType: 'CREDIT', amountCents: input.merchantNetCents },
        { accountId: platformFees.id, entryType: 'CREDIT', amountCents: input.platformFeeCents },
        { accountId: railFeePayable.id, entryType: 'CREDIT', amountCents: input.railFeeCents },
        { accountId: taxPayable.id, entryType: 'CREDIT', amountCents: input.taxCents },
      ],
    });
  });
}

/**
 * Reverso de una LedgerTransaction ya POSTED. NUNCA se edita la original
 * (el trigger de Postgres lo impide de todas formas) — se crea una transacción
 * espejo con los mismos montos e entryType invertido.
 */
export async function reverseLedgerTransaction(ledgerTransactionId: string, reason: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const original = await tx.ledgerTransaction.findUniqueOrThrow({
      where: { id: ledgerTransactionId },
      include: { entries: true },
    });
    if (original.status !== 'POSTED') throw new Error('Solo se puede reversar una transacción POSTED.');

    const reversal = await tx.ledgerTransaction.create({
      data: {
        clientId: original.clientId,
        paymentId: original.paymentId,
        transactionType: `REVERSAL_OF_${original.transactionType}`,
        currency: original.currency,
        description: reason,
        reversalOfId: original.id,
        status: 'DRAFT',
      },
    });

    await tx.ledgerEntry.createMany({
      data: original.entries.map((e: { accountId: string; entryType: string; amountCents: bigint }) => ({
        ledgerTransactionId: reversal.id,
        accountId: e.accountId,
        entryType: e.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT', // se invierte cada línea
        amountCents: e.amountCents,
      })),
    });

    return tx.ledgerTransaction.update({
      where: { id: reversal.id },
      data: { status: 'POSTED', postedAt: new Date() },
    });
  });
}

export interface DirectMovementInput {
  tenantId: string;
  entityId: string;
  amountCents: bigint;
  reference?: string;
  idempotencyKey: string;
}

/**
 * Un reintento con la misma idempotencyKey devuelve el asiento original SIN volver a mover saldo:
 * si el INSERT del asiento viola el índice único, la transacción de Prisma se revierte completa
 * (incluida la actualización del saldo de Wallet) y aquí se devuelve el asiento ya existente.
 */
async function replayIfDuplicate(input: DirectMovementInput, run: () => Promise<{ id: string }>): Promise<{ id: string }> {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await prisma.ledgerTransaction.findFirst({
        where: { clientId: input.tenantId, referenceType: 'IDEMPOTENCY_KEY', referenceId: input.idempotencyKey },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

/** Top-up / reembolso / crédito de lealtad: entra dinero a la wallet del usuario. */
export async function creditWallet(input: DirectMovementInput) {
  return replayIfDuplicate(input, () => creditWalletOnce(input));
}

async function creditWalletOnce(input: DirectMovementInput) {
  const wallet = await getOrCreateWallet(input.tenantId, input.entityId);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const updateResult = await tx.wallet.updateMany({
      where: { id: fresh.id, version: fresh.version },
      data: { availableBalanceCents: fresh.availableBalanceCents + input.amountCents, version: { increment: 1 } },
    });
    if (updateResult.count === 0) throw new Error('Conflicto de concurrencia — reintentar.');

    const fundingSource = await getOrCreateAccount(tx, input.tenantId, 'PLATFORM', 'EXTERNAL_FUNDING_SOURCE', fresh.currency);
    const walletAccount = await getOrCreateAccount(tx, input.tenantId, input.entityId, 'WALLET_INTERNAL', fresh.currency);

    return postBalancedTransaction(tx, {
      clientId: input.tenantId,
      transactionType: 'WALLET_TOPUP',
      currency: fresh.currency,
      description: input.reference,
      idempotencyKey: input.idempotencyKey,
      lines: [
        { accountId: fundingSource.id, entryType: 'DEBIT', amountCents: input.amountCents },
        { accountId: walletAccount.id, entryType: 'CREDIT', amountCents: input.amountCents },
      ],
    });
  });
}

/** Redención de puntos / cargo directo: sale dinero de la wallet del usuario. */
export async function debitWallet(input: DirectMovementInput) {
  return replayIfDuplicate(input, () => debitWalletOnce(input));
}

async function debitWalletOnce(input: DirectMovementInput) {
  const wallet = await getOrCreateWallet(input.tenantId, input.entityId);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    if (fresh.availableBalanceCents < input.amountCents) {
      throw new Error('Saldo disponible insuficiente para el cargo directo.');
    }
    const updateResult = await tx.wallet.updateMany({
      where: { id: fresh.id, version: fresh.version },
      data: { availableBalanceCents: fresh.availableBalanceCents - input.amountCents, version: { increment: 1 } },
    });
    if (updateResult.count === 0) throw new Error('Conflicto de concurrencia — reintentar.');

    const walletAccount = await getOrCreateAccount(tx, input.tenantId, input.entityId, 'WALLET_INTERNAL', fresh.currency);
    const redemptionSink = await getOrCreateAccount(tx, input.tenantId, 'PLATFORM', 'LOYALTY_REDEEMED', fresh.currency);

    return postBalancedTransaction(tx, {
      clientId: input.tenantId,
      transactionType: 'WALLET_DEBIT',
      currency: fresh.currency,
      description: input.reference,
      idempotencyKey: input.idempotencyKey,
      lines: [
        { accountId: walletAccount.id, entryType: 'DEBIT', amountCents: input.amountCents },
        { accountId: redemptionSink.id, entryType: 'CREDIT', amountCents: input.amountCents },
      ],
    });
  });
}
