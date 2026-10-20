import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/wallet/pay_confirm_screen.dart';

import '../../support/fake_gateway.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const code = 'AbCdEfGhIjKlMnOpQrStUv';
  const sale = '01900000-0000-7000-8000-0000000000aa';

  testWidgets('pos R4: pagar el QR de una venta usa su monto fijo y la referencia {sale, id}', (tester) async {
    final calls = <http.Request>[];
    final intent = {
      'payment_intent_id': '01900000-0000-7000-8000-0000000000b1',
      'status': 'PAYMENT_STATUS_CREATED',
      'amount': {'amount_minor': '1850', 'currency': 'USD'},
    };
    final api = fakeApi({
      'GET /v1/pay-links/$code': (_) => json({'label': 'Caja principal', 'merchant_name': 'Café del Casco'}),
      'GET /v1/wallet/balance': (_) => json(balance(5000)),
      'GET /v1/payments/quote': (_) => json({
            'gross': {'amount_minor': '1850', 'currency': 'USD'},
            'total_charged': {'amount_minor': '1850', 'currency': 'USD'},
            'lines': <Object>[],
          }),
      'POST /v1/payments/intents': (_) => json(intent),
      'POST /v1/payments/intents/01900000-0000-7000-8000-0000000000b1/confirm': (_) =>
          json({...intent, 'status': 'PAYMENT_STATUS_CAPTURED', 'payment_id': '01900000-0000-7000-8000-0000000000c9'}),
    }, calls: calls);
    await tester.pumpWidget(harness(PayConfirmScreen(api: api, code: code, saleId: sale, amountMinor: 1850)));
    await tester.pumpAndSettle(const Duration(seconds: 1));

    final amount = tester.widget<TextField>(find.byType(TextField));
    expect(amount.readOnly, isTrue, reason: 'el monto lo fija la caja');
    expect(find.text('Pago de una venta en caja'), findsOneWidget);
    await tester.tap(find.text(r'Pagar $18.50'));
    await tester.pumpAndSettle();

    final body = jsonDecode(calls.firstWhere((r) => r.url.path == '/v1/payments/intents').body) as Map;
    expect(body['reference'], {'type': 'sale', 'id': sale});
    expect((body['amount'] as Map)['amount_minor'], '1850');
    expect(body['terminal_code'], code);
  });
}
