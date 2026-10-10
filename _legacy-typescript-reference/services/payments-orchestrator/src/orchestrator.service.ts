import { createHash } from 'crypto';
import { PrismaClient, PaymentRail, PaymentIntentStatus, PaymentAttemptStatus } from '@prisma/client';
import type { ChargeStatusValue, PaymentRailAdapter } from './adapters/payment-rail-adapter.interface';
import { YappyAdapter } from './adapters/yappy.adapter';
import { TeleredAdapter } from './adapters/telered.adapter';
import { CardNetworkAdapter } from './adapters/card-network.adapter';

export const prisma = new PrismaClient();

const cardAdapter = new CardNetworkAdapter();

const adapters: Partial<Record<PaymentRail, PaymentRailAdapter>> = {
  YAPPY: new YappyAdapter(),
  TELERED_CLAVE: new TeleredAdapter(),
  CARD_VISA: cardAdapter,
  CARD_MASTERCARD: cardAdapter,
  APPLE_PAY: cardAdapter,
  GOOGLE_PAY: cardAdapter,
};

function getAdapter(rail: PaymentRail): PaymentRailAdapter {
  const adapter = adapters[rail];
  if (!adapter) {
    throw new Error(
      `No hay adaptador registrado para "${rail}". WALLET_INTERNAL y QR_INTEROPERABLE ` +
        `se resuelven en services/wallet-ledger, no aquí.`
    );
  }
  return adapter;
}

function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// ── Traducción de estados (el adaptador habla el vocabulario del Payment Core) ─

/** Estado del Payment/PaymentIntent = el mismo valor que reporta el adaptador. */
function toPaymentStatus(s: ChargeStatusValue): PaymentIntentStatus {
  return s as PaymentIntentStatus; // todos los valores de ChargeStatusValue existen en PaymentIntentStatus
}

/**
 * Estado del PaymentAttempt. El enum de intento no tiene REQUIRES_ACTION ni
 * CANCELLED: "esperando al usuario" es un intento todavía en curso (PROCESSING)
 * y un intento cancelado es, para ese intento, un fallo.
 */
function toAttemptStatus(s: ChargeStatusValue): PaymentAttemptStatus {
  switch (s) {
    case 'REQUIRES_ACTION':
    case 'PROCESSING':
      return 'PROCESSING';
    case 'CANCELLED':
    case 'FAILED':
      return 'FAILED';
    case 'AUTHORIZED':
      return 'AUTHORIZED';
    case 'CAPTURED':
      return 'CAPTURED';
    case 'UNKNOWN':
      return 'UNKNOWN';
  }
}


/**
 * ÚNICO lugar donde cambia el estado de un Payment/PaymentIntent. Al pasar a
 * CAPTURED fija capturedAmountCents (lo necesita el reembolso). Cualquier otro
 * código que necesite cambiar estados debe llamar aquí, no a prisma.payment.update.
 */
async function applyPaymentStatus(paymentId: string, status: ChargeStatusValue) {
  const paymentStatus = toPaymentStatus(status);
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { intent: true } });
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: paymentStatus,
      ...(paymentStatus === 'CAPTURED' && payment.capturedAmountCents === 0n
        ? { capturedAmountCents: payment.intent.amountCents }
        : {}),
    },
  });
  await prisma.paymentIntent.update({ where: { id: payment.paymentIntentId }, data: { status: paymentStatus } });
}

export interface CreateChargeIntentInput {
  tenantId: string;
  customerEntityId?: string;
  amountCents: bigint;
  currency: string;
  rail: PaymentRail;
  idempotencyKey: string;
  reference?: string;
  metadata?: Record<string, string>;
}

/** Vista normalizada de un cobro: la misma forma al crear, reintentar (idempotencia) y consultar. */
async function loadChargeView(paymentId: string) {
  return prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { intent: true, attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
  });
}

