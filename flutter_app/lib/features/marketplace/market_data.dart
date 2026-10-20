import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../catalog/catalog_errors.dart';
import '../wallet/pay_data.dart' show payErrorMessage;
import '../wallet/wallet_data.dart' show minorUnits;

int _money(Map<String, dynamic> j, String key) =>
    minorUnits((j[key] as Map<String, dynamic>?)?['amount_minor']);

List<Map<String, dynamic>> _list(Map<String, dynamic> j, String key) =>
    (j[key] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

DateTime? _time(Object? v) =>
    v is String && v.isNotEmpty ? DateTime.tryParse(v)?.toLocal() : null;

/// Un producto publicado (`catalog.MarketplaceProduct`). El precio es el total con ITBMS incluido
/// (N-CON-01); `inStock` es un booleano, nunca la cantidad (catalog R7).
class MarketProduct {
  const MarketProduct({
    required this.id,
    required this.tenantId,
    required this.storeName,
    required this.storeVerified,
    required this.name,
    required this.description,
    required this.priceMinor,
    required this.unitType,
    required this.imageUrls,
    required this.inStock,
    required this.pickup,
    required this.delivery,
  });

  factory MarketProduct.fromJson(Map<String, dynamic> j) {
    final p = j['product'] as Map<String, dynamic>? ?? const {};
    final sf = j['storefront'] as Map<String, dynamic>? ?? const {};
    final l = j['listing'] as Map<String, dynamic>? ?? const {};
    final listed = _money(l, 'marketplace_price');
    return MarketProduct(
      id: p['product_id'] as String? ?? '',
      tenantId: p['tenant_id'] as String? ?? sf['tenant_id'] as String? ?? '',
      storeName: sf['display_name'] as String? ?? '',
      storeVerified: sf['verified'] as bool? ?? false,
      name: p['name'] as String? ?? '',
      description: p['description'] as String? ?? '',
      priceMinor: listed > 0 ? listed : _money(p, 'price'),
      unitType: p['unit_type'] as String? ?? 'UNIT',
      imageUrls:
          (p['image_object_keys'] as List<dynamic>? ?? const []).cast<String>(),
      inStock: j['in_stock'] as bool? ?? false,
      pickup: l['pickup_available'] as bool? ?? false,
      delivery: l['delivery_available'] as bool? ?? false,
    );
  }

  final String id;
  final String tenantId;
  final String storeName;
  final bool storeVerified;
  final String name;
  final String description;
  final int priceMinor;
  final String unitType;
  final List<String> imageUrls;
  final bool inStock;
  final bool pickup;
  final bool delivery;

  bool get isBulk => unitType != 'UNIT';
}

/// Una página del marketplace con su token.
Future<(List<MarketProduct>, String)> searchMarket(ApiClient api,
    {String query = '', String merchant = '', String pageToken = ''}) async {
  final body = await api.marketplaceSearch(
      query: query, merchant: merchant, pageToken: pageToken);
  final next =
      (body['page'] as Map<String, dynamic>?)?['next_page_token'] as String? ??
          '';
  return (
    [for (final r in _list(body, 'results')) MarketProduct.fromJson(r)],
    next
  );
}

/// La vitrina de un comercio (`catalog.Storefront`).
class StorefrontInfo {
  const StorefrontInfo(
      {required this.tenantId,
      required this.displayName,
      required this.description,
      required this.verified,
      required this.published});

  factory StorefrontInfo.fromJson(Map<String, dynamic> j) => StorefrontInfo(
        tenantId: j['tenant_id'] as String? ?? '',
        displayName: j['display_name'] as String? ?? '',
        description: j['description'] as String? ?? '',
        verified: j['verified'] as bool? ?? false,
        published: j['published'] as bool? ?? false,
      );

  final String tenantId;
  final String displayName;
  final String description;
  final bool verified;
  final bool published;
}

/// Nombres de tienda por tenant, leídos una vez por pantalla. Un fallo deja el nombre genérico:
/// el nombre es decorativo, el pedido no depende de él.
Future<Map<String, String>> storeNames(
    ApiClient api, Iterable<String> tenantIds) async {
  final out = <String, String>{};
  for (final id in tenantIds.toSet()) {
    try {
      out[id] = StorefrontInfo.fromJson(await api.storefront(id)).displayName;
    } on ApiException catch (e) {
      api.logger.breadcrumb('ui', 'market.store_name', e.reason);
    }
  }
  return out;
}

/// Una línea del carrito (`orders.CartItem`): precio y nombre son la instantánea al agregar.
class CartLine {
  const CartLine(
      {required this.productId,
      required this.tenantId,
      required this.qtyMilli,
      required this.unitPriceMinor,
      required this.name});

  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        productId: j['product_id'] as String? ?? '',
        tenantId: j['merchant_tenant_id'] as String? ?? '',
        qtyMilli: minorUnits(j['quantity_milli']),
        unitPriceMinor: _money(j, 'unit_price_snapshot'),
        name: j['name_snapshot'] as String? ?? '',
      );

  final String productId;
  final String tenantId;
  final int qtyMilli;
  final int unitPriceMinor;
  final String name;

  /// round_half_up(precio × cantidad / 1000), como orders (domain-model §4).
  int get totalMinor => (unitPriceMinor * qtyMilli + 500) ~/ 1000;
}

