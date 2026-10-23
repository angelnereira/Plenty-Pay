import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/inventory/inventory_screen.dart';
import 'package:plentypay/features/inventory/stock_detail_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

final warehouses = {
  'warehouses': [
    {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
  ]
};

final owner = {
  'role': 'owner',
  'enabled_modules': ['inventory'],
  'permissions': ['inventory:read', 'inventory:adjust'],
};

final drug = {...product(cafeId, 'Amoxicilina 500 mg', 1850), 'tracks_lots': true};

Map<String, Object> level(String product, int onHand, int blocked, {int reserved = 0}) => {
      'product_id': product,
      'warehouse_id': 'w-1',
      'on_hand_milli': '$onHand',
      'reserved_milli': '$reserved',
      'blocked_milli': '$blocked',
      'available_milli': '${onHand - reserved - blocked}',
    };

Map<String, dynamic> postBody(List<http.Request> calls) =>
    jsonDecode(calls.singleWhere((r) => r.method == 'POST' || r.method == 'PUT').body) as Map<String, dynamic>;

Future<void> pickReason(WidgetTester tester, String reason) async {
  await tester.tap(find.text('Motivo'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(reason).last);
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F16.10 S-INV-01: el bloqueado se ve en la lista y «lotes por vencer» filtra', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/stock': (_) => json({
            'levels': [level(cafeId, 10000, 3000), level(panId, 5000, 0)],
            'page': {'next_page_token': ''},
          }),
      'GET /v1/inventory/lots': (_) => json({
            'lots': [
              {'lot_id': 'l1', 'product_id': cafeId, 'warehouse_id': 'w-1', 'code': 'A', 'on_hand_milli': '4000',
               'expires_at': '2026-11-01T05:00:00Z', 'expires_soon': true},
            ]
          }),
      'GET /v1/me/permissions': (_) => json(owner),
    });
    await tester.pumpWidget(harness(InventoryScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.textContaining('Bloqueado: 3'), findsOneWidget);
    expect(find.text('7'), findsOneWidget, reason: 'el disponible ya descuenta lo bloqueado');
    expect(find.text('Croissant'), findsOneWidget);
    await tester.tap(find.text('1 lote por vencer'));
    await tester.pumpAndSettle();
    expect(find.text('Café 250 g'), findsOneWidget);
    expect(find.text('Croissant'), findsNothing);
  });

  testWidgets('F16.10 S-INV-02 b1–b4: bloquear desde la bodega manda BLOCK con motivo y no pasa lo disponible',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/inventory/stock': (_) => json({'levels': [level(cafeId, 10000, 0, reserved: 2000)]}),
      'GET /v1/inventory/movements': (_) => json({
            'movements': [
              {'movement_id': 'm1', 'product_id': cafeId, 'warehouse_id': 'w-1', 'type': 'MOVEMENT_TYPE_BLOCK',
               'delta_milli': '1000', 'reason': 'Daño', 'occurred_at': '2026-10-22T15:00:00Z'},
            ]
          }),
      'GET /v1/me/permissions': (_) => json(owner),
      'POST /v1/inventory/adjustments': (_) => json({'movement_id': 'm-2'}),
    }, calls: calls);
    await tester.pumpWidget(harness(StockDetailScreen(api: api, product: ProductItem.fromJson(product(cafeId, 'Café 250 g', 1850)))));
    await tester.pumpAndSettle();
    expect(find.text('Bloqueo'), findsOneWidget, reason: 'el tipo nuevo tiene nombre');
    expect(find.text('Desbloquear'), findsNothing);

    await tester.tap(find.text('Bodega principal'));
    await tester.pumpAndSettle();
    expect(find.text('Desbloquear'), findsNothing, reason: 'sin nada bloqueado solo se bloquea');
    await tester.tap(find.text('Bloquear'));
    await tester.pumpAndSettle();
    expect(find.text('Hasta 8'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '9');
    await tester.tap(find.widgetWithText(TextButton, 'Bloquear'));
    await tester.pumpAndSettle();
    expect(find.text('Escribe una cantidad mayor que 0.'), findsOneWidget);
    expect(find.text('Indica el motivo del ajuste.'), findsOneWidget);
    expect(calls.where((r) => r.method == 'POST'), isEmpty);

    await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '3');
    await pickReason(tester, 'En revisión');
    await tester.tap(find.widgetWithText(TextButton, 'Bloquear'));
    await tester.pumpAndSettle();
    final b = postBody(calls);
    expect(b['type'], 'MOVEMENT_TYPE_BLOCK');
    expect(b['delta_milli'], '3000');
    expect(b['reason'], 'En revisión');
    expect(b['warehouse_id'], 'w-1');
    expect(b.containsKey('from_blocked'), isFalse);
    expect(find.text('Existencia actualizada.'), findsOneWidget);
  });

  testWidgets('F16.10 S-INV-02: lote con bloqueado y «Vence pronto» del servidor; la baja de lo bloqueado confirma',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/inventory/stock': (_) => json({'levels': [level(cafeId, 6000, 2000)]}),
      'GET /v1/inventory/movements': (_) => json({'movements': <Object>[]}),
      'GET /v1/inventory/lots': (_) => json({
            'lots': [
              {'lot_id': 'l1', 'product_id': cafeId, 'warehouse_id': 'w-1', 'code': 'AMX-1', 'on_hand_milli': '6000',
               'blocked_milli': '2000', 'expires_at': '2027-01-15T05:00:00Z', 'expires_soon': true},
            ]
          }),
      'GET /v1/me/permissions': (_) => json(owner),
      'POST /v1/inventory/adjustments': (_) => json({'movement_id': 'm-2'}),
    }, calls: calls);
    await tester.pumpWidget(harness(StockDetailScreen(api: api, product: ProductItem.fromJson(drug))));
    await tester.pumpAndSettle();
    expect(find.text('Vence pronto'), findsOneWidget, reason: 'lo decide el servidor con los días del comercio');
    expect(find.textContaining('Bloqueado: 2'), findsNWidgets(2), reason: 'en la bodega y en el lote');

    await tester.tap(find.text('Bodega principal'));
    await tester.pumpAndSettle();
    expect(find.text('Bloquear'), findsNothing, reason: 'con lotes se bloquea por lote');

    await tester.tap(find.text('Lote AMX-1'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dar de baja lo bloqueado'));
    await tester.pumpAndSettle();
    expect(find.text('Hasta 2'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '2');
    await pickReason(tester, 'Retiro del fabricante');
    await tester.tap(find.widgetWithText(TextButton, 'Dar de baja'));
    await tester.pumpAndSettle();
    expect(find.text('Una baja no se edita ni se borra.'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Dar de baja').last);
    await tester.pumpAndSettle();
    final b = postBody(calls);
    expect(b['type'], 'MOVEMENT_TYPE_WRITE_OFF');
    expect(b['delta_milli'], '-2000');
    expect(b['from_blocked'], true);
    expect(b['lot_code'], 'AMX-1');
  });

  testWidgets('F16.10 S-INV-02: EXCEEDS_BLOCKED se muestra traducido y permite reintentar con otra clave',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/inventory/stock': (_) => json({'levels': [level(cafeId, 6000, 2000)]}),
      'GET /v1/inventory/movements': (_) => json({'movements': <Object>[]}),
      'GET /v1/me/permissions': (_) => json(owner),
      'POST /v1/inventory/adjustments': (_) => gatewayError(409, 'EXCEEDS_BLOCKED'),
    }, calls: calls);
    await tester.pumpWidget(harness(StockDetailScreen(api: api, product: ProductItem.fromJson(product(cafeId, 'Café 250 g', 1850)))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bodega principal'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Desbloquear'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Cantidad'), '2');
    await pickReason(tester, 'Daño');
    await tester.tap(find.widgetWithText(TextButton, 'Desbloquear'));
    await tester.pumpAndSettle();
    expect(find.text('No hay tanta existencia bloqueada.'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Desbloquear'));
    await tester.pumpAndSettle();
    final keys = calls.where((r) => r.method == 'POST').map((r) => r.headers['Idempotency-Key']).toList();
    expect(keys, hasLength(2));
    expect(keys[0], isNot(keys[1]), reason: 'un rechazo del servidor no reutiliza la clave');
    expect(postBody([calls.where((r) => r.method == 'POST').first])['type'], 'MOVEMENT_TYPE_UNBLOCK');
  });

  testWidgets('F16.10 S-INV-01 e6: el aviso de vencimiento acepta de 1 a 365 días y se guarda', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/stock': (_) => json({'levels': <Object>[]}),
      'GET /v1/inventory/lots': (_) => json({'lots': <Object>[]}),
      'GET /v1/inventory/settings': (_) => json({'expiry_alert_days': 30}),
      'PUT /v1/inventory/settings': (_) => json({'expiry_alert_days': 60}),
      'GET /v1/me/permissions': (_) => json(owner),
    }, calls: calls);
    await tester.pumpWidget(harness(InventoryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Aviso de vencimiento'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, '30'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Días'), '0');
    await tester.tap(find.widgetWithText(TextButton, 'Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('Indica de 1 a 365 días.'), findsOneWidget);
    expect(calls.where((r) => r.method == 'PUT'), isEmpty);
    await tester.enterText(find.widgetWithText(TextField, 'Días'), '60');
    await tester.tap(find.widgetWithText(TextButton, 'Guardar'));
    await tester.pumpAndSettle();
    expect(postBody(calls)['settings'], {'expiry_alert_days': 60});
    expect(find.text('Aviso de vencimiento guardado.'), findsOneWidget);
  });

  testWidgets('F16.10: sin inventory:adjust no hay menú de bloqueo ni aviso', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehouses),
      'GET /v1/inventory/stock': (_) => json({'levels': [level(cafeId, 6000, 2000)]}),
      'GET /v1/inventory/movements': (_) => json({'movements': <Object>[]}),
      'GET /v1/me/permissions': (_) => json({...owner, 'permissions': ['inventory:read']}),
    });
    await tester.pumpWidget(harness(StockDetailScreen(api: api, product: ProductItem.fromJson(product(cafeId, 'Café 250 g', 1850)))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bodega principal'));
    await tester.pumpAndSettle();
    expect(find.text('Bloquear'), findsNothing);
  });
}
