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
    this.zReport,
  });

  factory SessionItem.fromJson(Map<String, dynamic> j) {
    int money(String k) =>
        minorUnits((j[k] as Map<String, dynamic>?)?['amount_minor']);
    final z = j['z_report'] as Map<String, dynamic>?;
    return SessionItem(
      zReport: z == null ? null : ZReportItem.fromJson(z),
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

  /// F17.3 (R16 de pos): solo en una sesión cerrada.
  final ZReportItem? zReport;

  bool get isOpen => status == 'OPEN';
}

/// Billetes y monedas que se cuentan al cerrar (S-POS-10 e1), en centavos de menor a mayor. Son de
/// la moneda (USD/PAB), no valores legales; el servidor valida la misma tabla (R16 de pos).
const cashDenominationsMinor = [
  1,
  5,
  10,
  25,
  50,
  100,
  500,
  1000,
  2000,
  5000,
  10000
];

/// Una línea del reporte Z (`pos.ZReportLine`): `key` como `rail:CASH`, `tax:700`, `voids`.
class ZReportLineItem {
  const ZReportLineItem(
      {required this.key, required this.amountMinor, required this.count});
  final String key;
  final int amountMinor;
  final int count;

  /// Tasa en puntos básicos de las claves `taxable:<bps>` y `tax:<bps>`; null en las demás.
  int? get rateBps {
    final i = key.indexOf(':');
    if (!key.startsWith('tax')) return null;
    return int.tryParse(key.substring(i + 1));
  }
}

/// Reporte Z de una sesión cerrada (`pos.ZReport`).
class ZReportItem {
  const ZReportItem(
      {required this.lines,
      required this.grossSalesMinor,
      required this.refundsMinor,
      required this.netSalesMinor,
      required this.salesCount});

  factory ZReportItem.fromJson(Map<String, dynamic> j) {
    int money(Object? m) =>
        minorUnits((m as Map<String, dynamic>?)?['amount_minor']);
    return ZReportItem(
      lines: [
        for (final l
            in (j['lines'] as List? ?? const []).cast<Map<String, dynamic>>())
          ZReportLineItem(
              key: l['key'] as String? ?? '',
              amountMinor: money(l['amount']),
              count: _int(l['count'])),
      ],
      grossSalesMinor: money(j['gross_sales']),
      refundsMinor: money(j['refunds']),
      netSalesMinor: money(j['net_sales']),
      salesCount: _int(j['sales_count']),
    );
  }

  final List<ZReportLineItem> lines;
  final int grossSalesMinor;
  final int refundsMinor;
  final int netSalesMinor;
  final int salesCount;
}

/// Línea guardada de una venta (instantánea del servidor).
class SaleLineItem {
  const SaleLineItem(
      {this.id = '',
      this.productId = '',
      required this.description,
      required this.qtyMilli,
      required this.unitPriceMinor,
      required this.taxRateBps,
      required this.totalMinor,
      this.refundedMilli = 0,
      this.refundedMinor = 0});

  factory SaleLineItem.fromJson(Map<String, dynamic> j) => SaleLineItem(
        id: j['line_id'] as String? ?? '',
        refundedMilli: minorUnits(j['refunded_milli']),
        refundedMinor: minorUnits(
            (j['refunded'] as Map<String, dynamic>?)?['amount_minor']),
        productId: j['product_id'] as String? ?? '',
        description: j['description'] as String? ?? '',
        qtyMilli: minorUnits(j['quantity_milli']),
        unitPriceMinor: minorUnits(
            (j['unit_price'] as Map<String, dynamic>?)?['amount_minor']),
        taxRateBps: (j['tax_rate_bps'] as num?)?.toInt() ?? 0,
        totalMinor: minorUnits(
            (j['line_total'] as Map<String, dynamic>?)?['amount_minor']),
      );

  final String id;
  final String productId;
  final String description;
  final int qtyMilli;
  final int unitPriceMinor;
  final int taxRateBps;
  final int totalMinor;

  /// F17.9: cantidad y monto ya devueltos.
  final int refundedMilli;
  final int refundedMinor;

  int get pendingMilli => qtyMilli - refundedMilli;
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
    this.parkLabel = '',
    this.parkedAt,
    this.refundedMinor = 0,
    this.currency = 'USD',
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
      parkLabel: j['park_label'] as String? ?? '',
      parkedAt: DateTime.tryParse(j['parked_at'] as String? ?? '')?.toLocal(),
      refundedMinor: money('refunded'),
      currency: switch ((j['total'] as Map<String, dynamic>?)?['currency']) {
        final String c when c.isNotEmpty => c,
        _ => 'USD',
      },
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

  /// Nota del cajero al estacionar (F17.4) y última vez que se estacionó.
  final String parkLabel;
  final DateTime? parkedAt;

  /// F17.9: total ya devuelto y moneda de la venta (la confirmación fuerte se ata a ambos).
  final int refundedMinor;
  final String currency;

  bool get isPaid => status == 'PAID';

  /// F17.9: se puede devolver una venta pagada o devuelta en parte.
  bool get isRefundable => status == 'PAID' || status == 'PARTIALLY_REFUNDED';

  /// El recibo existe para toda venta cobrada, aunque después se haya devuelto.
  bool get hasReceipt => isRefundable || status == 'REFUNDED';

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

/// Ventas estacionadas de la sesión, la más reciente primero (S-POS-06, F17.4).
Future<List<SaleItem>> loadParkedSales(ApiClient api, String sessionId) async {
  final body = await api.listSales(
      sessionId: sessionId, status: 'SALE_STATUS_PARKED', pageSize: 200);
  final out = [
    for (final s in (body['sales'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      SaleItem.fromJson(s),
  ]..sort((a, b) =>
      (b.parkedAt ?? b.createdAt).compareTo(a.parkedAt ?? a.createdAt));
  return out;
}

/// Vista previa de una devolución con la misma regla que pos (R9): por línea,
/// half_up(total × cantidad / vendida) y, si se devuelve todo lo pendiente, el resto exacto; el
/// reintegro sale primero del último medio de pago. El monto debe coincidir con el del servidor:
/// la confirmación fuerte queda atada a él.
class RefundPreview {
  const RefundPreview(this.totalMinor, this.byRail);
  final int totalMinor;

  /// Medio (`CASH`, `WALLET`) → monto que se reintegra por él.
  final Map<String, int> byRail;
}

/// Monto de una línea por devolver: proporcional half_up y, si se devuelve todo lo pendiente,
/// el resto exacto (la suma de devoluciones de una línea nunca pasa de su total).
int refundLineAmount(SaleLineItem l, int qtyMilli) => qtyMilli >= l.pendingMilli
    ? l.totalMinor - l.refundedMinor
    : halfUp(l.totalMinor, qtyMilli, l.qtyMilli);

RefundPreview refundPreview(SaleItem sale, Map<String, int> qtyByLine) {
  var total = 0;
  for (final l in sale.lines) {
    final q = qtyByLine[l.id] ?? 0;
    if (q <= 0) continue;
    total += refundLineAmount(l, q);
  }
  // Lo ya devuelto antes salió también del último medio hacia atrás.
  var already = sale.lines.fold(0, (a, l) => a + l.refundedMinor);
  var rest = total;
  final byRail = <String, int>{};
  for (final t in sale.tenders.reversed) {
    if (t.status != 'CAPTURED') continue;
    final usedBefore = already < t.amountMinor ? already : t.amountMinor;
    already -= usedBefore;
    final free = t.amountMinor - usedBefore;
    final take = rest < free ? rest : free;
    if (take <= 0) continue;
    byRail[t.rail] = (byRail[t.rail] ?? 0) + take;
    rest -= take;
  }
  return RefundPreview(total, byRail);
}

/// Configuración de caja del comercio (`pos.PosSettings`, F17.11, R14). Los porcentajes van en
/// puntos básicos enteros (1 % = 100) y los montos en centavos.
class PosSettingsItem {
  const PosSettingsItem({
    required this.preference,
    required this.autoThresholdMinor,
    required this.cashEnabled,
    required this.walletEnabled,
    required this.receiptFooter,
    required this.maxDiscountBps,
    required this.version,
  });

  /// Lo que rige si el servidor no responde: lo mismo que los valores por defecto de pos (R14).
  static const defaults = PosSettingsItem(
      preference: 'INTERNAL_ONLY',
      autoThresholdMinor: 0,
      cashEnabled: true,
      walletEnabled: true,
      receiptFooter: '',
      maxDiscountBps: 0,
      version: 0);

  factory PosSettingsItem.fromJson(Map<String, dynamic> j) => PosSettingsItem(
        preference: (j['checkout_preference'] as String? ??
                'CHECKOUT_PREFERENCE_INTERNAL_ONLY')
            .replaceFirst('CHECKOUT_PREFERENCE_', ''),
        autoThresholdMinor: _int(j['auto_threshold_minor']),
        cashEnabled: j['cash_enabled'] as bool? ?? false,
        walletEnabled: (j['enabled_rails'] as List<dynamic>? ?? const [])
            .contains('PAYMENT_RAIL_WALLET'),
        receiptFooter: j['receipt_footer'] as String? ?? '',
        maxDiscountBps: _int(j['max_discount_bps']),
        version: _int(j['version']),
      );

  final String
      preference; // ALWAYS_FISCAL | INTERNAL_ONLY | ASK_ALWAYS | AUTO_THRESHOLD
  final int autoThresholdMinor;
  final bool cashEnabled;
  final bool walletEnabled;
  final String receiptFooter;
  final int maxDiscountBps;
  final int version;

  Map<String, Object?> toJson() => {
        'checkout_preference': 'CHECKOUT_PREFERENCE_$preference',
        if (preference == 'AUTO_THRESHOLD')
          'auto_threshold_minor': '$autoThresholdMinor',
        'cash_enabled': cashEnabled,
        'enabled_rails': [if (walletEnabled) 'PAYMENT_RAIL_WALLET'],
        'receipt_footer': receiptFooter,
        'max_discount_bps': maxDiscountBps,
        'version': version,
      };
}

Future<PosSettingsItem> loadPosSettings(ApiClient api) async =>
    PosSettingsItem.fromJson(await api.getPosSettings());

/// «12.5» → 1250 puntos básicos; null si no es un porcentaje de 0 a 100 con hasta 2 decimales.
int? parsePercentBps(String text) {
  final m = RegExp(r'^(\d{1,3})(?:[.,](\d{1,2}))?$').firstMatch(text.trim());
  if (m == null) return null;
  final whole = int.parse(m.group(1)!);
  final frac = (m.group(2) ?? '').padRight(2, '0');
  final bps = whole * 100 + int.parse(frac);
  return bps > 10000 ? null : bps;
}

/// 1250 → «12.5»; 1500 → «15».
String formatPercentBps(int bps) {
  final whole = bps ~/ 100, frac = bps % 100;
  if (frac == 0) return '$whole';
  return frac % 10 == 0
      ? '$whole.${frac ~/ 10}'
      : '$whole.${frac.toString().padLeft(2, '0')}';
}

int _int(Object? v) => switch (v) {
      final int i => i,
      final String s => int.tryParse(s) ?? 0,
      final num n => n.toInt(),
      _ => 0,
    };
