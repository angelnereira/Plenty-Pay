import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/wallet/pay_confirm_screen.dart';
import 'package:plentypay/features/wallet/pay_data.dart';
import 'package:plentypay/features/wallet/pay_result_screen.dart';
import 'package:plentypay/features/wallet/pay_scan_screen.dart';

import '../../support/fake_gateway.dart';

const code = 'AbCdEfGhIjKlMnOpQrStUv';
const intentId = '01900000-0000-7000-8000-000000000001';
const paymentId = '01900000-0000-7000-8000-0000000000aa';

Map<String, Object> intent(String status) => {
      'payment_intent_id': intentId,
      'status': 'PAYMENT_STATUS_$status',
      'payment_id': status == 'CREATED' ? '' : paymentId,
      'amount': {'amount_minor': '2500', 'currency': 'USD'},
      'sandbox': true,
    };

Map<String, FakeRoute> payRoutes(
        {int available = 10000, FakeRoute? confirm, List<String>? statuses}) =>
    {
      'GET /v1/pay-links/$code': (_) => json({
            'public_code': code,
            'label': 'Caja 1',
            'merchant_name': 'Tienda Verificada',
            'active': true
          }),
      'GET /v1/wallet/balance': (_) => json(balance(available)),
      'GET /v1/payments/quote': (req) {
        final amount = req.url.queryParameters['amount'];
        return json({
          'gross': {'amount_minor': amount, 'currency': 'USD'},
          'merchant_net': {
            'amount_minor': '${int.parse(amount!) - 67}',
            'currency': 'USD'
          },
          'lines': [
            {
              'kind': 'PLATFORM',
              'amount': {'amount_minor': '63', 'currency': 'USD'}
            },
            {
              'kind': 'TAX',
              'amount': {'amount_minor': '4', 'currency': 'USD'}
            },
          ],
        });
      },
      'POST /v1/payments/intents': (_) => json(intent('CREATED')),
      'POST /v1/payments/intents/$intentId/confirm':
          confirm ?? (_) => json(intent('CAPTURED')),
      'GET /v1/payments/intents/$intentId': (_) => json(intent(
          statuses != null && statuses.isNotEmpty
              ? statuses.removeAt(0)
              : 'CAPTURED')),
    };

Future<void> enterAmount(WidgetTester tester, String text) async {
  await tester.enterText(find.byType(TextField), text);
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
      'S-WAL-06 e1/e4: comercio verificado del servidor y desglose antes de pagar',
      (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
        harness(PayConfirmScreen(api: fakeApi(payRoutes()), code: code)));
    await tester.pumpAndSettle();
    expect(find.text('Tienda Verificada'), findsOneWidget);
    expect(
        find.bySemanticsLabel(RegExp('Comercio verificado')), findsOneWidget);

    await enterAmount(tester, '25');
    expect(find.text('Compra'), findsOneWidget);
    expect(find.text(r'Pagar $25.00'), findsOneWidget);
    // MERCHANT paga la comisión: N-CON-01 no muestra líneas que la persona no paga.
    expect(find.text('Comisión de servicio'), findsNothing);
    semantics.dispose();
  });

  testWidgets(
      'F11.3 punta a punta: crea el intent con la terminal y confirma → Pago realizado',
      (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(
        PayConfirmScreen(api: fakeApi(payRoutes(), calls: calls), code: code)));
    await tester.pumpAndSettle();
    await enterAmount(tester, '25');
    await tester.tap(find.text(r'Pagar $25.00'));
    await tester.pumpAndSettle();

    final create = calls.firstWhere(
        (r) => r.method == 'POST' && r.url.path == '/v1/payments/intents');
    final body = jsonDecode(create.body) as Map<String, dynamic>;
    expect(body['terminal_code'], code);
    expect((body['amount'] as Map)['amount_minor'], '2500');
    expect(create.headers['Idempotency-Key'], isNotEmpty);
    final confirm = calls.firstWhere((r) => r.url.path.endsWith('/confirm'));
    expect(confirm.headers['Idempotency-Key'], 'confirm:$intentId');

    expect(find.text('Pago realizado'), findsOneWidget);
    expect(
        find.text('Modo de prueba: no se mueve dinero real.'), findsOneWidget);
    expect(find.text('Referencia 01900000'), findsOneWidget);
  });

  testWidgets('S-WAL-06 e3: saldo que no alcanza deshabilita Pagar',
      (tester) async {
    await tester.pumpWidget(harness(PayConfirmScreen(
        api: fakeApi(payRoutes(available: 1000)), code: code)));
    await tester.pumpAndSettle();
    await enterAmount(tester, '25');
    expect(find.text('Saldo insuficiente'), findsOneWidget);
    final button = tester.widget<FilledButton>(find.ancestor(
        of: find.text(r'Pagar $25.00'),
        matching: find.byWidgetPredicate((w) => w is FilledButton)));
    expect(button.onPressed, isNull);
  });

  testWidgets('S-WAL-07 Rechazado: saldo insuficiente → "No se te cobró nada."',
      (tester) async {
    await tester.pumpWidget(harness(PayConfirmScreen(
        api: fakeApi(payRoutes(
            confirm: (_) => gatewayError(409, 'INSUFFICIENT_FUNDS'),
            statuses: ['FAILED'])),
        code: code)));
    await tester.pumpAndSettle();
    await enterAmount(tester, '25');
    await tester.tap(find.text(r'Pagar $25.00'));
    await tester.pumpAndSettle();

    expect(find.text('No se pudo completar el pago'), findsOneWidget);
    expect(find.text('Saldo insuficiente.'), findsOneWidget);
    expect(find.text('No se te cobró nada.'), findsOneWidget);
  });

  testWidgets(
      'F23.4: UNKNOWN se muestra como "confirmando" y cambia solo al resolverse',
      (tester) async {
    final api = fakeApi(payRoutes(statuses: ['UNKNOWN', 'CAPTURED']));
    await tester.pumpWidget(harness(PayResultScreen(
      api: api,
      intent: PayIntent.fromJson(intent('UNKNOWN')),
      merchantName: 'Tienda Verificada',
      totalMinor: 2500,
      pollEvery: const Duration(milliseconds: 20),
    )));
    await tester.pump();
    expect(find.text('Estamos confirmando tu pago'), findsOneWidget);
    expect(find.text('No se pudo completar el pago'), findsNothing);

    await tester.pump(const Duration(milliseconds: 30));
    await tester.pump(const Duration(milliseconds: 30));
    await tester.pumpAndSettle();
    expect(find.text('Pago realizado'), findsOneWidget);
  });

  testWidgets('S-WAL-05: un código mal formado no se abre', (tester) async {
    await tester.pumpWidget(
        harness(PayScanScreen(api: fakeApi(payRoutes()), startScanner: false)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Continuar'), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    expect(find.text('Ese código de cobro no es válido.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), code);
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    expect(find.text('Tienda Verificada'), findsOneWidget);
  });
}
