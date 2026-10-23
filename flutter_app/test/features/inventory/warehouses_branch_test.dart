import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/inventory/warehouses_screen.dart';

import '../../support/fake_gateway.dart';

const matriz = '018f0000-0000-7000-8000-0000000000a1';
const chitre = '018f0000-0000-7000-8000-0000000000b2';

Map<String, Object> branch(String id, String name, String code, {bool active = true}) =>
    {'branch_id': id, 'name': name, 'code': code, 'active': active};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F16.9 S-INV-09: cada bodega muestra su sucursal y crear exige la sucursal', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json({
            'warehouses': [
              {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true, 'branch_id': matriz},
              {'warehouse_id': 'w-2', 'name': 'Bodega Chitré', 'active': true, 'branch_id': chitre},
            ]
          }),
      'GET /v1/business/branches': (_) => json({
            'branches': [
              branch(matriz, 'Casa Matriz', '0000'),
              branch(chitre, 'Sucursal Chitré', '0001'),
              branch('018f0000-0000-7000-8000-0000000000c3', 'Cerrada', '0002', active: false),
            ]
          }),
      'POST /v1/inventory/warehouses': (_) => json({'warehouse_id': 'w-3', 'name': 'Trastienda', 'branch_id': chitre}),
    }, calls: calls);
    await tester.pumpWidget(harness(WarehousesScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Casa Matriz'), findsOneWidget);
    expect(find.text('Sucursal Chitré'), findsOneWidget);

    await tester.tap(find.text('Nueva bodega'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Trastienda');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('Elige la sucursal de la bodega.'), findsOneWidget);
    expect(calls.where((r) => r.method == 'POST'), isEmpty);

    await tester.tap(find.text('Sucursal'));
    await tester.pumpAndSettle();
    expect(find.text('Cerrada'), findsNothing, reason: 'solo sucursales activas');
    await tester.tap(find.text('Sucursal Chitré').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final body = jsonDecode(calls.singleWhere((r) => r.method == 'POST').body) as Map<String, dynamic>;
    expect((body['warehouse'] as Map)['branch_id'], chitre);
  });

  testWidgets('F16.9 S-INV-09: con una sola sucursal se propone sola', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json({'warehouses': <Object>[]}),
      'GET /v1/business/branches': (_) => json({'branches': [branch(chitre, 'Sucursal Chitré', '0001')]}),
      'POST /v1/inventory/warehouses': (_) => json({'warehouse_id': 'w-3', 'name': 'Trastienda'}),
    }, calls: calls);
    await tester.pumpWidget(harness(WarehousesScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nueva bodega'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Trastienda');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final body = jsonDecode(calls.singleWhere((r) => r.method == 'POST').body) as Map<String, dynamic>;
    expect((body['warehouse'] as Map)['branch_id'], chitre);
  });

  testWidgets('F16.9 S-INV-09: fuera de alcance muestra el mensaje traducido', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json({'warehouses': <Object>[]}),
      'GET /v1/business/branches': (_) => json({'branches': [branch(chitre, 'Sucursal Chitré', '0001')]}),
      'POST /v1/inventory/warehouses': (_) => gatewayError(403, 'BRANCH_OUT_OF_SCOPE'),
    });
    await tester.pumpWidget(harness(WarehousesScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nueva bodega'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Trastienda');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('Esa sucursal está fuera de tu alcance.'), findsOneWidget);
  });
}
