import { randomUUID } from 'crypto';
import type {
  PaymentRailAdapter,
  CreateChargeParams,
  ChargeIntentResult,
  ParsedWebhookEvent,
  RefundResult,
} from './payment-rail-adapter.interface';

/**
 * Adaptador de tarjetas (Visa/Mastercard) — y, por extensión, Apple Pay / Google Pay,
 * que viajan como un método de pago MÁS dentro del mismo PSP, no como rieles aparte.
 *
 * ⚠️ DECISIÓN DE ARQUITECTURA IMPORTANTE (ver documento 03, secciones 2-3):
 * PlentyPay NO se conecta directo a Visa/Mastercard ni implementa un kernel EMV.
 * Se conecta a un PSP/adquirente ya certificado (ej. un procesador con presencia
 * en Panamá) que expone Visa/Mastercard/Apple Pay/Google Pay/3-D Secure detrás de
 * UNA sola integración. Este adaptador está escrito de forma genérica porque el
 * PSP exacto es una decisión de negocio (costo, soporte en Panamá, soporte de
 * Tap to Pay) que todavía no has tomado — cuando la tomes, esta es la única
 * clase que hay que reescribir; el resto de PlentyPay no se entera del cambio.
 *
 * ⚠️ ESTADO REAL: SANDBOX. No hay PSP conectado — simula respuestas para que el
 * checkout, el wallet y la conciliación se puedan construir ya.
 */
export class CardNetworkAdapter implements PaymentRailAdapter {
  readonly railName = 'CARD_NETWORK'; // Visa, Mastercard, Apple Pay, Google Pay

  private readonly pspApiKey = process.env.CARD_PSP_API_KEY ?? '';
  private readonly pspApiBaseUrl = process.env.CARD_PSP_API_BASE_URL ?? '';
  private readonly webhookSigningSecret = process.env.CARD_PSP_WEBHOOK_SECRET ?? '';

  get isSandboxMode(): boolean {
    return !this.pspApiKey || !this.pspApiBaseUrl;
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) return this.simulateCreateCharge(params);

    // TODO(producción): reemplazar por la llamada real al PSP elegido (ej. crear
    // un "payment intent" / "checkout session"). El PAN de la tarjeta NUNCA debe
    // pasar por este servicio — el PSP lo captura directamente en su SDK/formulario
    // hospedado y aquí solo se recibe un token. Esto es lo que mantiene a PlentyPay
    // fuera del alcance PCI-DSS pesado (ver documento 02, sección 11).
    throw new Error('CardNetworkAdapter: conecta un PSP real antes de usar en producción.');
  }

  async confirmCharge(
    externalRef: string,
    _confirmationData: Record<string, string>
  ): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return { externalRef, status: 'CAPTURED', raw: { simulated: true } };
    }
    throw new Error('CardNetworkAdapter.confirmCharge: pendiente en producción.');
  }

  async getStatus(externalRef: string): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return { externalRef, status: 'CAPTURED', raw: { simulated: true } };
    }
    throw new Error('CardNetworkAdapter.getStatus: pendiente en producción.');
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    if (this.isSandboxMode) return true;
    if (!this.webhookSigningSecret) return false; // fail-closed
    // TODO(producción): verificación HMAC/firma real según el PSP elegido
    // (la mayoría de PSPs documentan esto públicamente, a diferencia de Yappy/TELERED).
    return false;
  }

  parseWebhook(rawBody: string, _headers: Record<string, string>): ParsedWebhookEvent {
    const parsed = JSON.parse(rawBody || '{}');
    return { externalRef: parsed.id ?? 'sandbox-unknown', status: 'CAPTURED', raw: parsed };
  }

  async refund(externalRef: string, amountCents: bigint): Promise<RefundResult> {
    if (this.isSandboxMode) {
      return { externalRef, accepted: true, raw: { simulated: true } };
    }
    throw new Error('CardNetworkAdapter.refund: pendiente en producción.');
  }

  private async simulateCreateCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    const externalRef = `CARD-SANDBOX-${randomUUID()}`;
    return {
      externalRef,
      status: 'REQUIRES_ACTION',
      nextActionUrl: `https://sandbox.example/checkout/${externalRef}`,
      raw: { simulated: true, params: { ...params, amountCents: params.amountCents.toString() } },
    };
  }
}
