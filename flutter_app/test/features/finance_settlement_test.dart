import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/widgets/pp_text_field.dart';
import 'package:plentypay/features/finance/payout_settings_screen.dart';
import 'package:plentypay/features/finance/settlements_screen.dart';

import '../support/fake_gateway.dart';

Map<String, Object> money(int v) => {'amount_minor': '$v', 'currency': 'USD'};

const batchId = '01a15fc9-1083-745b-aed2-163be0ceebd7';

Map<String, Object> batch(
        {String status = 'BATCH_STATUS_PAID',
        bool sandbox = true,
        String kind = 'WALLET',
        List<Object> items = const []}) =>
    {
      'batch_id': batchId,
      'status': status,
      'gross': money(1168),
      'refunds': money(200),
      'net_payout': money(968),
      'destination_kind': kind,
      'destination_last4': kind == 'BANK' ? '3456' : '',
      'sandbox': sandbox,
      'payout_external_ref': kind == 'BANK' ? 'ACH-123' : '',
      'failure_reason': '',
      'item_count': 2,
      'items': items,
      'created_at': '2026-10-21T18:46:14Z',
      'paid_at': '2026-10-21T18:46:15Z',
    };

Map<String, dynamic> body(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

Finder inputOf(String label) => find.descendant(
    of: find.widgetWithText(PPTextField, label),
    matching: find.byType(TextField));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final summary = {
    'GET /v1/settlement/summary': (_) => json({
          'pending': money(968),
          'in_processing': money(0),
        }),
  };

  testWidgets('S-FIN-05: por liquidar, lotes reales y chip de prueba (R2)',
      (tester) async {
    await tester.pumpWidget(harness(SettlementsScreen(
        api: fakeApi({
          ...summary,
          'GET /v1/settlement/batches': (_) => json({
                'batches': [batch()],
                'page': {'next_page_token': ''}
              }),
        }),
        canSettle: true)));
    await tester.pumpAndSettle();
    expect(find.text(r'$9.68'), findsNWidgets(2));
    expect(find.text('Liquidación manual'), findsOneWidget);
    expect(find.text('Lote 01A15FC9'), findsOneWidget);
    expect(find.text('Pagada'), findsOneWidget);
    expect(find.text('Prueba'), findsOneWidget);
    expect(find.textContaining('Billetera del negocio'), findsWidgets);
    expect(find.textContaining('8912'), findsNothing,
        reason: 'AGENTS.md §3.1: sin datos de demostración');
  });

  testWidgets(
      'S-FIN-05: «Liquidar ahora» crea el lote con su clave; NOTHING_TO_SETTLE se explica',
      (tester) async {
    final calls = <http.Request>[];
    var nothing = false;
    await tester.pumpWidget(harness(SettlementsScreen(
        api: fakeApi({
          ...summary,
          'GET /v1/settlement/batches': (_) => json({
                'batches': [],
                'page': {'next_page_token': ''}
              }),
          'POST /v1/settlement/batches': (_) =>
              nothing ? gatewayError(409, 'NOTHING_TO_SETTLE') : json(batch()),
        }, calls: calls),
        canSettle: true)));
    await tester.pumpAndSettle();
    expect(find.text('Todavía no tienes liquidaciones.'), findsOneWidget);
    await tester.tap(find.text('Liquidar ahora'));
    await tester.pumpAndSettle();
    expect(find.text(r'Se pagaron $9.68 a tu billetera.'), findsOneWidget);
    final post = calls.firstWhere((r) => r.method == 'POST');
    expect(post.headers['Idempotency-Key'], isNotEmpty);
    nothing = true;
    await tester.tap(find.text('Liquidar ahora'));
    await tester.pumpAndSettle();
    expect(find.text('No tienes cobros listos para liquidar.'), findsOneWidget);
    final keys = calls
        .where((r) => r.method == 'POST')
        .map((r) => r.headers['Idempotency-Key'])
        .toSet();
    expect(keys.length, 2, reason: 'cada intento nuevo lleva su propia clave');
  });

  testWidgets('S-FIN-05: sin settlement:schedule:manage no se ofrece liquidar',
      (tester) async {
    await tester.pumpWidget(harness(SettlementsScreen(
        api: fakeApi({
      ...summary,
      'GET /v1/settlement/batches': (_) => json({
            'batches': [],
            'page': {'next_page_token': ''}
          }),
    }))));
    await tester.pumpAndSettle();
    expect(find.text('Liquidar ahora'), findsNothing);
  });

  testWidgets('S-FIN-05 detalle: partidas, reembolsos y referencia bancaria',
      (tester) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(harness(SettlementBatchScreen(
        api: fakeApi({
          'GET /v1/settlement/batches/$batchId': (_) => json(batch(
                  status: 'BATCH_STATUS_PAID',
                  sandbox: false,
                  kind: 'BANK',
                  items: [
                    {
                      'kind': 'PAYMENT',
                      'reference': {'type': 'payment', 'id': 'p1'},
                      'amount': money(1168),
                      'occurred_at': '2026-10-20T13:12:03Z'
                    },
                    {
                      'kind': 'REFUND',
                      'reference': {'type': 'refund', 'id': 'r1'},
                      'amount': money(200),
                      'occurred_at': '2026-10-20T14:00:00Z'
                    },
                  ])),
        }),
        batchId: batchId)));
    await tester.pumpAndSettle();
    expect(find.text('Cuenta •••• 3456'), findsOneWidget);
    expect(find.text('ACH-123'), findsOneWidget);
    expect(find.text('2 partidas'), findsOneWidget);
    expect(find.text('Reembolso'), findsOneWidget);
    expect(find.textContaining('octubre'), findsWidgets,
        reason: 'N-STD-10: el mes va en texto');
  });

  Map<String, Object> schedule({bool bank = false}) => {
        'configured': true,
        'frequency': 'PAYOUT_FREQUENCY_MANUAL',
        'minimum_payout_minor': '100',
        'destination_kind': bank ? 'BANK' : 'WALLET',
        'destination_bank': bank ? 'Banco General' : '',
        'destination_account_type': bank ? 'CHECKING' : '',
        'destination_last4': bank ? '3456' : '',
        'destination_holder': bank ? 'Barbería Demo S.A.' : '',
        'hold_days': 1,
      };

  testWidgets(
      'S-FIN-06 (R5): una cuenta nueva pide sus datos y viaja con el destino',
      (tester) async {
    tester.view.physicalSize = const Size(420, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(PayoutSettingsScreen(
        api: fakeApi({
      'GET /v1/settlement/schedule': (_) => json(schedule()),
      'PUT /v1/settlement/schedule': (_) => json(schedule(bank: true)),
    }, calls: calls))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cuenta bancaria'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(calls.where((r) => r.method == 'PUT'), isEmpty,
        reason: 'sin los datos de la cuenta no se envía');
    await tester.enterText(inputOf('Banco'), 'Banco General');
    await tester.enterText(inputOf('Número de cuenta'), '040100123456');
    await tester.enterText(inputOf('Titular'), 'Barbería Demo S.A.');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final put = body(calls.firstWhere((r) => r.method == 'PUT'));
    expect((put['destination'] as Map)['kind'], 'BANK');
    expect((put['destination'] as Map)['account_number'], '040100123456');
    expect((put['schedule'] as Map)['frequency'], 'PAYOUT_FREQUENCY_MANUAL');
    expect(find.text('Calendario guardado.'), findsOneWidget);
  });

  testWidgets(
      'S-FIN-06: con cuenta guardada solo se ven los últimos 4 y sin cambiarla no se manda destino',
      (tester) async {
    tester.view.physicalSize = const Size(420, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(PayoutSettingsScreen(
        api: fakeApi({
      'GET /v1/settlement/schedule': (_) => json(schedule(bank: true)),
      'PUT /v1/settlement/schedule': (_) => json(schedule(bank: true)),
    }, calls: calls))));
    await tester.pumpAndSettle();
    expect(find.textContaining('•••• 3456'), findsOneWidget);
    expect(find.textContaining('040100'), findsNothing);
    await tester.tap(find.text('Diaria'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final put = body(calls.firstWhere((r) => r.method == 'PUT'));
    expect(put.containsKey('destination'), isFalse);
    expect((put['schedule'] as Map)['frequency'], 'PAYOUT_FREQUENCY_DAILY');
  });

  testWidgets('S-FIN-06: INVALID_DESTINATION se explica', (tester) async {
    tester.view.physicalSize = const Size(420, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(harness(PayoutSettingsScreen(
        api: fakeApi({
      'GET /v1/settlement/schedule': (_) => json(schedule()),
      'PUT /v1/settlement/schedule': (_) =>
          gatewayError(400, 'INVALID_DESTINATION'),
    }))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cuenta bancaria'));
    await tester.pumpAndSettle();
    await tester.enterText(inputOf('Banco'), 'Banco General');
    await tester.enterText(inputOf('Número de cuenta'), '040100123456');
    await tester.enterText(inputOf('Titular'), 'Otra Persona');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('El titular no coincide con tu negocio.'), findsOneWidget);
  });

  for (final (name, screen) in [
    (
      'S-FIN-05',
      (ApiClient api) => SettlementsScreen(api: api, canSettle: true)
    ),
    ('S-FIN-06', (ApiClient api) => PayoutSettingsScreen(api: api)),
  ]) {
    testWidgets(
        'gravital §15.3: $name al 200 % en 360 dp, oscuro, sin desbordes',
        (tester) async {
      final api = fakeApi({
        ...summary,
        'GET /v1/settlement/batches': (_) => json({
              'batches': [batch()],
              'page': {'next_page_token': ''}
            }),
        'GET /v1/settlement/schedule': (_) => json(schedule(bank: true)),
      });
      await pumpAt(tester, screen(api));
      expect(tester.takeException(), isNull);
    });
  }
}
