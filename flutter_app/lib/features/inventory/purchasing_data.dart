import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_errors.dart' show catalogErrorMessage;

// Compras tal como las entrega el gateway (inventory, protojson snake_case, int64 como texto).
// Cantidades en milésimas de unidad; costos en centavos (ADR 0013).

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

int _money(Object? m) => m is Map<String, dynamic> ? _int(m['amount_minor']) : 0;

/// Proveedor (inventory.Supplier).
class SupplierItem {
  const SupplierItem({
    required this.id,
    required this.name,
    required this.taxId,
    required this.checkDigit,
    required this.email,
    required this.phone,
    required this.leadTimeDays,
    required this.active,
  });

  factory SupplierItem.fromJson(Map<String, dynamic> j) => SupplierItem(
        id: j['supplier_id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        taxId: j['tax_id'] as String? ?? '',
        checkDigit: j['check_digit'] as String? ?? '',
        email: j['email'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        leadTimeDays: _int(j['lead_time_days']),
        active: j['active'] as bool? ?? false,
      );

  final String id;
  final String name;
  final String taxId;
  final String checkDigit;
  final String email;
  final String phone;
  final int leadTimeDays;
  final bool active;

  Map<String, Object?> toJson() => {
        if (id.isNotEmpty) 'supplier_id': id,
        'name': name,
        'tax_id': taxId,
        'check_digit': checkDigit,
        'email': email,
        'phone': phone,
        'lead_time_days': leadTimeDays,
        'active': active,
      };
}

/// Línea de una orden de compra.
class PurchaseLineItem {
  const PurchaseLineItem(
      {required this.productId,
      required this.orderedMilli,
      this.receivedMilli = 0,
      required this.unitCostMinor});

  factory PurchaseLineItem.fromJson(Map<String, dynamic> j) =>
      PurchaseLineItem(
        productId: j['product_id'] as String? ?? '',
        orderedMilli: _int(j['ordered_milli']),
        receivedMilli: _int(j['received_milli']),
        unitCostMinor: _money(j['unit_cost']),
      );

  final String productId;
  final int orderedMilli;
  final int receivedMilli;
  final int unitCostMinor;

  int get pendingMilli => orderedMilli - receivedMilli;

  Map<String, Object?> toJson() => {
        'product_id': productId,
        'ordered_milli': '$orderedMilli',
        'unit_cost': {'amount_minor': '$unitCostMinor', 'currency': 'USD'},
      };
}

/// Orden de compra (inventory.PurchaseOrder).
class PurchaseOrderItem {
  const PurchaseOrderItem({
    required this.id,
    required this.supplierId,
    required this.supplierName,
    required this.warehouseId,
    required this.status,
    required this.lines,
    required this.totalMinor,
    this.expectedAt,
    this.createdAt,
  });

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> j) =>
      PurchaseOrderItem(
        id: j['purchase_order_id'] as String? ?? '',
        supplierId: j['supplier_id'] as String? ?? '',
        supplierName: j['supplier_name'] as String? ?? '',
        warehouseId: j['warehouse_id'] as String? ?? '',
        status: (j['status'] as String? ?? '')
            .replaceFirst('PURCHASE_ORDER_STATUS_', ''),
        lines: [
          for (final l in (j['lines'] as List<dynamic>? ?? const []))
            PurchaseLineItem.fromJson(l as Map<String, dynamic>)
        ],
        totalMinor: _money(j['total']),
        expectedAt: DateTime.tryParse('${j['expected_at'] ?? ''}')?.toLocal(),
        createdAt: DateTime.tryParse('${j['created_at'] ?? ''}')?.toLocal(),
      );

  final String id;
  final String supplierId;
  final String supplierName;
  final String warehouseId;
  final String status; // DRAFT | SENT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED
  final List<PurchaseLineItem> lines;
  final int totalMinor;
  final DateTime? expectedAt;
  final DateTime? createdAt;

  String get shortId => id.length > 8 ? id.substring(0, 8).toUpperCase() : id;
  bool get receivable => status == 'SENT' || status == 'PARTIALLY_RECEIVED';
  bool get cancellable => status == 'DRAFT' || status == 'SENT';
}

/// Sugerencia de reorden (inventory.ReorderSuggestion, R6).
class ReorderItem {
  const ReorderItem({
    required this.productId,
    required this.warehouseId,
    required this.suggestedMilli,
    required this.availableMilli,
    required this.inTransitMilli,
    required this.dailyMilli,
    required this.daysOfCover,
    required this.abc,
    required this.supplierId,
    required this.supplierName,
    required this.leadTimeDays,
  });

