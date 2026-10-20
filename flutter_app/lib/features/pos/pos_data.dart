import '../../core/api/api_client.dart';
import '../catalog/catalog_data.dart';
import '../wallet/wallet_data.dart' show minorUnits;

/// round_half_up(a × b / c) con enteros no negativos (domain-model §4). Misma regla que pos.
int halfUp(int a, int b, int c) => (a * b + c ~/ 2) ~/ c;

/// Una línea del ticket mientras se arma (precio de catálogo, ITBMS incluido).
class TicketLine {
  TicketLine(this.product, this.qtyMilli);
  final ProductItem product;
  int qtyMilli;

  int get totalMinor => halfUp(product.priceMinor, qtyMilli, 1000);

  /// R2: con impuesto incluido, tax = total − round_half_up(total × 10000 / (10000 + tasa)).
  int get taxMinor =>
      totalMinor - halfUp(totalMinor, 10000, 10000 + product.taxRateBps);
}

/// Totales de la vista previa: el total de la venta lo fija el servidor al guardar las líneas.
class TicketTotals {
  const TicketTotals(
      {required this.subtotalMinor,
      required this.totalMinor,
      required this.taxByRate,
      required this.exemptMinor});
  final int subtotalMinor;
  final int totalMinor;

  /// Impuesto por tasa (bps → centavos), una fila por tasa presente (S-POS-02 e8).
  final Map<int, int> taxByRate;
  final int exemptMinor;

  factory TicketTotals.of(Iterable<TicketLine> lines) {
    var total = 0, exempt = 0;
    final byRate = <int, int>{};
    for (final l in lines) {
      total += l.totalMinor;
      if (l.product.taxRateBps == 0) {
        exempt += l.totalMinor;
      } else {
        byRate[l.product.taxRateBps] =
            (byRate[l.product.taxRateBps] ?? 0) + l.taxMinor;
      }
    }
    final tax = byRate.values.fold(0, (a, b) => a + b);
    return TicketTotals(
        subtotalMinor: total - tax,
        totalMinor: total,
        taxByRate: byRate,
        exemptMinor: exempt);
  }
}

/// Sesión de caja (`pos.CashSession`).
class SessionItem {
  const SessionItem({
    required this.id,
    required this.terminalCode,
    required this.status,
    required this.openingFloatMinor,
    required this.expectedCashMinor,
    required this.countedCashMinor,
    required this.differenceMinor,
  });

  factory SessionItem.fromJson(Map<String, dynamic> j) {
    int money(String k) =>
        minorUnits((j[k] as Map<String, dynamic>?)?['amount_minor']);
    return SessionItem(
      id: j['session_id'] as String? ?? '',
      terminalCode: j['terminal_label'] as String? ?? '',
      status: j['status'] as String? ?? '',
      openingFloatMinor: money('opening_float'),
      expectedCashMinor: money('expected_cash'),
      countedCashMinor: money('counted_cash'),
      differenceMinor: money('difference'),
    );
  }

  final String id;
  final String terminalCode;
  final String status;
  final int openingFloatMinor;
  final int expectedCashMinor;
  final int countedCashMinor;
  final int differenceMinor;

  bool get isOpen => status == 'OPEN';
}

/// Línea guardada de una venta (instantánea del servidor).
class SaleLineItem {
  const SaleLineItem(
      {required this.description,
      required this.qtyMilli,
      required this.unitPriceMinor,
      required this.taxRateBps,
      required this.totalMinor});

  factory SaleLineItem.fromJson(Map<String, dynamic> j) => SaleLineItem(
        description: j['description'] as String? ?? '',
        qtyMilli: minorUnits(j['quantity_milli']),
        unitPriceMinor: minorUnits(
            (j['unit_price'] as Map<String, dynamic>?)?['amount_minor']),
        taxRateBps: (j['tax_rate_bps'] as num?)?.toInt() ?? 0,
        totalMinor: minorUnits(
            (j['line_total'] as Map<String, dynamic>?)?['amount_minor']),
      );

  final String description;
  final int qtyMilli;
  final int unitPriceMinor;
  final int taxRateBps;
  final int totalMinor;
}

