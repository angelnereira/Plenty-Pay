/**
 * Contrato común que implementa cada riel de pago (Yappy, TELERED, tarjetas...).
 * El resto del orquestador SOLO habla con esta interfaz — nunca con el SDK/API
 * particular de un riel. Agregar un riel nuevo (ej. Kuara, Zinli) es escribir un
 * adaptador nuevo, no tocar el core. Ver documento 02, sección 3 (patrón Adapter,
 * el mismo que ya usas para HKA).
 */

/**
 * Vocabulario de estados = el del Payment Core (PaymentIntentStatus), NO el de
 * cada riel. Cada adaptador traduce lo que diga su riel a estos valores.
 * UNKNOWN es un estado de primera clase: un timeout NO es un fallo (el riel
 * pudo haber cobrado y solo la respuesta no llegó) — ver feedback punto 8.
 */
export type ChargeStatusValue =
  | 'PROCESSING'
  | 'REQUIRES_ACTION' // el usuario debe hacer algo (aprobar en su app, 3-D Secure) — suele venir con nextAction*
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface RefundResult {
  externalRef?: string;
  accepted: boolean;
  failureReason?: string;
  raw?: unknown;
}

export interface CreateChargeParams {
  tenantId: string;
  amountCents: bigint;
  currency: string;
  idempotencyKey: string;
  reference?: string;
  metadata?: Record<string, string>;
}

export interface ChargeIntentResult {
  externalRef?: string;
  status: ChargeStatusValue;
  /** Presente si el riel requiere un paso adicional del usuario (redirect, QR). */
  nextActionUrl?: string;
  nextActionQrPayload?: string;
  failureReason?: string;
  /** Respuesta cruda del riel, para auditoría/soporte (se guarda en PaymentTransaction.rawResponse). */
  raw?: unknown;
}

export interface ParsedWebhookEvent {
  externalRef: string;
  status: ChargeStatusValue;
  raw: unknown;
}

export interface PaymentRailAdapter {
  readonly railName: string;

  /** true si el adaptador está corriendo en modo simulado por falta de credenciales reales. */
  readonly isSandboxMode: boolean;

  createCharge(params: CreateChargeParams): Promise<ChargeIntentResult>;

  confirmCharge(
    externalRef: string,
    confirmationData: Record<string, string>
  ): Promise<ChargeIntentResult>;

  getStatus(externalRef: string): Promise<ChargeIntentResult>;

  /** Verifica firma/HMAC del webhook. DEBE rechazar si no hay forma de verificar en producción. */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;

  parseWebhook(rawBody: string, headers: Record<string, string>): ParsedWebhookEvent;

  refund(externalRef: string, amountCents: bigint, idempotencyKey: string): Promise<RefundResult>;
}
