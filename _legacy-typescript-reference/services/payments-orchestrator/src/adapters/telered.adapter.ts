import { randomUUID } from 'crypto';
import type {
  PaymentRailAdapter,
  CreateChargeParams,
  ChargeIntentResult,
  ParsedWebhookEvent,
  RefundResult,
} from './payment-rail-adapter.interface';

/**
 * Adaptador para TELERED — la "autopista transaccional" de Panamá: ACH Xpress
 * (transferencias interbancarias instantáneas por número de celular) y la red
 * de Tarjeta Clave (débito interbancario, con soporte creciente de contactless).
 *
 * ⚠️ ESTADO REAL: SANDBOX. Igual que con Yappy, la integración formal con
 * TELERED se hace como comercio/facturador afiliado, normalmente coordinada a
 * través de tu banco patrocinador — la especificación técnica exacta no es
 * pública. Este adaptador simula el flujo para desarrollo, y deja el punto
 * exacto donde va la llamada real, sin inventarla.
 *
 * Para producción: contacta a TELERED (o a tu banco patrocinador) para el alta
 * como comercio/facturador y la especificación de integración real.
 */
export class TeleredAdapter implements PaymentRailAdapter {
  readonly railName = 'TELERED_CLAVE';

  private readonly affiliateCode = process.env.TELERED_AFFILIATE_CODE ?? '';
  private readonly apiKey = process.env.TELERED_API_KEY ?? '';
  private readonly apiBaseUrl = process.env.TELERED_API_BASE_URL ?? '';

  get isSandboxMode(): boolean {
    return !this.affiliateCode || !this.apiKey || !this.apiBaseUrl;
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) return this.simulateCreateCharge(params);

    // TODO(producción): llamar al endpoint real de TELERED / ACH Xpress según
    // la especificación entregada por TELERED o tu banco patrocinador.
    throw new Error(
      'TeleredAdapter: credenciales detectadas pero la llamada real no está ' +
        'implementada — complétala con la especificación oficial de TELERED.'
    );
  }

  async confirmCharge(externalRef: string): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return { externalRef, status: 'CAPTURED', raw: { simulated: true } };
    }
    throw new Error('TeleredAdapter.confirmCharge: pendiente de implementar en producción.');
  }

  async getStatus(externalRef: string): Promise<ChargeIntentResult> {
    if (this.isSandboxMode) {
      return { externalRef, status: 'CAPTURED', raw: { simulated: true } };
    }
    throw new Error('TeleredAdapter.getStatus: pendiente de implementar en producción.');
  }

  verifyWebhookSignature(): boolean {
    if (this.isSandboxMode) return true;
    // TODO(producción): verificación real — fail-closed hasta implementarla.
    return false;
  }

  parseWebhook(rawBody: string): ParsedWebhookEvent {
    const parsed = JSON.parse(rawBody || '{}');
    return { externalRef: parsed.externalRef ?? 'sandbox-unknown', status: 'CAPTURED', raw: parsed };
  }

  async refund(externalRef: string, amountCents: bigint): Promise<RefundResult> {
    if (this.isSandboxMode) {
      return { externalRef, accepted: true, raw: { simulated: true } };
    }
    throw new Error('TeleredAdapter.refund: pendiente de implementar en producción.');
  }

  private async simulateCreateCharge(params: CreateChargeParams): Promise<ChargeIntentResult> {
    const externalRef = `TELERED-SANDBOX-${randomUUID()}`;
    return {
      externalRef,
      status: 'PROCESSING',
      raw: { simulated: true, params: { ...params, amountCents: params.amountCents.toString() } },
    };
  }
}