/// Un medio de pago de la venta.
class TenderItem {
  const TenderItem(
      {required this.rail,
      required this.amountMinor,
      required this.cashTenderedMinor,
      required this.status,
      required this.qrPayload});

  factory TenderItem.fromJson(Map<String, dynamic> j) => TenderItem(
        rail: (j['rail'] as String? ?? '').replaceFirst('PAYMENT_RAIL_', ''),
        amountMinor:
            minorUnits((j['amount'] as Map<String, dynamic>?)?['amount_minor']),
        cashTenderedMinor: minorUnits(
            (j['cash_tendered'] as Map<String, dynamic>?)?['amount_minor']),
        status: j['status'] as String? ?? '',
        qrPayload: (j['next_action'] as Map<String, dynamic>?)?['qr_payload']
                as String? ??
            '',
      );

  final String rail;
  final int amountMinor;
  final int cashTenderedMinor;
  final String status;
  final String qrPayload;
}

/// Una venta (`pos.Sale`).
class SaleItem {
  const SaleItem({
    required this.id,
    required this.status,
    required this.lines,
    required this.tenders,
    required this.subtotalMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.changeMinor,
    required this.receiptNumber,
    required this.createdAt,
    required this.version,
  });

  factory SaleItem.fromJson(Map<String, dynamic> j) {
    int money(String k) =>
        minorUnits((j[k] as Map<String, dynamic>?)?['amount_minor']);
    List<Map<String, dynamic>> list(String k) =>
        (j[k] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    return SaleItem(
      id: j['sale_id'] as String? ?? '',
      status: (j['status'] as String? ?? '').replaceFirst('SALE_STATUS_', ''),
      lines: [for (final l in list('lines')) SaleLineItem.fromJson(l)],
      tenders: [for (final t in list('tenders')) TenderItem.fromJson(t)],
      subtotalMinor: money('subtotal'),
      taxMinor: money('tax'),
      totalMinor: money('total'),
      changeMinor: money('change_due'),
      receiptNumber: j['receipt_number'] as String? ?? '',
      createdAt:
          DateTime.tryParse(j['created_at'] as String? ?? '')?.toLocal() ??
              DateTime.fromMillisecondsSinceEpoch(0),
      version: (j['version'] as num?)?.toInt() ?? 0,
    );
  }

  final String id;
  final String status;
  final List<SaleLineItem> lines;
  final List<TenderItem> tenders;
  final int subtotalMinor;
  final int taxMinor;
  final int totalMinor;
  final int changeMinor;
  final String receiptNumber;
  final DateTime createdAt;
  final int version;

  bool get isPaid => status == 'PAID';

  /// Impuesto por tasa calculado de las líneas guardadas (para el recibo).
  Map<int, int> get taxByRate {
    final out = <int, int>{};
    for (final l in lines) {
      if (l.taxRateBps == 0) continue;
      out[l.taxRateBps] = (out[l.taxRateBps] ?? 0) +
          l.totalMinor -
          halfUp(l.totalMinor, 10000, 10000 + l.taxRateBps);
    }
    return out;
  }

  int get exemptMinor =>
      lines.where((l) => l.taxRateBps == 0).fold(0, (a, l) => a + l.totalMinor);

  /// QR del medio de billetera pendiente (vacío si no hay).
  String get pendingWalletQr =>
      tenders
          .where((t) => t.rail == 'WALLET' && t.status == 'PENDING')
          .map((t) => t.qrPayload)
          .firstOrNull ??
      '';

  bool get walletFailed =>
      tenders.any((t) => t.rail == 'WALLET' && t.status == 'FAILED');
}

/// Sesión abierta del cajero, o null si no tiene (404).
Future<SessionItem?> loadCurrentSession(ApiClient api) async {
  try {
    return SessionItem.fromJson(await api.currentCashSession());
  } on ApiException catch (e) {
    if (e.reason == 'NOT_FOUND') return null;
    rethrow;
  }
}

Future<List<SaleItem>> loadSessionSales(ApiClient api, String sessionId) async {
  final body = await api.listSales(sessionId: sessionId);
  return [
    for (final s in (body['sales'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      SaleItem.fromJson(s),
  ];
}
