import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/finance/finance_screen.dart';
import 'package:plentypay/features/finance/payments_list_screen.dart';
import 'package:plentypay/features/finance/terminals_screen.dart';
import 'package:plentypay/features/modules/module_registry.dart';

import '../support/fake_gateway.dart';

Map<String, Object> payment(
        String id, String status, int amount, int net, String at) =>
    {
      'payment_id': id,
      'status': 'PAYMENT_STATUS_$status',
      'amount': {'amount_minor': '$amount', 'currency': 'USD'},
      'captured': {
        'amount_minor': status == 'CAPTURED' ? '$amount' : '0',
        'currency': 'USD'
      },
      'refunded': {'amount_minor': '0', 'currency': 'USD'},
      'fees': {
        'gross': {'amount_minor': '$amount', 'currency': 'USD'},
        'merchant_net': {'amount_minor': '$net', 'currency': 'USD'},
        'lines': [
          {
            'kind': 'PLATFORM',
            'amount': {'amount_minor': '${amount - net}', 'currency': 'USD'}
          },
        ],
      },
      'created_at': at,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final now = DateTime.now().toUtc().toIso8601String();

  testWidgets(
      'S-FIN-02: cobros reales; UNKNOWN es "Confirmando", nunca "Rechazado"',
      (tester) async {
    final api = fakeApi({
      'GET /v1/payments': (_) => json({
            'payments': [
              payment('01900000-aaaa-7000-8000-000000000001', 'CAPTURED', 2500,
                  2433, now),
              payment('01900000-bbbb-7000-8000-000000000002', 'UNKNOWN', 1000,
                  973, now),
            ],
            'page': {'next_page_token': ''},
          }),
    });
    await tester.pumpWidget(harness(PaymentsListScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.text(r'$25.00'), findsOneWidget);
    expect(find.text('Completado'), findsOneWidget);
    expect(find.text('Confirmando'), findsOneWidget);
    expect(find.text('Rechazado'), findsNothing);
    expect(find.textContaining(r'Recibes $24.33'), findsOneWidget);
  });

  testWidgets('S-FIN-01 e2: totales del día con los cobros capturados',
      (tester) async {
    final api = fakeApi({
      'GET /v1/payments': (_) => json({
            'payments': [
              payment('01900000-aaaa-7000-8000-000000000001', 'CAPTURED', 2500,
                  2433, now)
            ],
            'page': {'next_page_token': ''},
          }),
    });
    await tester.pumpWidget(harness(FinanceScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text(r'$25.00'), findsOneWidget);
    expect(find.text(r'$24.33'), findsOneWidget);
    expect(find.text(r'$0.67'), findsOneWidget);
  });

  testWidgets('S-FIN-04: puntos de cobro reales y su QR con el enlace de cobro',
      (tester) async {
    final api = fakeApi({
      'GET /v1/terminals': (_) => json({
            'terminals': [
              {
                'terminal_id': 't-1',
                'tenant_id': 'm-1',
                'public_code': 'AbCdEfGhIjKlMnOpQrStUv',
                'label': 'Caja 1',
                'active': true
              },
            ],
          }),
    });
    await tester.pumpWidget(harness(TerminalsScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Caja 1'), findsOneWidget);
    expect(find.text('Activo'), findsOneWidget);
    expect(find.text('Caja 1 - Mostrador Principal'), findsNothing);

    await tester.tap(find.text('Caja 1'));
    await tester.pumpAndSettle();
    expect(find.text('Escanea para pagar con PlentyPay'), findsOneWidget);
    expect(find.text('AbCdEfGhIjKlMnOpQrStUv'), findsOneWidget);
  });

  testWidgets('S-FIN-04 vacío', (tester) async {
    final api = fakeApi({
      'GET /v1/terminals': (_) => json({'terminals': <Object>[]})
    });
    await tester.pumpWidget(harness(TerminalsScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Todavía no tienes puntos de cobro.'), findsOneWidget);
  });

  test(
      'AGENTS §3.1: solo los módulos con servicio desplegado abren sus pantallas',
      () {
    final live = moduleRegistry.where((m) => m.live).map((m) => m.id).toSet();
    expect(live, {'wallet', 'finance', 'admin', 'platform'});
  });
}
