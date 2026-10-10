import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {
  getBalance,
  createHold,
  releaseHold,
  captureHold,
  creditWallet,
  debitWallet,
  prisma,
} from './wallet.service';

const PROTO_PATH = path.join(__dirname, '../proto/wallet.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
const WalletLedgerService = proto.plentypay.wallet.v1.WalletLedger.service;

const toBigInt = (v: string | number | undefined | null) => BigInt(v ?? 0);
const toStr = (v: bigint | undefined | null) => (v ?? 0n).toString();

function toGrpcError(err: unknown): grpc.ServiceError {
  const message = err instanceof Error ? err.message : 'Error interno';
  return { code: grpc.status.INTERNAL, message, name: 'WalletLedgerError', details: message, metadata: new grpc.Metadata() };
}

/**
 * El wire contract (wallet.proto) se definió antes de separar Ledger en
 * LedgerTransaction+LedgerEntry (ver README.md, "Historial de diseño"), así
 * que `ledger_entry_id` en la respuesta representa el id de la
 * LedgerTransaction resultante (que agrupa 2+ LedgerEntry), no de una sola
 * línea. `running_balance_cents` se resuelve consultando el saldo fresco del
 * Wallet después de la operación — la "cuenta corriente para humanos", no el
 * balance de una LedgerAccount contable individual.
 */
async function ledgerResultFor(entityId: string, ledgerTransaction: { id: string }, amountCents: bigint) {
  const wallet = await prisma.wallet.findUnique({ where: { entityId } });
  return {
    ledgerEntryId: ledgerTransaction.id,
    amountCents: toStr(amountCents),
    runningBalanceCents: toStr(wallet?.availableBalanceCents ?? 0n),
  };
}

const server = new grpc.Server();

server.addService(WalletLedgerService, {
  getBalance: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const wallet = await getBalance(req.tenantId, req.entityId);
      cb(null, {
        walletId: wallet.id,
        currency: wallet.currency,
        availableCents: toStr(wallet.availableBalanceCents),
        heldCents: toStr(wallet.heldBalanceCents),
        pendingSettlementCents: toStr(wallet.pendingSettlementCents),
      });
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },

  createHold: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const hold = await createHold({
        tenantId: req.tenantId,
        entityId: req.entityId,
        amountCents: toBigInt(req.amountCents),
        reason: req.reason,
        idempotencyKey: req.idempotencyKey,
        expiresInSeconds: req.expiresInSeconds,
      });
      cb(null, { holdId: hold.id, status: hold.status, amountCents: toStr(hold.amountCents) });
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },

  releaseHold: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const hold = await releaseHold(call.request.holdId);
      cb(null, { holdId: hold.id, status: hold.status, amountCents: toStr(hold.amountCents) });
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },

  captureHold: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const holdRecord = await prisma.walletHold.findUniqueOrThrow({ where: { id: req.holdId } });
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: holdRecord.walletId } });

      const ledgerTx = await captureHold({
        holdId: req.holdId,
        clientId: req.tenantId,
        merchantEntityId: req.merchantEntityId || 'UNSPECIFIED_MERCHANT',
      });
      const result = await ledgerResultFor(wallet.entityId, ledgerTx, holdRecord.amountCents);
      cb(null, result);
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },

  creditWallet: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const ledgerTx = await creditWallet({
        tenantId: req.tenantId,
        entityId: req.entityId,
        amountCents: toBigInt(req.amountCents),
        reference: req.reference,
        idempotencyKey: req.idempotencyKey,
      });
      const result = await ledgerResultFor(req.entityId, ledgerTx, toBigInt(req.amountCents));
      cb(null, result);
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },

  debitWallet: async (call: grpc.ServerUnaryCall<any, any>, cb: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const ledgerTx = await debitWallet({
        tenantId: req.tenantId,
        entityId: req.entityId,
        amountCents: toBigInt(req.amountCents),
        reference: req.reference,
        idempotencyKey: req.idempotencyKey,
      });
      const result = await ledgerResultFor(req.entityId, ledgerTx, toBigInt(req.amountCents));
      cb(null, result);
    } catch (err) {
      cb(toGrpcError(err), null);
    }
  },
});

const PORT = process.env.PORT ?? '50052';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
  if (err) {
    console.error('wallet-ledger: fallo al iniciar', err);
    process.exit(1);
  }
  console.log(`wallet-ledger escuchando en el puerto ${boundPort} (modo inseguro — solo dev)`);
});
