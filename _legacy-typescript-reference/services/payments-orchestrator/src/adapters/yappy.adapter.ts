import { randomUUID } from 'crypto';
import type {
  PaymentRailAdapter,
  CreateChargeParams,
  ChargeIntentResult,
  ParsedWebhookEvent,
  RefundResult,
} from './payment-rail-adapter.interface';

/**
 * Adaptador para Yappy (billetera de Banco General).
 *
 * ⚠️ ESTADO REAL: SANDBOX. La API de comercios de Yappy no es pública — Banco
 * General la entrega directamente a comercios aprobados tras el alta como
 * "Yappy Comercios". Este archivo NO inventa esa API (hacerlo produciría código
 * que aparenta funcionar pero nunca cobraría un dólar real).
 *
 * Lo que SÍ hace: simula respuestas realistas (mismos estados, mismo idioma de
 * campos) para que el resto de PlentyPay — checkout, wallet, marketplace,
 * conciliación — se pueda construir y probar de punta a punta HOY, sin bloquear
 * el trabajo en la espera de la aprobación comercial.
 *
 * Para pasar a producción:
 *   1. Solicita el alta como comercio en https://www.yappy.com.pa (sección comercios).
 *   2. Banco General te entregará credenciales + la especificación técnica real
 *      (merchantId, secretKey, endpoints, formato de firma).
 *   3. Reemplaza el cuerpo de cada método marcado con `TODO(producción)` siguiendo
 *      esa especificación. La forma (REST vs. redirect vs. QR) la define Banco
 *      General, no PlentyPay.
 */
export class YappyAdapter implements PaymentRailAdapter {
  readonly railName = 'YAPPY';

  private readonly merchantId = process.env.YAPPY_MERCHANT_ID ?? '';
  private readonly secretKey = process.env.YAPPY_SECRET_KEY ?? '';
  private readonly apiBaseUrl = process.env.YAPPY_API_BASE_URL ?? '';

  get isSandboxMode(): boolean {
    return !this.merchantId || !this.secretKey || !this.apiBaseUrl;
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return this.simulateCreateCharge(params);
    }

    // TODO(producción): llamar al endpoint real de creación de orden de Yappy
    // usando this.merchantId / this.secretKey / this.apiBaseUrl según la
    // especificación que te entregue Banco General.
    throw new Error(
      'YappyAdapter: hay credenciales configuradas pero la llamada real a la API ' +
        'de Yappy Comercios todavía no está implementada. Complétala con la ' +
        'especificación oficial (no pública) que te entregue Banco General.'
    );
  }

  async confirmCharge(
    externalRef: string,
    _confirmationData: Record<string, string>
  ): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return {
        externalRef,
        status: 'CAPTURED',
        raw: { simulated: true, note: 'Confirmación simulada — sin credenciales reales' },
      };
    }
    throw new Error('YappyAdapter.confirmCharge: pendiente de implementar en producción.');
  }

  async getStatus(externalRef: string): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return { externalRef, status: 'CAPTURED', raw: { simulated: true } };
    }
    throw new Error('YappyAdapter.getStatus: pendiente de implementar en producción.');
  }

  verifyWebhookSignature(_rawBody: string, _headers: Record<string, string>): boolean {
    if (this.isSandboxMode) return true;
    // TODO(producción): verificar firma/HMAC real según especificación de Banco General.
    // Por seguridad, mientras no esté implementado, un webhook real DEBE rechazarse
    // (fail-closed), nunca aceptarse a ciegas.
    return false;
  }

  parseWebhook(rawBody: string, _headers: Record<string, string>): ParsedWebhookEvent {
    const parsed = JSON.parse(rawBody || '{}');
    return {
      externalRef: parsed.externalRef ?? 'sandbox-unknown',
      status: 'CAPTURED',
      raw: parsed,
    };
  }

  async refund(
    externalRef: string,
    amountCents: bigint,
    _idempotencyKey: string
  ): Promise<RefundResult> {
    if (this.isSandboxMode) {
      return { externalRef, accepted: true, raw: { simulated: true } };
    }
    throw new Error('YappyAdapter.refund: pendiente de implementar en producción.');
  }

  private async simulateCreateCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    const externalRef = `YAPPY-SANDBOX-${randomUUID()}`;
    return {
      externalRef,
      status: 'REQUIRES_ACTION',
      // Yappy real funciona con QR/deep-link de aprobación en la app del cliente;
      // esto simula esa forma para que el frontend pueda construir esa UX ya mismo.
      nextActionQrPayload: `plentypay-sandbox://yappy/approve/${externalRef}`,
      raw: { simulated: true, params: { ...params, amountCents: params.amountCents.toString() } },
    };
  }
}
