import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {
  createChargeIntent,
  confirmChargeIntent,
  getChargeStatus,
  refundTransaction,
  handleRailWebhook,
} from './orchestrator.service';
import type { PaymentRail } from '@prisma/client';

const PROTO_PATH = path.join(__dirname, '../proto/payments.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false, // camelCase en JS, aunque el .proto use snake_case
  longs: String, // int64 (amount_cents) llega como string — evita perder precisión en Number de JS
  enums: String, // enums llegan como su nombre ("YAPPY"), no como índice numérico
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
const PaymentOrchestratorService = proto.plentypay.payments.v1.PaymentOrchestrator.service;

function toBigInt(value: string | number | undefined | null): bigint {
  return BigInt(value ?? 0);
}

/** Forma común de un cobro tal como lo devuelve orchestrator.service (Payment + intent + último intento). */
interface ChargeView {
  id: string;
  status: string;
  capturedAmountCents: bigint;
  intent: { amountCents: bigint; currency: string };
  attempts: Array<{ externalRef: string | null; failureCode: string | null; rawResponse: unknown }>;
}

function attemptExtras(view: ChargeView) {
  const attempt = view.attempts[0];
  const raw = (attempt?.rawResponse ?? {}) as Record<string, unknown>;
  return {
    externalRef: attempt?.externalRef ?? '',
    failureReason: attempt?.failureCode ?? '',
    sandbox: raw.sandbox === true,
    nextActionUrl: typeof raw.nextActionUrl === 'string' ? raw.nextActionUrl : '',
    nextActionQrPayload: typeof raw.nextActionQrPayload === 'string' ? raw.nextActionQrPayload : '',
  };
}

function toChargeIntent(view: ChargeView) {
  const extras = attemptExtras(view);
  return {
    transactionId: view.id,
    status: view.status,
    nextActionUrl: extras.nextActionUrl,
    nextActionQrPayload: extras.nextActionQrPayload,
    sandbox: extras.sandbox,
  };
}

function toChargeResult(view: ChargeView) {
  const extras = attemptExtras(view);
  const amount = view.capturedAmountCents > 0n ? view.capturedAmountCents : view.intent.amountCents;
  return {
    transactionId: view.id,
    status: view.status,
    amountCents: amount.toString(),
    currency: view.intent.currency,
    ...extras,
  };
}

function toGrpcError(err: unknown): grpc.ServiceError {
  const message = err instanceof Error ? err.message : 'Error interno';
  return { code: grpc.status.INTERNAL, message, name: 'OrchestratorError', details: message, metadata: new grpc.Metadata() };
}

const server = new grpc.Server();

server.addService(PaymentOrchestratorService, {
  createChargeIntent: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const view = (await createChargeIntent({
        tenantId: req.tenantId,
        amountCents: toBigInt(req.amountCents),
        currency: req.currency || 'USD',
        rail: req.rail as PaymentRail,
        idempotencyKey: req.idempotencyKey,
        reference: req.reference,
        metadata: req.metadata,
      })) as unknown as ChargeView;
      callback(null, toChargeIntent(view));
    } catch (err) {
      callback(toGrpcError(err), null);
    }
  },

  confirmChargeIntent: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const view = (await confirmChargeIntent(req.tenantId, req.transactionId, req.confirmationData || {})) as unknown as ChargeView;
      callback(null, toChargeResult(view));
    } catch (err) {
      callback(toGrpcError(err), null);
    }
  },

  getChargeStatus: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const view = (await getChargeStatus(req.tenantId, req.transactionId)) as unknown as ChargeView;
      callback(null, toChargeResult(view));
    } catch (err) {
      callback(toGrpcError(err), null);
    }
  },

  refundTransaction: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const view = (await refundTransaction(
        req.tenantId,
        req.transactionId,
        toBigInt(req.amountCents),
        req.idempotencyKey
      )) as unknown as ChargeView;
      callback(null, toChargeResult(view));
    } catch (err) {
      callback(toGrpcError(err), null);
    }
  },

  handleRailWebhook: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    try {
      const req = call.request;
      const result = await handleRailWebhook(req.rail as PaymentRail, req.rawBody, req.headers || {});
      callback(null, { accepted: result.accepted, message: 'ok' });
    } catch (err) {
      callback(null, { accepted: false, message: err instanceof Error ? err.message : 'error' });
    }
  },
});

const PORT = process.env.PORT ?? '50051';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
  if (err) {
    console.error('payments-orchestrator: fallo al iniciar', err);
    process.exit(1);
  }
  // createInsecure() es solo para desarrollo local. En Kubernetes la terminación
  // TLS/mTLS real la aporta el service mesh (Linkerd/Cilium) o Envoy — documento 02, sección 5.
  console.log(`payments-orchestrator escuchando en el puerto ${boundPort} (modo inseguro — solo dev)`);
});
