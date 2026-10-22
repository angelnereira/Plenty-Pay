import '../../core/api/api_client.dart';

int _milli(Object? v) => switch (v) {
      final int i => i,
      final String s => int.tryParse(s) ?? 0,
      final num n => n.toInt(),
      _ => 0,
    };

/// Existencia de un producto en una bodega (`inventory.StockLevel`). Cantidades en milésimas.
class StockItem {
  const StockItem(
      {required this.productId,
      required this.warehouseId,
      required this.onHandMilli,
      required this.reservedMilli,
      required this.availableMilli,
      required this.reorderPointMilli});

  factory StockItem.fromJson(Map<String, dynamic> j) => StockItem(
        productId: j['product_id'] as String? ?? '',
        warehouseId: j['warehouse_id'] as String? ?? '',
        onHandMilli: _milli(j['on_hand_milli']),
        reservedMilli: _milli(j['reserved_milli']),
        availableMilli: _milli(j['available_milli']),
        reorderPointMilli: _milli(j['reorder_point_milli']),
      );

  final String productId;
  final String warehouseId;
  final int onHandMilli;
  final int reservedMilli;
  final int availableMilli;
  final int reorderPointMilli;

  bool get isOut => availableMilli <= 0;
  bool get isLow =>
      !isOut && reorderPointMilli > 0 && availableMilli <= reorderPointMilli;
}

/// Un movimiento inmutable (`inventory.StockMovement`).
class MovementItem {
  const MovementItem(
      {required this.id,
      required this.productId,
      required this.warehouseId,
      required this.type,
      required this.deltaMilli,
      required this.reason,
      required this.referenceType,
      required this.occurredAt,
      this.lotCode = ''});

  factory MovementItem.fromJson(Map<String, dynamic> j) => MovementItem(
        id: j['movement_id'] as String? ?? '',
        productId: j['product_id'] as String? ?? '',
        warehouseId: j['warehouse_id'] as String? ?? '',
        type: (j['type'] as String? ?? '').replaceFirst('MOVEMENT_TYPE_', ''),
        deltaMilli: _milli(j['delta_milli']),
        reason: j['reason'] as String? ?? '',
        referenceType:
            (j['reference'] as Map<String, dynamic>?)?['type'] as String? ?? '',
        occurredAt:
            DateTime.tryParse(j['occurred_at'] as String? ?? '')?.toLocal() ??
                DateTime.fromMillisecondsSinceEpoch(0),
        lotCode: j['lot_code'] as String? ?? '',
      );

  /// F16.4: lote del movimiento (vacío si el producto no maneja lotes).

  final String id;
  final String productId;
  final String warehouseId;
  final String type;
  final int deltaMilli;
  final String reason;
  final String lotCode;
  final String referenceType;
  final DateTime occurredAt;
}

/// Una bodega (`inventory.Warehouse`).
class WarehouseItem {
  const WarehouseItem(
      {required this.id,
      required this.name,
      required this.active,
      required this.isDefault});

  factory WarehouseItem.fromJson(Map<String, dynamic> j) => WarehouseItem(
        id: j['warehouse_id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        active: j['active'] as bool? ?? false,
        isDefault: j['is_default'] as bool? ?? false,
      );

  final String id;
  final String name;
  final bool active;
  final bool isDefault;
}

Future<List<WarehouseItem>> loadWarehouses(ApiClient api) async {
  final body = await api.listWarehouses();
  return [
    for (final w in (body['warehouses'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      WarehouseItem.fromJson(w),
  ];
}

/// Todas las existencias (hasta [maxPages] páginas de 200) de una bodega o de todas.
Future<List<StockItem>> loadStock(ApiClient api,
    {String warehouseId = '', int maxPages = 10}) async {
  final out = <StockItem>[];
  var token = '';
  for (var i = 0; i < maxPages; i++) {
    final body =
        await api.listStock(warehouseId: warehouseId, pageToken: token);
    out.addAll([
      for (final l in (body['levels'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        StockItem.fromJson(l),
    ]);
    token = (body['page'] as Map<String, dynamic>?)?['next_page_token']
            as String? ??
        '';
    if (token.isEmpty) break;
  }
  return out;
}

Future<List<MovementItem>> loadMovements(ApiClient api,
    {String productId = '', String warehouseId = ''}) async {
  final body =
      await api.listMovements(productId: productId, warehouseId: warehouseId);
  return [
    for (final m in (body['movements'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      MovementItem.fromJson(m),
  ];
}

/// Suma por producto cuando se ven todas las bodegas (S-INV-01 e2: "Todas" suma).
List<StockItem> sumByProduct(List<StockItem> levels) {
  final by = <String, StockItem>{};
  for (final l in levels) {
    final p = by[l.productId];
    by[l.productId] = p == null
        ? l
        : StockItem(
            productId: l.productId,
            warehouseId: '',
            onHandMilli: p.onHandMilli + l.onHandMilli,
            reservedMilli: p.reservedMilli + l.reservedMilli,
            availableMilli: p.availableMilli + l.availableMilli,
            reorderPointMilli: p.reorderPointMilli + l.reorderPointMilli,
          );
  }
  return by.values.toList();
}

/// Un lote de un producto en una bodega (inventory.Lot, F16.4).
class LotItem {
  const LotItem(
      {required this.id,
      required this.warehouseId,
      required this.code,
      required this.onHandMilli,
      required this.expired,
      this.expiresOn});

  factory LotItem.fromJson(Map<String, dynamic> j) {
    final exp = DateTime.tryParse(j['expires_at'] as String? ?? '');
    return LotItem(
      id: j['lot_id'] as String? ?? '',
      warehouseId: j['warehouse_id'] as String? ?? '',
      code: j['code'] as String? ?? '',
      onHandMilli: _milli(j['on_hand_milli']),
      expired: j['expired'] as bool? ?? false,
      // El contrato manda las 00:00 de Panamá (05:00 UTC): la fecha es la del día UTC.
      expiresOn: exp == null
          ? null
          : DateTime(exp.toUtc().year, exp.toUtc().month, exp.toUtc().day),
    );
  }

  final String id;
  final String warehouseId;
  final String code;
  final int onHandMilli;
  final bool expired;
  final DateTime? expiresOn;

  /// Vence dentro de [days] días (y aún no venció): se muestra en `warning`.
  bool expiresWithin(int days, DateTime today) =>
      !expired &&
      expiresOn != null &&
      !expiresOn!.isAfter(DateTime(today.year, today.month, today.day)
          .add(Duration(days: days)));
}

Future<List<LotItem>> loadLots(ApiClient api, String productId,
    {String warehouseId = '', bool includeEmpty = false}) async {
  final body = await api.listLots(productId,
      warehouseId: warehouseId, includeEmpty: includeEmpty);
  return [
    for (final l in (body['lots'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      LotItem.fromJson(l)
  ];
}
