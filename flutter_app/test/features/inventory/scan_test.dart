import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/hid_scanner_listener.dart';
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/inventory/purchase_receive_screen.dart';
import 'package:plentypay/features/inventory/purchasing_data.dart';
import 'package:plentypay/features/inventory/stock_adjust_screen.dart';
import 'package:plentypay/features/inventory/stock_transfer_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

const poId = '01a15fc9-1083-745b-aed2-163be0ceeb01';

final warehouses = {
  'warehouses': [
    {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
    {'warehouse_id': 'w-2', 'name': 'Sucursal David', 'active': true},
  ]
};

final cafe = product(cafeId, 'Café 250 g', 1850, barcode: '036000291452');
final pan = product(panId, 'Croissant', 425);

Map<String, Object> order() => {
      'purchase_order_id': poId,
      'supplier_id': 's-1',
      'supplier_name': 'Distribuidora del Istmo',
      'warehouse_id': 'w-1',
      'status': 'PURCHASE_ORDER_STATUS_SENT',
      'lines': [
        {'product_id': cafeId, 'ordered_milli': '10000', 'received_milli': '0', 'unit_cost': {'amount_minor': '925', 'currency': 'USD'}},
      ],
      'total': {'amount_minor': '9250', 'currency': 'USD'},
      'created_at': '2026-10-21T15:00:00Z',
      'version': 1,
    };

/// Un lector HID: teclea el código seguido y termina con Enter.
Future<void> hidScan(WidgetTester tester, String code) async {
  for (final c in code.split('')) {
    final key = LogicalKeyboardKey(0x30 + int.parse(c));
    await tester.sendKeyDownEvent(key, character: c);
    await tester.sendKeyUpEvent(key);
  }
  await tester.sendKeyEvent(LogicalKeyboardKey.enter);
  await tester.pumpAndSettle();
}

Future<void> unfocus(WidgetTester tester) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F16.11 S-INV-06: la primera lectura reemplaza lo propuesto por 1, la siguiente suma 1; doble lectura cuenta una',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'POST /v1/inventory/purchase-orders/$poId/receive': (_) => json(order()),
    }, calls: calls);
    await tester.pumpWidget(harness(PurchaseReceiveScreen(
        api: api,
        order: PurchaseOrderItem.fromJson(order()),
        products: {cafeId: ProductItem.fromJson(cafe), panId: ProductItem.fromJson(pan)})));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, '10'), findsOneWidget, reason: 'propone lo pendiente');

    await hidScan(tester, '0036000291452'); // EAN-13 del UPC-A del producto
    expect(find.widgetWithText(TextField, '1'), findsOneWidget);
    await hidScan(tester, '0036000291452');
    expect(find.widgetWithText(TextField, '1'), findsOneWidget, reason: 'la misma lectura en < 800 ms cuenta una vez');

    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 850)));
    await hidScan(tester, '036000291452');
    expect(find.widgetWithText(TextField, '2'), findsOneWidget);
    expect(calls, isEmpty, reason: 'un escaneo nunca registra por sí solo');
  });

  testWidgets('F16.11 S-INV-06: código desconocido y producto fuera de la orden solo avisan', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({}, calls: calls);
    await tester.pumpWidget(harness(PurchaseReceiveScreen(
        api: api,
        order: PurchaseOrderItem.fromJson(order()),
        products: {cafeId: ProductItem.fromJson(cafe), panId: ProductItem.fromJson(pan)})));
    await tester.pumpAndSettle();
    await hidScan(tester, '4006381333931');
    expect(find.text('No encontramos un producto con ese código.'), findsOneWidget);
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 850)));
    // El croissant existe pero no está en la orden: se lee por SKU con un lector alfanumérico.
    await tester.sendKeyDownEvent(LogicalKeyboardKey.keyS, character: 'S');
    await tester.sendKeyUpEvent(LogicalKeyboardKey.keyS);
    for (final c in 'KU-Croissant'.split('')) {
      final key = LogicalKeyboardKey(c.toLowerCase().codeUnitAt(0));
      await tester.sendKeyDownEvent(key, character: c);
      await tester.sendKeyUpEvent(key);
    }
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(find.text('Ese producto no está en la orden.'), findsOneWidget);
    expect(find.widgetWithText(TextField, '10'), findsOneWidget, reason: 'la línea no cambió');
    expect(calls, isEmpty);
  });

  testWidgets('F16.11: con un campo de texto enfocado el lector escribe en el campo, no escanea', (tester) async {
    final scans = <String>[];
    final field = TextEditingController();
    await tester.pumpWidget(harness(Scaffold(
        body: HidScannerListener(onScan: scans.add, child: TextField(controller: field)))));
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    await hidScan(tester, '4006381333931');
    expect(scans, isEmpty);
    await unfocus(tester);
    await hidScan(tester, '4006381333931');
    expect(scans, ['4006381333931']);
  });

  testWidgets('F16.11 S-INV-04: el lector elige el producto y muestra su disponible en el origen', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json({'products': [cafe, pan], 'page': {'next_page_token': ''}}),
      'GET /v1/inventory/stock/$cafeId': (_) =>
          json({'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '7000', 'available_milli': '7000'}),
    });
    await tester.pumpWidget(harness(StockTransferScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Origen'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bodega principal').last);
    await tester.pumpAndSettle();
    await unfocus(tester);
    await hidScan(tester, '0036000291452');
    expect(find.text('Café 250 g'), findsOneWidget, reason: 'el selector muestra el producto escaneado');
    expect(find.text('Disponible: 7'), findsOneWidget);
  });

  testWidgets('F16.11 S-INV-03: un UPC-A encuentra el producto guardado como EAN-13 y desconocido avisa', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json({
            'products': [product(cafeId, 'Café 250 g', 1850, barcode: '0036000291452'), pan],
            'page': {'next_page_token': ''}
          }),
      'GET /v1/inventory/stock/$cafeId': (_) =>
          json({'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '4000', 'available_milli': '4000'}),
    });
    await tester.pumpWidget(harness(StockAdjustScreen(api: api)));
    await tester.pumpAndSettle();
    await unfocus(tester);
    await hidScan(tester, '96385074');
    expect(find.text('No encontramos un producto con ese código.'), findsOneWidget);
    await hidScan(tester, '036000291452');
    expect(find.text('Café 250 g'), findsOneWidget);
    expect(find.text('Sistema 4'), findsOneWidget);
  });
}
