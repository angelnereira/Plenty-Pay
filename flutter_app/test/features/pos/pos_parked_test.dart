import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/pos/pos_parked_screen.dart';
import 'package:plentypay/features/pos/pos_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Map<String, Object> parked({String label = 'Señora del carrito azul'}) => {
      ...sale('PARKED'),
      'park_label': label,
      'parked_at': '2026-10-21T16:05:00Z',
      'version': 3,
    };

List<http.Request> hits(List<http.Request> calls, String method, String path) =>
    calls.where((r) => r.method == method && r.url.path == path).toList();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final base = <String, FakeRoute>{
    'GET /v1/pos/sessions/current': (_) => json(session()),
    'GET /v1/terminals': (_) => json(terminalsBody),
    'GET /v1/catalog/products': (_) => json(productsBody),
    'GET /v1/me/permissions': (_) => json({
          'role': 'cashier',
          'permissions': ['pos:sell', 'pos:void'],
        }),
  };

  testWidgets(
      'R13 S-POS-02 e10: «Estacionar» guarda la venta con su nota y deja el ticket vacío',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      ...base,
      'POST /v1/pos/sales': (_) => json(sale('OPEN')),
      'PUT /v1/pos/sales/$saleId': (_) => json(sale('OPEN')),
      'POST /v1/pos/sales/$saleId/park': (_) => json(parked()),
    }, calls: calls);
    await tester.pumpWidget(harness(PosScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Café 250 g'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Estacionar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Estacionar'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byType(TextField).last, 'Señora del carrito azul');
    await tester.tap(find.descendant(
        of: find.byType(AlertDialog),
        matching: find.widgetWithText(TextButton, 'Estacionar')));
    await tester.pumpAndSettle();

    final park = hits(calls, 'POST', '/v1/pos/sales/$saleId/park').single;
    expect(jsonDecode(park.body), {'label': 'Señora del carrito azul'});
    expect(hits(calls, 'PUT', '/v1/pos/sales/$saleId'), hasLength(1),
        reason: 'se guardan las líneas antes de estacionar');
    expect(find.text('Venta estacionada.'), findsOneWidget);
    expect(find.text('Agrega productos a la venta.'), findsOneWidget);
  });

  testWidgets(
      'R13 S-POS-06: lista real con nota y fecha; retomar arma el ticket y cobra la MISMA venta',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      ...base,
      'GET /v1/pos/sales': (_) => json({
            'sales': [parked()]
          }),
      'POST /v1/pos/sales/$saleId/resume': (_) => json(sale('OPEN')),
      'PUT /v1/pos/sales/$saleId': (_) => json(sale('OPEN')),
    }, calls: calls);
    await tester.pumpWidget(harness(PosScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.pumpAndSettle();

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Estacionadas'));
    await tester.pumpAndSettle();

    final list = hits(calls, 'GET', '/v1/pos/sales').single.url.queryParameters;
    expect(list['session_id'], sessionId);
    expect(list['status'], 'SALE_STATUS_PARKED');
    expect(find.text('Señora del carrito azul'), findsOneWidget);
    expect(find.textContaining('de octubre de 2026'), findsOneWidget,
        reason: 'N-STD-10: mes en texto');
    expect(find.text('1 producto'), findsOneWidget);
    expect(find.text('Anular'), findsOneWidget);

    await tester.tap(find.text('Retomar'));
    await tester.pumpAndSettle();
    expect(find.text(r'Cobrar $18.50'), findsOneWidget);

    await tester.tap(find.text(r'Cobrar $18.50'));
    await tester.pumpAndSettle();
    expect(hits(calls, 'POST', '/v1/pos/sales'), isEmpty,
        reason: 'retomada: no se crea otra venta');
    expect(hits(calls, 'PUT', '/v1/pos/sales/$saleId'), hasLength(1));
  });

  testWidgets(
      'R13 S-POS-06: con un ticket en curso no se retoma; vacía muestra su estado; sin pos:void no se anula',
      (tester) async {
    final api = fakeApi({
      ...base,
      'GET /v1/me/permissions': (_) => json({
            'role': 'cashier',
            'permissions': ['pos:sell']
          }),
      'GET /v1/pos/sales': (_) => json({
            'sales': [parked(label: '')]
          }),
    });
    await tester.pumpWidget(harness(
        PosParkedScreen(api: api, sessionId: sessionId, canResume: false)));
    await tester.pumpAndSettle();
    expect(
        find.text(
            'Cobra, estaciona o vacía la venta en curso para retomar otra.'),
        findsOneWidget);
    expect(find.text('Sin nota'), findsOneWidget);
    final resume = tester
        .widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Retomar'));
    expect(resume.onPressed, isNull);
    expect(find.text('Anular'), findsNothing);

    final empty = fakeApi({
      ...base,
      'GET /v1/pos/sales': (_) => json({'sales': <Object>[]})
    });
    await tester.pumpWidget(harness(PosParkedScreen(
        key: const ValueKey('vacía'),
        api: empty,
        sessionId: sessionId,
        canResume: true)));
    await tester.pumpAndSettle();
    expect(find.text('No tienes ventas estacionadas.'), findsOneWidget);
  });

  testWidgets(
      'R13 S-POS-06: anular pide motivo; un error del servidor se explica',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      ...base,
      'GET /v1/pos/sales': (_) => json({
            'sales': [parked()]
          }),
      'POST /v1/pos/sales/$saleId/void': (_) =>
          gatewayError(409, 'INVALID_STATE_TRANSITION'),
    }, calls: calls);
    await tester.pumpWidget(harness(
        PosParkedScreen(api: api, sessionId: sessionId, canResume: true)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Anular'));
    await tester.pumpAndSettle();
    final confirm = find.descendant(
        of: find.byType(AlertDialog),
        matching: find.widgetWithText(TextButton, 'Anular'));
    expect(tester.widget<TextButton>(confirm).onPressed, isNull,
        reason: 'motivo obligatorio');
    await tester.enterText(find.byType(TextField), 'el cliente no volvió');
    await tester.pumpAndSettle();
    await tester.tap(confirm);
    await tester.pumpAndSettle();
    final v = hits(calls, 'POST', '/v1/pos/sales/$saleId/void').single;
    expect(jsonDecode(v.body)['reason'], 'el cliente no volvió');
    expect(v.headers['idempotency-key'], isNotEmpty);
    expect(find.byType(SnackBar), findsOneWidget);
  });
}
