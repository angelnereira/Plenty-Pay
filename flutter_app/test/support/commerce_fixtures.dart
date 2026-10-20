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