List<CartLine> cartLines(Map<String, dynamic> cart) =>
    [for (final i in _list(cart, 'items')) CartLine.fromJson(i)];

/// La parte de un comercio en la cotización (`orders.MerchantQuote`).
class MerchantQuoteItem {
  const MerchantQuoteItem(
      {required this.tenantId,
      required this.name,
      required this.itemsMinor,
      required this.deliveryMinor,
      required this.taxMinor,
      required this.allInStock,
      required this.unavailable});

  factory MerchantQuoteItem.fromJson(Map<String, dynamic> j) =>
      MerchantQuoteItem(
        tenantId: j['merchant_tenant_id'] as String? ?? '',
        name: j['merchant_name'] as String? ?? '',
        itemsMinor: _money(j, 'items_total'),
        deliveryMinor: _money(j, 'delivery_fee'),
        taxMinor: _money(j, 'tax'),
        allInStock: j['all_in_stock'] as bool? ?? false,
        unavailable:
            (j['unavailable_product_ids'] as List<dynamic>? ?? const [])
                .cast<String>()
                .toSet(),
      );

  final String tenantId;
  final String name;
  final int itemsMinor;
  final int deliveryMinor;
  final int taxMinor;
  final bool allInStock;
  final Set<String> unavailable;
}

/// La cotización del checkout (`orders.CheckoutQuote`): el total lo fija el servidor.
class OrderQuote {
  const OrderQuote(
      {required this.id,
      required this.merchants,
      required this.grandTotalMinor,
      required this.customerFeesMinor});

  factory OrderQuote.fromJson(Map<String, dynamic> j) => OrderQuote(
        id: j['quote_id'] as String? ?? '',
        merchants: [
          for (final m in _list(j, 'merchants')) MerchantQuoteItem.fromJson(m)
        ],
        grandTotalMinor: _money(j, 'grand_total'),
        customerFeesMinor: _money(j, 'customer_fees'),
      );

  final String id;
  final List<MerchantQuoteItem> merchants;
  final int grandTotalMinor;
  final int customerFeesMinor;

  int get itemsMinor => merchants.fold<int>(0, (a, m) => a + m.itemsMinor);
  int get taxMinor => merchants.fold<int>(0, (a, m) => a + m.taxMinor);
  bool get allInStock => merchants.every((m) => m.allInStock);
  Set<String> get unavailable => {for (final m in merchants) ...m.unavailable};
}

/// Una línea de un sub-pedido.
class OrderLine {
  const OrderLine(
      {required this.productId,
      required this.name,
      required this.qtyMilli,
      required this.totalMinor});

  factory OrderLine.fromJson(Map<String, dynamic> j) => OrderLine(
        productId: j['product_id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        qtyMilli: minorUnits(j['quantity_milli']),
        totalMinor: _money(j, 'line_total'),
      );

  final String productId;
  final String name;
  final int qtyMilli;
  final int totalMinor;
}

/// Un sub-pedido (`orders.SubOrder`): la parte de un comercio. `status` sin prefijo.
class SubOrderItem {
  const SubOrderItem({
    required this.id,
    required this.orderId,
    required this.tenantId,
    required this.status,
    required this.lines,
    required this.totalMinor,
    required this.pickup,
    required this.rejectionReason,
    required this.deadline,
    required this.pickupCode,
  });

  factory SubOrderItem.fromJson(Map<String, dynamic> j) => SubOrderItem(
        id: j['sub_order_id'] as String? ?? '',
        orderId: j['order_id'] as String? ?? '',
        tenantId: j['merchant_tenant_id'] as String? ?? '',
        status: (j['status'] as String? ?? '')
            .replaceFirst('SUB_ORDER_STATUS_', ''),
        lines: [for (final l in _list(j, 'lines')) OrderLine.fromJson(l)],
        totalMinor: _money(j, 'total'),
        pickup: j['fulfillment'] != 'FULFILLMENT_METHOD_DELIVERY',
        rejectionReason: j['rejection_reason'] as String? ?? '',
        deadline: _time(j['acceptance_deadline']),
        pickupCode: j['pickup_code'] as String? ?? '',
      );

  final String id;
  final String orderId;
  final String tenantId;
  final String status;
  final List<OrderLine> lines;
  final int totalMinor;
  final bool pickup;
  final String rejectionReason;
  final DateTime? deadline;
  final String pickupCode;

