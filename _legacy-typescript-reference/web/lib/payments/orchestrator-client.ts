import path from "path"
import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"

/**
 * Cliente gRPC del monolito hacia services/payments-orchestrator.
 *
 * El monolito NUNCA integra un riel de pago directamente: todo cobro pasa por el
 * orquestador (documento 03). El contrato vive en /proto/payments.proto (fuente de verdad) y se
 * copia a web/proto con scripts/sync-protos.sh; el Dockerfile lo incluye en la imagen.
 *
 * Solo servidor: importar únicamente desde route handlers / server actions (runtime Node),
 * nunca desde middleware (Edge) ni desde componentes cliente.
 */

export type ChargeStatus =
  | "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "AUTHORIZED"
  | "CAPTURED" | "FAILED" | "CANCELLED" | "EXPIRED" | "UNKNOWN"

export interface CreateChargeIntentParams {
  tenantId: string
  amountCents: number
  currency: string
  rail: string
  idempotencyKey: string
  reference?: string
  metadata?: Record<string, string>
}

export interface ChargeIntentResponse {
  transactionId: string
  status: ChargeStatus
  nextActionUrl: string
  nextActionQrPayload: string
  sandbox: boolean
}

let client: grpc.Client | null = null

function getClient(): grpc.Client & Record<string, (...args: any[]) => void> {
  if (client) return client as any

  const definition = protoLoader.loadSync(path.join(process.cwd(), "proto", "payments.proto"), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  })
  const proto = grpc.loadPackageDefinition(definition) as any
  const Ctor = proto.plentypay.payments.v1.PaymentOrchestrator

  const address = process.env.PAYMENTS_ORCHESTRATOR_URL ?? "localhost:50051"
  // createInsecure() SOLO es aceptable dentro del clúster con mTLS del service mesh / NetworkPolicy
  // (documento 02, sección 5). Fuera de eso, usar credenciales TLS reales.
  client = new Ctor(address, grpc.credentials.createInsecure())
  return client as any
}

function call<T>(method: string, request: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const c = getClient()
    const deadline = new Date(Date.now() + 15_000) // un cobro colgado no debe colgar la petición HTTP
    c[method](request, { deadline }, (err: grpc.ServiceError | null, response: T) => {
      if (err) reject(err)
      else resolve(response)
    })
  })
}

export function createChargeIntent(params: CreateChargeIntentParams) {
  return call<ChargeIntentResponse>("createChargeIntent", {
    tenantId: params.tenantId,
    amountCents: String(params.amountCents), // int64 viaja como string (evita perder precisión)
    currency: params.currency,
    rail: params.rail,
    idempotencyKey: params.idempotencyKey,
    reference: params.reference ?? "",
    metadata: params.metadata ?? {},
  })
}