/**
 * Crea PaymentIntent → Payment → PaymentAttempt(#1) y ejecuta el primer intento
 * contra el adaptador del riel elegido.
 *
 * Idempotencia (feedback punto 9): única por (clientId, idempotencyKey). La MISMA
 * clave con un payload DISTINTO se rechaza explícitamente en vez de devolver en
 * silencio el resultado viejo — evita que un bug del cliente cobre el monto
 * equivocado sin que nadie se dé cuenta. Un reintento con el mismo payload
 * devuelve el resultado original SIN volver a llamar al riel.
 */
export async function createChargeIntent(input: CreateChargeIntentInput) {
  const requestHash = hashRequest({
    amountCents: input.amountCents.toString(),
    currency: input.currency,
    rail: input.rail,
  });

  const existing = await prisma.paymentIntent.findUnique({
    where: { clientId_idempotencyKey: { clientId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    include: { payments: { include: { attempts: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
  });

  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new Error(
        `idempotencyKey "${input.idempotencyKey}" ya se usó con un payload distinto. ` +
          `Genera una idempotencyKey nueva para una operación distinta.`
      );
    }
    // Reanudar si el proceso murió entre crear la intención y crear el pago / el primer intento.
    const payment =
      existing.payments[0] ??
      (await prisma.payment.create({ data: { paymentIntentId: existing.id, clientId: input.tenantId, status: 'CREATED' } }));
    const hasAttempt = 'attempts' in payment && (payment.attempts as unknown[]).length > 0;
    if (!hasAttempt) {
      return runAttempt(existing, payment, input, 1);
    }
    return loadChargeView(payment.id);
  }

  if (input.rail === 'WALLET_INTERNAL') {
    throw new Error('WALLET_INTERNAL se resuelve vía services/wallet-ledger, no en payments-orchestrator.');
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      clientId: input.tenantId,
      customerEntityId: input.customerEntityId,
      amountCents: input.amountCents,
      currency: input.currency,
      paymentMethodType: input.rail,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      status: 'CREATED',
    },
  });

  const payment = await prisma.payment.create({
    data: { paymentIntentId: intent.id, clientId: input.tenantId, status: 'CREATED' },
  });

  return runAttempt(intent, payment, input, 1);
}

/**
 * Ejecuta (o reintenta) un intento contra el riel. Un timeout/error de red del
 * adaptador se traduce a UNKNOWN, NUNCA a FAILED: un FAILED prematuro haría que el
 * checkout diga "no se cobró" cuando el riel sí pudo procesarlo y solo la
 * respuesta no llegó (feedback punto 8). UNKNOWN se resuelve por webhook o por
 * un job de reconciliación (a construir — ver MIGRATION_STATUS.md).
 */
async function runAttempt(
  intent: { id: string; clientId: string; amountCents: bigint; currency: string },
  payment: { id: string },
  input: { rail: PaymentRail; reference?: string; metadata?: Record<string, string>; idempotencyKey: string },
  attemptNumber: number
) {
  const adapter = getAdapter(input.rail);

  const attempt = await prisma.paymentAttempt.create({
    data: { paymentId: payment.id, rail: input.rail, attemptNumber, status: 'PROCESSING' },
  });

  let status: ChargeStatusValue;
  let externalRef: string | undefined;
  let failureCode: string | undefined;
  let raw: Record<string, unknown> = {};

  try {
    const result = await adapter.createCharge({
      tenantId: intent.clientId,
      amountCents: intent.amountCents,
      currency: intent.currency,
      idempotencyKey: `${input.idempotencyKey}:${attemptNumber}`, // sub-clave propia de cada intento hacia el riel
      reference: input.reference,
      metadata: input.metadata,
    });
    status = result.status;
    externalRef = result.externalRef;
    failureCode = result.failureReason;
    // Todo lo que el cliente necesita ver al reintentar/consultar vive en rawResponse.
    raw = {
      ...(typeof result.raw === 'object' && result.raw !== null ? (result.raw as Record<string, unknown>) : {}),
      nextActionUrl: result.nextActionUrl ?? '',
      nextActionQrPayload: result.nextActionQrPayload ?? '',
      sandbox: adapter.isSandboxMode,
    };
  } catch (err) {
    status = 'UNKNOWN';
    failureCode = err instanceof Error ? err.message : 'Error desconocido en el adaptador';
    raw = { sandbox: adapter.isSandboxMode, nextActionUrl: '', nextActionQrPayload: '' };
  }

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: toAttemptStatus(status), externalRef, rawResponse: raw as object, failureCode },
  });

  await applyPaymentStatus(payment.id, status);

  return loadChargeView(payment.id);
}

