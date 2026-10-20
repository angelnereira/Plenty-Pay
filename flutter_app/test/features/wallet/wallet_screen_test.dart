import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/money_text.dart';
import 'package:plentypay/features/wallet/wallet_screen.dart';

import '../../support/fake_gateway.dart';

Map<String, Object> line(String type, String side, int amount, String at,
        {String desc = ''}) =>
    {
      'entry': {
        'entry_id': 'e-$at',
        'account_id': 'a-1',
        'side': side,
        'amount_minor': '$amount',
      },
      'transaction_id':
          '01900000-0000-7000-8000-${at.replaceAll(RegExp(r'\D'), '').padLeft(12, '0').substring(0, 12)}',
      'transaction_type': type,
      'description': desc,
      'running_balance_minor': '0',
      'effective_at': at,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
      'S-WAL-01: saldo, retenido y movimientos reales con signo y mes en texto',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/wallet/balance': (_) => json(balance(7500, held: 1200)),
      'GET /v1/wallet/statement': (_) => json({
            'opening_balance_minor': '0',
            'lines': [
              line('WALLET_TOPUP', 'ENTRY_SIDE_CREDIT', 10000,
                  '2026-10-18T15:15:00Z'),
              line('WALLET_PAYMENT', 'ENTRY_SIDE_DEBIT', 2500,
                  '2026-10-19T13:40:00Z'),
            ],
          }),
    }, calls: calls);
    await tester.pumpWidget(harness(WalletScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.text(r'$75.00'), findsOneWidget);
    expect(find.text(r'Retenido: $12.00'), findsOneWidget);
    expect(find.text('Recarga'), findsOneWidget);
    expect(find.text('Pago'), findsOneWidget);
    expect(find.text(r'−$25.00'), findsOneWidget);
    expect(find.text(r'$100.00'), findsOneWidget);
    expect(find.textContaining('octubre'), findsNWidgets(2));
    // El pago (más reciente) va primero.
    expect(tester.getTopLeft(find.text('Pago')).dy,
        lessThan(tester.getTopLeft(find.text('Recarga')).dy));
    // N-STD-10 y ledger §4: el extracto se pide con un rango y la moneda.
    final st = calls.firstWhere((r) => r.url.path == '/v1/wallet/statement');
    expect(
        st.url.queryParameters.keys, containsAll(['from', 'to', 'currency']));
  });

  testWidgets('S-WAL-01 vacío: "Aún no tienes movimientos." con Recargar',
      (tester) async {
    final api = fakeApi({
      'GET /v1/wallet/balance': (_) => json(balance(0)),
      'GET /v1/wallet/statement': (_) =>
          json({'opening_balance_minor': '0', 'lines': <Object>[]}),
    });
    await tester.pumpWidget(harness(WalletScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.text('Aún no tienes movimientos.'), findsOneWidget);
    expect(find.text(r'$0.00'), findsOneWidget);
  });

  testWidgets('S-WAL-01: sin ledger desplegado muestra el aviso y Reintentar',
      (tester) async {
    final api = fakeApi({
      'GET /v1/wallet/balance': (_) => gatewayError(503, 'SERVICE_UNAVAILABLE')
    });
    await tester.pumpWidget(harness(WalletScreen(api: api)));
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Tu billetera todavía no está disponible. Intenta de nuevo más tarde.'),
        findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets(
      'las recargas no fingen éxito: dicen que aún no están disponibles',
      (tester) async {
    final api = fakeApi({
      'GET /v1/wallet/balance': (_) => json(balance(0)),
      'GET /v1/wallet/statement': (_) => json({'lines': <Object>[]}),
    });
    await tester.pumpWidget(harness(WalletScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recargar').first);
    await tester.pumpAndSettle();

    expect(find.text('Todavía no disponible'), findsOneWidget);
    expect(find.textContaining('Pago creado'), findsNothing);
  });

  test('ADR 0013: los montos escritos se leen como centavos enteros', () {
    expect(MoneyText.parse('12'), 1200);
    expect(MoneyText.parse('12.5'), 1250);
    expect(MoneyText.parse('1,234.56'), 123456);
    expect(MoneyText.parse('0.1'), 10);
    expect(MoneyText.parse('12.345'), isNull);
    expect(MoneyText.parse('abc'), isNull);
    expect(MoneyText.parse('-5'), isNull);
  });
}
