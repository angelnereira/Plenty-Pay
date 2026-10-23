import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/inventory/inventory_screen.dart';
import 'package:plentypay/features/inventory/stock_adjust_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

final warehouses = {
  'warehouses': [
    {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
  ]
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-INV-01: existencias reales con nombre del catálogo; negativo y agotados', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/stock': (_) => json({
            'levels': [
              {'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '12000', 'reserved_milli': '0', 'available_milli': '12000', 'reorder_point_milli': '0'},
              {'product_id': panId, 'warehouse_id': 'w-1', 'on_hand_milli': '-2000', 'reserved_milli': '0', 'available_milli': '-2000', 'reorder_point_milli': '0'},
            ],
            'page': {'next_page_token': ''},
          }),
      'GET /v1/inventory/lots': (_) => json({'lots': <Object>[]}),
    });
    await tester.pumpWidget(harness(InventoryScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Café 250 g'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('−2'), findsOneWidget);
    expect(find.text('1 agotados'), findsOneWidget);
  });

  testWidgets('S-INV-03: el conteo da la diferencia; con motivo Daño y faltante es una baja', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/stock/$cafeId': (_) =>
          json({'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '10000', 'available_milli': '10000'}),
      'POST /v1/inventory/adjustments': (_) => json({'movement_id': 'm-1'}),
    }, calls: calls);
    await tester.pumpWidget(harness(StockAdjustScreen(api: api)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Producto'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Café 250 g').last);
    await tester.pumpAndSettle();
    expect(find.text('Sistema 10'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Contado'), '8');
    await tester.pumpAndSettle();
    expect(find.text('Diferencia −2'), findsOneWidget);

    // Sin motivo no aplica.
    await tester.ensureVisible(find.text('Aplicar ajuste'));
    await tester.tap(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    expect(find.text('Indica el motivo del ajuste.'), findsOneWidget);

    await tester.tap(find.text('Motivo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Daño').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Aplicar ajuste'));
    await tester.tap(find.text('Aplicar ajuste'));
    await tester.pumpAndSettle();
    expect(find.text('Un ajuste no se edita ni se borra: se corrige con otro ajuste.'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Aplicar ajuste'));
    await tester.pumpAndSettle();

    final b = jsonDecode(calls.firstWhere((r) => r.url.path == '/v1/inventory/adjustments').body) as Map;
    expect(b['delta_milli'], '-2000');
    expect(b['type'], 'MOVEMENT_TYPE_WRITE_OFF');
    expect(b['reason'], 'Daño');
    expect(b['warehouse_id'], 'w-1');
  });

  test('S-INV-03: un sobrante con conteo físico es un ajuste, no una baja', () {
    expect(adjustMovementType(AdjustReason.count, 1000), 'MOVEMENT_TYPE_ADJUSTMENT');
    expect(adjustMovementType(AdjustReason.damage, 1000), 'MOVEMENT_TYPE_ADJUSTMENT');
    expect(adjustMovementType(AdjustReason.loss, -1000), 'MOVEMENT_TYPE_WRITE_OFF');
  });
}
