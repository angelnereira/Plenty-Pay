import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/status_chip.dart';
import 'package:plentypay/features/marketplace/market_data.dart';
import 'package:plentypay/features/orders/order_manage_detail_screen.dart';
import 'package:plentypay/features/orders/orders_manage_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

String inMinutes(int m) =>
    DateTime.now().add(Duration(minutes: m)).toUtc().toIso8601String();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('S-ORD-01 e2: la cuenta regresiva pasa a warning bajo 5 min y a error bajo 2 min', () {
    expect(deadlineTone(const Duration(minutes: 9)), StatusTone.info);
    expect(deadlineTone(const Duration(minutes: 4, seconds: 59)), StatusTone.warning);
    expect(deadlineTone(const Duration(minutes: 1, seconds: 59)), StatusTone.error);
    expect(countdown(const Duration(minutes: 4, seconds: 7)), '04:07');
    expect(countdown(const Duration(seconds: -3)), '00:00');
  });

  testWidgets('S-ORD-01: pestañas con contador y cuenta regresiva en "Por aceptar"', (tester) async {
    await tester.pumpWidget(harness(OrdersManageScreen(
        api: fakeApi({
      'GET /v1/merchant/orders': (_) => json({
            'sub_orders': [
              subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: inMinutes(10)),
              subOrder(subB, storeA, 'READY'),
            ]
          }),
    }))));
    await settle(tester);
    expect(find.text('Por aceptar (1)'), findsOneWidget);
    expect(find.text('Listos (1)'), findsOneWidget);
    expect(find.text('Pedido ${orderNumber(orderId)}'), findsOneWidget);
    expect(find.textContaining(RegExp(r'^(09|10):\d\d$')), findsOneWidget);
  });

  testWidgets('S-ORD-01 vacío por pestaña: "No hay pedidos aquí."', (tester) async {
    await tester.pumpWidget(harness(OrdersManageScreen(
        api: fakeApi({'GET /v1/merchant/orders': (_) => json({'sub_orders': <Object>[]})}))));
    await settle(tester);
    expect(find.text('No hay pedidos aquí.'), findsOneWidget);
  });

  testWidgets('S-ORD-02: aceptar → marcar listo, cada uno con su ruta y clave', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(OrderManageDetailScreen(
        api: fakeApi({
          'POST /v1/merchant/sub-orders/$subA/accept': (_) => json(subOrder(subA, storeA, 'ACCEPTED')),
          'POST /v1/merchant/sub-orders/$subA/ready': (_) => json(subOrder(subA, storeA, 'READY')),
        }, calls: calls),
        sub: SubOrderItem.fromJson(subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: inMinutes(12))))));
    await settle(tester);
    await tester.tap(find.text('Aceptar pedido'));
    await settle(tester);
    expect(find.text('Aceptado'), findsOneWidget);
    await tester.tap(find.text('Marcar listo'));
    await settle(tester);
    expect(calls.map((r) => r.url.path), [
      '/v1/merchant/sub-orders/$subA/accept',
      '/v1/merchant/sub-orders/$subA/ready',
    ]);
    expect(calls.every((r) => (r.headers['Idempotency-Key'] ?? r.headers['idempotency-key'] ?? '').isNotEmpty), isTrue);
    expect(find.text('Código del cliente'), findsOneWidget);
  });

  testWidgets('R6 / S-ORD-02 e7: entregar exige los 6 dígitos; incorrecto dice "El código no coincide."',
      (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(OrderManageDetailScreen(
        api: fakeApi({
          'POST /v1/merchant/sub-orders/$subA/complete': (_) => gatewayError(400, 'PICKUP_CODE_MISMATCH'),
        }, calls: calls),
        sub: SubOrderItem.fromJson(subOrder(subA, storeA, 'READY')))));
    await settle(tester);
    FilledButton handOver() => tester.widget<FilledButton>(
        find.ancestor(of: find.text('Entregar al cliente'), matching: find.byType(FilledButton)));
    expect(handOver().onPressed, isNull);
    await tester.enterText(find.byKey(const Key('pickup-code-field')), '123456');
    await tester.pump();
    expect(handOver().onPressed, isNotNull);
    await tester.tap(find.text('Entregar al cliente'));
    await settle(tester);
    expect((jsonDecode(calls.single.body) as Map)['pickup_code'], '123456');
    expect(find.text('El código no coincide.'), findsOneWidget);
  });

  testWidgets('R5 / S-ORD-02 e6: rechazar exige motivo y confirma el monto a reembolsar (C-05)',
      (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(OrderManageDetailScreen(
        api: fakeApi({
          'POST /v1/merchant/sub-orders/$subA/reject': (_) =>
              json(subOrder(subA, storeA, 'REJECTED', reason: 'OUT_OF_STOCK')),
        }, calls: calls),
        sub: SubOrderItem.fromJson(subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: inMinutes(12))))));
    await settle(tester);
    await tester.tap(find.text('Rechazar'));
    await settle(tester);
    final confirm = find.text(r'Rechazar y reembolsar $37.00');
    expect(tester.widget<TextButton>(find.ancestor(of: confirm, matching: find.byType(TextButton))).onPressed, isNull);
    await tester.tap(find.text('Sin existencias'));
    await tester.pump();
    await tester.tap(confirm);
    await settle(tester);
    expect((jsonDecode(calls.single.body) as Map)['reason'], 'OUT_OF_STOCK');
    expect(find.text('Rechazado'), findsOneWidget);
  });
}
