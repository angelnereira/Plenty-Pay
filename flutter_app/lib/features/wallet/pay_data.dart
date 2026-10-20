import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/pay/qr_scanner.dart';
import 'wallet_data.dart';

/// Operación con que se pide el step-up de un pago con terminal (payments-core SPEC R5).
const stepUpPaymentCreate = 'payments.intent.create';

/// Código de cobro resuelto por el servidor (`PublicTerminalInfo`, R16): el nombre es el
/// VERIFICADO por identity, nunca el contenido del QR.
class PayLink {
  const PayLink(
      {required this.code, required this.label, required this.merchantName});

  factory PayLink.fromJson(String code, Map<String, dynamic> j) => PayLink(
        code: code,
        label: j['label'] as String? ?? '',
        merchantName: j['merchant_name'] as String? ?? '',
      );

  final String code;
  final String label;
  final String merchantName;
}

/// Desglose de QuoteFees (contrato: gross == merchant_net + Σ líneas; con portador CUSTOMER
/// `gross` es lo que paga la persona).
class PayQuote {
  const PayQuote(
      {required this.baseMinor,
      required this.totalMinor,
      required this.platformFeeMinor,
      required this.taxMinor});

  factory PayQuote.fromJson(int baseMinor, Map<String, dynamic> j) {
    int line(String kind) {
      for (final l in (j['lines'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()) {
        if (l['kind'] == kind) {
          return minorUnits(
              (l['amount'] as Map<String, dynamic>?)?['amount_minor']);
        }
      }
      return 0;
    }

    return PayQuote(
      baseMinor: baseMinor,
      totalMinor:
          minorUnits((j['gross'] as Map<String, dynamic>?)?['amount_minor']),
      platformFeeMinor: line('PLATFORM'),
      taxMinor: line('TAX'),
    );
  }

  final int baseMinor;
  final int totalMinor;
  final int platformFeeMinor;
  final int taxMinor;

  /// N-CON-01: las líneas de comisión se muestran solo si las paga la persona.
  bool get customerPaysFees => totalMinor > baseMinor;
}

/// Estado de un intent tal como lo devuelve el gateway (`PaymentIntent`).
class PayIntent {
  const PayIntent(
      {required this.id,
      required this.status,
      required this.paymentId,
      required this.amountMinor,
      required this.sandbox});

  factory PayIntent.fromJson(Map<String, dynamic> j) => PayIntent(
        id: j['payment_intent_id'] as String? ?? '',
        status:
            (j['status'] as String? ?? '').replaceFirst('PAYMENT_STATUS_', ''),
        paymentId: j['payment_id'] as String? ?? '',
        amountMinor:
            minorUnits((j['amount'] as Map<String, dynamic>?)?['amount_minor']),
        sandbox: j['sandbox'] as bool? ?? false,
      );

  final String id;

  /// Sin prefijo: `CAPTURED`, `UNKNOWN`, `PROCESSING`, `FAILED`…
  final String status;
  final String paymentId;
  final int amountMinor;
  final bool sandbox;

  /// F23.4: UNKNOWN y PROCESSING se muestran como "confirmando", nunca como fallo.
  PaymentDisplay get display => switch (status) {
        'PROCESSING' || 'AUTHORIZED' => PaymentDisplay.pending,
        'EXPIRED' => PaymentDisplay.failed,
        _ => paymentDisplayFor(status),
      };
}

/// Mensaje de un rechazo del flujo de pago (reason estable → ARB).
String payErrorMessage(AppLocalizations l10n, Object error) {
  if (walletUnavailable(error)) {
    return error is ApiException && error.reason == 'DEPENDENCY_UNAVAILABLE'
        ? l10n.error_DEPENDENCY_UNAVAILABLE
        : l10n.walletUnavailable;
  }
  if (error is! ApiException) return l10n.errorNoConnection;
  return switch (error.reason) {
    'INSUFFICIENT_FUNDS' => l10n.error_INSUFFICIENT_FUNDS,
    'TENANT_NOT_ACTIVE' => l10n.error_TENANT_NOT_ACTIVE,
    'TERMINAL_INACTIVE' || 'NOT_FOUND' => l10n.error_TERMINAL_INACTIVE,
    'AMOUNT_OUT_OF_RANGE' => l10n.error_AMOUNT_OUT_OF_RANGE,
    'AMOUNT_BELOW_FEES' => l10n.error_AMOUNT_BELOW_FEES,
    'FEE_POLICY_MISSING' => l10n.error_FEE_POLICY_MISSING,
    'RAIL_DISABLED' => l10n.error_RAIL_DISABLED,
    'INVALID_STATE_TRANSITION' => l10n.error_INVALID_STATE_TRANSITION,
    'STEP_UP_REQUIRED' => l10n.error_STEP_UP_REQUIRED,
    'STEP_UP_INVALID' => l10n.error_STEP_UP_INVALID,
    'PERMISSION_DENIED' => l10n.error_PERMISSION_DENIED,
    _ => l10n.errorGeneric(error.reason),
  };
}