export async function confirmChargeIntent(
  tenantId: string,
  paymentId: string,
  confirmationData: Record<string, string>
) {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { id: paymentId, clientId: tenantId },
    include: { attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
  });
  const lastAttempt = payment.attempts[0];
  if (!lastAttempt?.externalRef) {
    throw new Error('El pago no tiene un intento con externalRef todavía — no se puede confirmar.');
  }

  const adapter = getAdapter(lastAttempt.rail);
  const result = await adapter.confirmCharge(lastAttempt.externalRef, confirmationData);

  await prisma.paymentAttempt.update({
    where: { id: lastAttempt.id },
    data: { status: toAttemptStatus(result.status), rawResponse: { sandbox: adapter.isSandboxMode, ...(result.raw as object) } },
  });
  await applyPaymentStatus(payment.id, result.status);

  return loadChargeView(payment.id);
}

export async function getChargeStatus(tenantId: string, paymentId: string) {
  const payment = await prisma.payment.findFirstOrThrow({ where: { id: paymentId, clientId: tenantId } });
  return loadChargeView(payment.id);
}

/**
 * Reembolso. Solo actualiza Payment Core (refundedAmountCents). El asiento contable
 * (LedgerTransaction de reverso) lo crea services/wallet-ledger — Payment Core nunca
 * escribe directo en el Ledger (bounded contexts separados, ver README).
 * El Payment original sigue CAPTURED: "reembolsado" se refleja en refundedAmountCents,
 * no en un estado (Payment State ≠ Financial State).
 */
export async function refundTransaction(
  tenantId: string,
  paymentId: string,
  amountCents: bigint,
  idempotencyKey: string
) {
  const payment = await prisma.payment.findFirstOrThrow({
    where: { id: paymentId, clientId: tenantId },
    include: { attempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } },
  });
  if (payment.status !== 'CAPTURED') {
    throw new Error(`Solo se puede reembolsar un pago CAPTURED (estado actual: ${payment.status}).`);
  }
  const lastAttempt = payment.attempts[0];
  if (!lastAttempt?.externalRef) throw new Error('El pago no tiene externalRef.');

  const captured: bigint = payment.capturedAmountCents;
  const alreadyRefunded: bigint = payment.refundedAmountCents;
  // amountCents = 0 significa reembolso total del saldo aún no reembolsado.
  const toRefund: bigint = amountCents === 0n ? captured - alreadyRefunded : amountCents;
  if (toRefund <= 0n || alreadyRefunded + toRefund > captured) {
    throw new Error('Monto de reembolso inválido: excede lo capturado o ya está reembolsado por completo.');
  }

  const adapter = getAdapter(lastAttempt.rail);
  const result = await adapter.refund(lastAttempt.externalRef, toRefund, idempotencyKey);
  if (!result.accepted) {
    throw new Error(`El riel rechazó el reembolso: ${result.failureReason ?? 'sin detalle'}`);
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { refundedAmountCents: { increment: toRefund } },
  });
  return loadChargeView(payment.id);
}

export async function handleRailWebhook(rail: PaymentRail, rawBody: string, headers: Record<string, string>) {
  const adapter = getAdapter(rail);

  if (!adapter.verifyWebhookSignature(rawBody, headers)) {
    throw new Error(`Firma de webhook inválida o no verificable para "${rail}" — rechazado.`);
  }

  const event = adapter.parseWebhook(rawBody, headers);

  const attempt = await prisma.paymentAttempt.findFirst({ where: { externalRef: event.externalRef } });
  if (!attempt) {
    throw new Error(`Webhook recibido para externalRef desconocido: ${event.externalRef}`);
  }

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: toAttemptStatus(event.status), rawResponse: (event.raw ?? {}) as object },
  });

  await applyPaymentStatus(attempt.paymentId, event.status);

  return { accepted: true };
}