  int get itemCount => lines.length;
  bool get lost => status == 'REJECTED' || status == 'CANCELLED';
}

/// Un pedido del comprador (`orders.Order`). `status` sin prefijo.
class OrderItem {
  const OrderItem(
      {required this.id,
      required this.status,
      required this.subs,
      required this.grandTotalMinor,
      required this.paymentIntentId,
      required this.createdAt});

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['order_id'] as String? ?? '',
        status:
            (j['status'] as String? ?? '').replaceFirst('ORDER_STATUS_', ''),
        subs: [
          for (final s in _list(j, 'sub_orders')) SubOrderItem.fromJson(s)
        ],
        grandTotalMinor: _money(j, 'grand_total'),
        paymentIntentId: j['payment_intent_id'] as String? ?? '',
        createdAt: _time(j['created_at']),
      );

  final String id;
  final String status;
  final List<SubOrderItem> subs;
  final int grandTotalMinor;
  final String paymentIntentId;
  final DateTime? createdAt;

  /// En curso: todavía puede cambiar (S-MKT-06 filtro).
  bool get inProgress => status == 'PENDING_PAYMENT' || status == 'PAID';

  /// C-05: el comprador cancela solo antes de que alguna tienda acepte (orders R7).
  bool get cancellable =>
      inProgress &&
      subs.every((s) =>
          s.status == 'PENDING_PAYMENT' || s.status == 'AWAITING_ACCEPTANCE');
}

Future<List<OrderItem>> loadMyOrders(ApiClient api) async {
  final body = await api.myOrders();
  return [for (final o in _list(body, 'orders')) OrderItem.fromJson(o)];
}

Future<List<SubOrderItem>> loadMerchantOrders(ApiClient api) async {
  final body = await api.merchantOrders();
  return [for (final s in _list(body, 'sub_orders')) SubOrderItem.fromJson(s)];
}

/// Número corto de pedido para mostrar y dictar: los primeros 8 caracteres del id.
String orderNumber(String id) =>
    (id.length > 8 ? id.substring(0, 8) : id).toUpperCase();

/// Cuenta regresiva `mm:ss` (S-ORD-01 e2); nunca negativa.
String countdown(Duration left) {
  final s = left.isNegative ? 0 : left.inSeconds;
  return '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
}

String orderStatusLabel(AppLocalizations l10n, String status) =>
    switch (status) {
      'PENDING_PAYMENT' => l10n.orderStatus_PENDING_PAYMENT,
      'PAID' => l10n.orderStatus_PAID,
      'PARTIALLY_FULFILLED' => l10n.orderStatus_PARTIALLY_FULFILLED,
      'COMPLETED' => l10n.orderStatus_COMPLETED,
      'CANCELLED' => l10n.orderStatus_CANCELLED,
      'REFUNDED' => l10n.orderStatus_REFUNDED,
      _ => status,
    };

String subStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING_PAYMENT' => l10n.subStatus_PENDING_PAYMENT,
      'AWAITING_ACCEPTANCE' => l10n.subStatus_AWAITING_ACCEPTANCE,
      'ACCEPTED' => l10n.subStatus_ACCEPTED,
      'READY' => l10n.subStatus_READY,
      'IN_DELIVERY' => l10n.subStatus_IN_DELIVERY,
      'COMPLETED' => l10n.subStatus_COMPLETED,
      'REJECTED' => l10n.subStatus_REJECTED,
      'CANCELLED' => l10n.subStatus_CANCELLED,
      _ => status,
    };

/// Mensaje traducido de un fallo de marketplace o pedidos (C-08). Los motivos del cobro van por
/// `payErrorMessage`; los de catálogo e inventario por `catalogErrorMessage`.
String marketErrorMessage(AppLocalizations l10n, Object error) {
  if (error is! ApiException) return l10n.errorNoConnection;
  return switch (error.reason) {
    'LISTING_UNAVAILABLE' => l10n.error_LISTING_UNAVAILABLE,
    'CART_LIMIT' => l10n.error_CART_LIMIT,
    'PRICE_CHANGED' => l10n.error_PRICE_CHANGED,
    'DELIVERY_UNAVAILABLE' => l10n.error_DELIVERY_UNAVAILABLE,
    'EMPTY_CART' => l10n.error_EMPTY_CART,
    'ACCEPT_DEADLINE_PASSED' => l10n.error_ACCEPT_DEADLINE_PASSED,
    'PICKUP_CODE_MISMATCH' => l10n.error_PICKUP_CODE_MISMATCH,
    'TENANT_NOT_ACTIVE' => l10n.error_TENANT_NOT_ACTIVE,
    'LISTING_INCOMPLETE' => l10n.error_LISTING_INCOMPLETE,
    'INSUFFICIENT_FUNDS' ||
    'STEP_UP_REQUIRED' ||
    'STEP_UP_INVALID' ||
    'AMOUNT_OUT_OF_RANGE' ||
    'RAIL_DISABLED' ||
    'FEE_POLICY_MISSING' =>
      payErrorMessage(l10n, error),
    _ => catalogErrorMessage(l10n, error),
  };
}
