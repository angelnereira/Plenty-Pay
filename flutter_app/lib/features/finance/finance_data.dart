import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/wallet_data.dart';

/// Un cobro del negocio (`payments.Payment` vía `/v1/payments`). Montos enteros (ADR 0013).
class PaymentItem {
  const PaymentItem(
      {required this.id,
      required this.status,
      required this.capturedMinor,
      required this.refundedMinor,
      required this.amountMinor,
      required this.netMinor,
      required this.feesMinor,
      required this.createdAt});

  factory PaymentItem.fromJson(Map<String, dynamic> j) {
    int money(Object? m) =>
        minorUnits((m as Map<String, dynamic>?)?['amount_minor']);
    final fees = j['fees'] as Map<String, dynamic>?;
    var feeLines = 0;
    for (final l in (fees?['lines'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()) {
      feeLines += money(l['amount']);
    }
    return PaymentItem(
      id: j['payment_id'] as String? ?? '',
      status:
          (j['status'] as String? ?? '').replaceFirst('PAYMENT_STATUS_', ''),
      capturedMinor: money(j['captured']),
      refundedMinor: money(j['refunded']),
      amountMinor: money(j['amount']),
      netMinor: money(fees?['merchant_net']),
      feesMinor: feeLines,
      createdAt:
          DateTime.tryParse(j['created_at'] as String? ?? '')?.toLocal() ??
              DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  final String id;
  final String status;
  final int capturedMinor;
  final int refundedMinor;
  final int amountMinor;
  final int netMinor;
  final int feesMinor;
  final DateTime createdAt;
}

/// S-FIN-02: etiqueta y tono del estado. UNKNOWN y PROCESSING son «Confirmando», nunca
/// «Rechazado» (domain-model §6.3).
(String, StatusTone) paymentStatusChip(AppLocalizations l10n, String status) =>
    switch (status) {
      'CAPTURED' => (l10n.paymentStatus_CAPTURED, StatusTone.success),
      'UNKNOWN' || 'PROCESSING' || 'AUTHORIZED' => (
          l10n.paymentStatus_CONFIRMING,
          StatusTone.warning
        ),
      'FAILED' => (l10n.paymentStatus_FAILED, StatusTone.error),
      'CANCELLED' => (l10n.paymentStatus_CANCELLED, StatusTone.neutral),
      'EXPIRED' => (l10n.paymentStatus_EXPIRED, StatusTone.neutral),
      _ => (l10n.paymentStatus_PENDING, StatusTone.info),
    };

/// Hasta [maxPages] páginas de cobros, más recientes primero.
Future<List<PaymentItem>> loadPayments(ApiClient api,
    {int maxPages = 10}) async {
  final out = <PaymentItem>[];
  var token = '';
  for (var page = 0; page < maxPages; page++) {
    final body = await api.listPayments(pageSize: 200, pageToken: token);
    out.addAll([
      for (final p in (body['payments'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        PaymentItem.fromJson(p),
    ]);
    token = (body['page'] as Map<String, dynamic>?)?['next_page_token']
            as String? ??
        '';
    if (token.isEmpty) break;
  }
  return out;
}

/// S-FIN-01 e2: totales de los cobros capturados desde [since].
class FinanceTotals {
  const FinanceTotals(
      {required this.capturedMinor,
      required this.feesMinor,
      required this.refundedMinor,
      required this.netMinor});

  factory FinanceTotals.of(Iterable<PaymentItem> payments, DateTime since) {
    var captured = 0, fees = 0, refunded = 0, net = 0;
    for (final p in payments) {
      if (p.status != 'CAPTURED' || p.createdAt.isBefore(since)) continue;
      captured += p.capturedMinor;
      fees += p.feesMinor;
      refunded += p.refundedMinor;
      net += p.netMinor;
    }
    return FinanceTotals(
        capturedMinor: captured,
        feesMinor: fees,
        refundedMinor: refunded,
        netMinor: net);
  }

  final int capturedMinor;
  final int feesMinor;
  final int refundedMinor;
  final int netMinor;
}
