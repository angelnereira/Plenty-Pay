import 'package:http/http.dart' as http;

import 'fake_gateway.dart';

/// Datos de prueba de comercio (solo pruebas: nunca en pantallas de producción).
const cafeId = '01900000-0000-7000-8000-0000000000c1';
const panId = '01900000-0000-7000-8000-0000000000c2';
const saleId = '01900000-0000-7000-8000-0000000000s1';
const sessionId = '01900000-0000-7000-8000-0000000000e1';
const terminalCode = 'AbCdEfGhIjKlMnOpQrStUv';

Map<String, Object> product(String id, String name, int price,
        {int rate = 700, String barcode = '', bool tracks = true, String unit = 'UNIT'}) =>
    {
      'product_id': id,
      'sku': 'SKU-$name',
      'barcode': barcode,
      'name': name,
      'unit_type': unit,
      'price': {'amount_minor': '$price', 'currency': 'USD'},
      'tax_rate_bps': rate,
      'tax_exempt': rate == 0,
      'tracks_inventory': tracks,
      'status': 'PRODUCT_STATUS_ACTIVE',
      'version': 1,
    };

final productsBody = {
  'products': [
    product(cafeId, 'Café 250 g', 1850, barcode: '4006381333931'),
    product(panId, 'Croissant', 425, rate: 0),
  ],
  'page': {'next_page_token': ''},
};

Map<String, Object> session({int expected = 5000}) => {
      'session_id': sessionId,
      'terminal_label': terminalCode,
      'status': 'OPEN',
      'opening_float': {'amount_minor': '5000', 'currency': 'USD'},
      'expected_cash': {'amount_minor': '$expected', 'currency': 'USD'},
    };

Map<String, Object> sale(String status,
        {List<Map<String, Object>> tenders = const [], String receipt = '', int total = 1850}) =>
    {
      'sale_id': saleId,
      'session_id': sessionId,
      'status': 'SALE_STATUS_$status',
      'lines': [
        {
          'line_id': 'l1',
          'product_id': cafeId,
          'description': 'Café 250 g',
          'quantity_milli': '1000',
          'unit_price': {'amount_minor': '1850', 'currency': 'USD'},
          'tax_rate_bps': 700,
          'line_total': {'amount_minor': '1850', 'currency': 'USD'},
        }
      ],
      'tenders': tenders,
      'subtotal': {'amount_minor': '1729', 'currency': 'USD'},
      'tax': {'amount_minor': '121', 'currency': 'USD'},
      'total': {'amount_minor': '$total', 'currency': 'USD'},
      'change_due': {'amount_minor': '150', 'currency': 'USD'},
      'receipt_number': receipt,
      'created_at': '2026-10-20T15:30:00Z',
      'version': 2,
    };

final terminalsBody = {
  'terminals': [
    {'terminal_id': 't-1', 'public_code': terminalCode, 'label': 'Caja principal', 'active': true},
  ],
};

http.Response notFound(http.Request _) => gatewayError(404, 'NOT_FOUND');

// ── Marketplace y pedidos ───────────────────────────────────────────────────────────────────
const storeA = '01900000-0000-7000-8000-0000000000a1';
const storeB = '01900000-0000-7000-8000-0000000000b1';
const orderId = '01900000-0000-7000-8000-0000000000d1';
const subA = '01900000-0000-7000-8000-0000000000f1';
const subB = '01900000-0000-7000-8000-0000000000f2';
const intentId = '01900000-0000-7000-8000-0000000000i1';

Map<String, Object> listing(String id, String name, int price, String tenant, String store,
        {bool inStock = true}) =>
    {
      'product': {...product(id, name, price), 'tenant_id': tenant},
      'storefront': {'tenant_id': tenant, 'display_name': store, 'verified': true, 'published': true},
      'in_stock': inStock,
      'listing': {
        'product_id': id,
        'listed': true,
        'marketplace_price': {'amount_minor': '$price', 'currency': 'USD'},
        'pickup_available': true,
      },
    };

final searchBody = {
  'results': [
    listing(cafeId, 'Café 250 g', 1850, storeA, 'Café La Esquina'),
    listing(panId, 'Croissant', 425, storeB, 'Panadería Sol', inStock: false),
  ],
  'page': {'next_page_token': ''},
};

Map<String, Object> cartItem(String id, String tenant, String name, int price, int qty) => {
      'product_id': id,
      'merchant_tenant_id': tenant,
      'quantity_milli': '$qty',
      'unit_price_snapshot': {'amount_minor': '$price', 'currency': 'USD'},
      'name_snapshot': name,
    };

final cartBody = {
  'items': [
    cartItem(cafeId, storeA, 'Café 250 g', 1850, 2000),
    cartItem(panId, storeB, 'Croissant', 425, 1000),
  ],
};

Map<String, Object> money(int minor) => {'amount_minor': '$minor', 'currency': 'USD'};

Map<String, Object> quoteBody({int total = 4125, List<String> unavailable = const []}) => {
      'quote_id': 'q-1',
      'merchants': [
        {
          'merchant_tenant_id': storeA,
          'merchant_name': 'Café La Esquina',
          'items_total': money(3700),
          'tax': money(242),
          'all_in_stock': true,
        },
        {
          'merchant_tenant_id': storeB,
          'merchant_name': 'Panadería Sol',
          'items_total': money(425),
          'tax': money(0),
          'all_in_stock': unavailable.isEmpty,
          'unavailable_product_ids': unavailable,
        },
      ],
      'grand_total': money(total),
      'customer_fees': money(0),
    };

Map<String, Object> subOrder(String id, String tenant, String status,
        {String code = '', String reason = '', String? deadline, int total = 3700}) =>
    {
      'sub_order_id': id,
      'order_id': orderId,
      'merchant_tenant_id': tenant,
      'status': 'SUB_ORDER_STATUS_$status',
      'lines': [
        {
          'product_id': cafeId,
          'name': 'Café 250 g',
          'quantity_milli': '2000',
          'line_total': money(total),
        }
      ],
      'total': money(total),
      'fulfillment': 'FULFILLMENT_METHOD_PICKUP',
      if (reason.isNotEmpty) 'rejection_reason': reason,
      if (deadline != null) 'acceptance_deadline': deadline,
      if (code.isNotEmpty) 'pickup_code': code,
    };

Map<String, Object> orderBody(String status, List<Map<String, Object>> subs, {int total = 4125}) => {
      'order_id': orderId,
      'status': 'ORDER_STATUS_$status',
      'sub_orders': subs,
      'grand_total': money(total),
      'payment_intent_id': intentId,
      'created_at': '2026-10-20T15:30:00Z',
    };

Map<String, Object> storefrontBody(String tenant, String name) =>
    {'tenant_id': tenant, 'display_name': name, 'verified': true, 'published': true};
