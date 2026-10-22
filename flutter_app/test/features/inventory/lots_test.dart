import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/pp_text_field.dart';
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/inventory/purchase_receive_screen.dart';
import 'package:plentypay/features/inventory/purchasing_data.dart';
import 'package:plentypay/features/inventory/stock_adjust_screen.dart';
import 'package:plentypay/features/inventory/stock_detail_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

final drug = {...product(cafeId, 'Amoxicilina 500 mg', 1850), 'tracks_lots': true};

final warehouses = {
  'warehouses': [
    {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
  ]
};

Map<String, Object> lot(String code, int milli, String? exp, {bool expired = false}) => {
      'lot_id': 'lot-$code',
      'product_id': cafeId,
      'warehouse_id': 'w-1',
      'code': code,
      if (exp != null) 'expires_at': '${exp}T05:00:00Z',
      'on_hand_milli': '$milli',
      'expired': expired,
    };

Finder inputOf(String label) =>
    find.descendant(of: find.widgetWithText(PPTextField, label), matching: find.byType(TextField));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('R5 S-INV-02: lotes con vencimiento en texto; el vencido se marca con texto, no solo color',
      (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/inventory/stock': (_) => json({'levels': <Object>[]}),
      'GET /v1/inventory/movements': (_) => json({
            'movements': [
              {'movement_id': 'm1', 'product_id': cafeId, 'warehouse_id': 'w-1', 'type': 'MOVEMENT_TYPE_SALE',
               'delta_milli': '-2000', 'lot_code': 'L-OCT', 'occurred_at': '2026-10-21T15:00:00Z'},
            ]
          }),
      'GET /v1/inventory/lots': (_) => json({
            'lots': [lot('L-OCT', 1000, '2026-10-01', expired: true), lot('L-MAR', 5000, '2027-03-31')]
          }),
    });
    await tester.pumpWidget(harness(StockDetailScreen(api: api, product: ProductItem.fromJson(drug))));
    await tester.pumpAndSettle();
    expect(find.text('Lotes'), findsOneWidget);
    expect(find.text('Lote L-OCT'), findsOneWidget);
    expect(find.text('Vencido'), findsOneWidget);
    expect(find.textContaining('Vence el 31 de marzo de 2027'), findsOneWidget);
    expect(find.textContaining('Lote L-OCT'), findsNWidgets(2), reason: 'el movimiento muestra su lote');
  });

  testWidgets('R5 S-INV-03: una entrada de un producto con lotes exige el lote antes de enviarse',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json({'products': [drug]}),
      'GET /v1/inventory/stock/$cafeId': (_) => json({'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '0'}),
      'GET /v1/inventory/lots': (_) => json({'lots': <Object>[]}),
      'POST /v1/inventory/adjustments': (_) => json({'movement_id': 'm-1'}),
    }, calls: calls);
    await tester.pumpWidget(harness(StockAdjustScreen(api: api, product: ProductItem.fromJson(drug))));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Contado'), '12');
    await tester.pumpAndSettle();
    expect(find.text('Lote del proveedor'), findsOneWidget);
    await tester.tap(find.text('Motivo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Conteo físico').last);
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    expect(find.text('Este producto controla lotes: indica el lote.'), findsOneWidget);
    expect(calls.where((r) => r.method == 'POST'), isEmpty);

    await tester.enterText(find.widgetWithText(TextField, 'Lote del proveedor'), 'AMX-2611');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Aplicar ajuste'));
    await tester.pumpAndSettle();
    final b = jsonDecode(calls.singleWhere((r) => r.method == 'POST').body) as Map<String, dynamic>;
    expect(b['lot_code'], 'AMX-2611');
    expect(b['delta_milli'], '12000');
  });

  testWidgets('R5 S-INV-03: una salida deja elegir el lote o FEFO automático', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json({'products': [drug]}),
      'GET /v1/inventory/stock/$cafeId': (_) => json({'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '6000'}),
      'GET /v1/inventory/lots': (_) => json({'lots': [lot('L-OCT', 1000, '2026-10-01', expired: true), lot('L-MAR', 5000, '2027-03-31')]}),
      'POST /v1/inventory/adjustments': (_) => json({'movement_id': 'm-1'}),
    }, calls: calls);
    await tester.pumpWidget(harness(StockAdjustScreen(api: api, product: ProductItem.fromJson(drug))));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Contado'), '5');
    await tester.pumpAndSettle();
    expect(find.text('Automático (primero lo que vence antes)'), findsOneWidget);
    await tester.tap(find.text('Automático (primero lo que vence antes)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L-OCT · 1').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Motivo'));
    await tester.tap(find.text('Motivo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vencimiento').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Aplicar ajuste'));
    await tester.pumpAndSettle();
    final b = jsonDecode(calls.singleWhere((r) => r.method == 'POST').body) as Map<String, dynamic>;
    expect(b['lot_code'], 'L-OCT');
    expect(b['type'], 'MOVEMENT_TYPE_WRITE_OFF');
    expect(b.containsKey('lot_expires_at'), isFalse);
  });

  testWidgets('F16.8 S-INV-06 e3: la recepción de un producto con lotes exige lote por línea', (tester) async {
    final calls = <http.Request>[];
    final order = PurchaseOrderItem.fromJson({
      'purchase_order_id': '01a15fc9-1083-745b-aed2-163be0ceeb01',
      'supplier_name': 'Droguería Istmeña',
      'warehouse_id': 'w-1',
      'status': 'PURCHASE_ORDER_STATUS_SENT',
      'lines': [
        {'product_id': cafeId, 'ordered_milli': '10000', 'received_milli': '0',
         'unit_cost': {'amount_minor': '150', 'currency': 'USD'}},
      ],
      'total': {'amount_minor': '1500', 'currency': 'USD'},
    });
    final api = fakeApi({
      'POST /v1/inventory/purchase-orders/${order.id}/receive': (_) =>
          json({'purchase_order_id': order.id, 'status': 'PURCHASE_ORDER_STATUS_RECEIVED', 'lines': <Object>[]}),
    }, calls: calls);
    await tester.pumpWidget(harness(PurchaseReceiveScreen(
        api: api, order: order, products: {cafeId: ProductItem.fromJson(drug)})));
    await tester.pumpAndSettle();
    expect(find.text('Lote del proveedor'), findsOneWidget);
    await tester.ensureVisible(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    expect(find.text('Este producto controla lotes: indica el lote.'), findsOneWidget);
    expect(calls, isEmpty);

    await tester.enterText(inputOf('Lote del proveedor'), 'AMX-2611');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    final line = ((jsonDecode(calls.single.body) as Map)['lines'] as List).single as Map;
    expect(line['lot_code'], 'AMX-2611');
  });
}
