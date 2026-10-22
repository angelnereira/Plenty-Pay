import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/wallet/pay_confirm_screen.dart';
import 'package:plentypay/features/wallet/pay_result_screen.dart';
import 'package:plentypay/features/wallet/receive_screen.dart';
import 'package:plentypay/features/wallet/send_screen.dart';

import '../../support/fake_gateway.dart';

const code = 'PeRsOnAlCoDe0123456789';
const intentId = '01900000-0000-7000-8000-000000000201';

Map<String, Object> intent(String status) => {
      'payment_intent_id': intentId,
      'status': 'PAYMENT_STATUS_$status',
      'payment_id': status == 'CREATED' ? '' : '01900000-0000-7000-8000-0000000002aa',
      'amount': {'amount_minor': '1250', 'currency': 'USD'},
      'sandbox': true,
    };

Map<String, FakeRoute> personRoutes() => {
      'GET /v1/pay-links/$code': (_) => json({
            'public_code': code,
            'merchant_name': 'Bárbara P.',
            'active': true,
            'kind': 'PERSON',
          }),
      'GET /v1/wallet/balance': (_) => json(balance(5000)),
      'POST /v1/payments/intents': (_) => json(intent('CREATED')),
      'POST /v1/payments/intents/$intentId/confirm': (_) => json(intent('CAPTURED')),
      'GET /v1/payments/intents/$intentId': (_) => json(intent('CAPTURED')),
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F11.10 S-WAL-04: QR real con el enlace del código, nombre, vigencia y monto pedido',
      (tester) async {
    final api = fakeApi({
      'GET /v1/wallet/receive-code': (_) => json({
            'code': code,
            'link': 'https://plentypay.app/t/$code',
            'display_name': 'Bárbara P.',
            'expires_at': '2026-10-22T23:00:00Z',
          }),
    });
    await tester.pumpWidget(harness(ReceiveScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Bárbara P.'), findsOneWidget);
    expect(find.textContaining('Válido hasta el 22 de octubre de 2026'), findsOneWidget);
    expect(find.byKey(const ValueKey('https://plentypay.app/t/$code')), findsOneWidget);
    expect(find.textContaining('no disponible'), findsNothing);

    await tester.enterText(find.byType(TextField), '12.50');
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('https://plentypay.app/t/$code?amount=1250')), findsOneWidget);

    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    await tester.ensureVisible(find.text('Copiar enlace'));
    await tester.tap(find.text('Copiar enlace'));
    await tester.pumpAndSettle();
    expect(copied, 'https://plentypay.app/t/$code?amount=1250');
  });

  testWidgets('F11.10 S-WAL-03: «Enviar» abre el lector con su título y su instrucción', (tester) async {
    await tester.pumpWidget(harness(SendScreen(api: fakeApi({}), startScanner: false)));
    await tester.pumpAndSettle();
    expect(find.text('Enviar'), findsOneWidget);
    expect(find.text('Escanea el código de quien recibe o escríbelo abajo.'), findsOneWidget);
  });

  testWidgets('F11.10 R10: a una persona se envía el monto exacto, sin cotizar comisiones', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(PayConfirmScreen(
        api: fakeApi(personRoutes(), calls: calls), code: code, amountMinor: 1250)));
    await tester.pumpAndSettle();
    expect(find.text('Bárbara P.'), findsOneWidget);
    expect(find.text('Persona verificada en PlentyPay'), findsOneWidget);
    expect(find.text('Enviar entre personas no tiene comisión.'), findsOneWidget);
    expect(find.text(r'Enviar $12.50'), findsOneWidget);
    expect(calls.where((r) => r.url.path == '/v1/payments/quote'), isEmpty,
        reason: 'una transferencia no tiene comisión que cotizar');

    await tester.tap(find.text(r'Enviar $12.50'));
    await tester.pumpAndSettle();
    final create = calls.singleWhere((r) => r.method == 'POST' && r.url.path == '/v1/payments/intents');
    final body = jsonDecode(create.body) as Map<String, dynamic>;
    expect(body['terminal_code'], code);
    expect((body['amount'] as Map)['amount_minor'], '1250');
    expect(find.byType(PayResultScreen), findsOneWidget);
  });
}