  factory ReorderItem.fromJson(Map<String, dynamic> j) => ReorderItem(
        productId: j['product_id'] as String? ?? '',
        warehouseId: j['warehouse_id'] as String? ?? '',
        suggestedMilli: _int(j['suggested_quantity_milli']),
        availableMilli: _int(j['available_milli']),
        inTransitMilli: _int(j['in_transit_milli']),
        dailyMilli: _int(j['avg_daily_demand_milli']),
        daysOfCover: _int(j['days_of_cover']),
        abc: j['abc_class'] as String? ?? '',
        supplierId: j['supplier_id'] as String? ?? '',
        supplierName: j['supplier_name'] as String? ?? '',
        leadTimeDays: _int(j['lead_time_days']),
      );

  final String productId;
  final String warehouseId;
  final int suggestedMilli;
  final int availableMilli;
  final int inTransitMilli;
  final int dailyMilli;
  final int daysOfCover;
  final String abc;
  final String supplierId;
  final String supplierName;
  final int leadTimeDays;
}

/// Fecha con el mes en texto (N-STD-10): «23 de octubre de 2026».
String purchaseDate(DateTime t, String locale) =>
    DateFormat.yMMMMd(locale).format(t);

String poStatusLabel(AppLocalizations l10n, String s) => switch (s) {
      'DRAFT' => l10n.poStatusDraft,
      'SENT' => l10n.poStatusSent,
      'PARTIALLY_RECEIVED' => l10n.poStatusPartial,
      'RECEIVED' => l10n.poStatusReceived,
      _ => l10n.poStatusCancelled,
    };

StatusTone poStatusTone(String s) => switch (s) {
      'RECEIVED' => StatusTone.success,
      'PARTIALLY_RECEIVED' => StatusTone.warning,
      'SENT' => StatusTone.info,
      'CANCELLED' => StatusTone.error,
      _ => StatusTone.neutral,
    };

/// Mensaje para la persona a partir del reason (C-02).
String purchasingErrorMessage(AppLocalizations l10n, Object error) {
  if (error is ApiException) {
    switch (error.reason) {
      case 'INVALID_SUPPLIER':
        return l10n.error_INVALID_SUPPLIER;
      case 'RECEIPT_EXCEEDS_ORDERED':
        return l10n.error_RECEIPT_EXCEEDS_ORDERED;
      case 'UNKNOWN_ORDER_LINE':
        return l10n.error_UNKNOWN_ORDER_LINE;
      case 'INVALID_STATE_TRANSITION':
        return l10n.error_PO_STATE;
    }
  }
  return catalogErrorMessage(l10n, error);
}

Future<List<SupplierItem>> loadSuppliers(ApiClient api) async {
  final j = await api.listSuppliers();
  return [
    for (final s in (j['suppliers'] as List<dynamic>? ?? const []))
      SupplierItem.fromJson(s as Map<String, dynamic>)
  ];
}

Future<List<PurchaseOrderItem>> loadPurchaseOrders(ApiClient api,
    {String status = ''}) async {
  final j = await api.listPurchaseOrders(status: status);
  return [
    for (final o in (j['orders'] as List<dynamic>? ?? const []))
      PurchaseOrderItem.fromJson(o as Map<String, dynamic>)
  ];
}

Future<List<ReorderItem>> loadReorderSuggestions(ApiClient api) async {
  final j = await api.reorderSuggestions();
  return [
    for (final s in (j['suggestions'] as List<dynamic>? ?? const []))
      ReorderItem.fromJson(s as Map<String, dynamic>)
  ];
}
