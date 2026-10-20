import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/pos/pos_checkout_screen.dart';
import 'package:plentypay/features/pos/pos_close_session_screen.dart';
import 'package:plentypay/features/pos/pos_data.dart';
import 'package:plentypay/features/pos/pos_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Map<String, dynamic> bodyOf(List<http.Request> calls, String method, String path) =>
    jsonDecode(calls.lastWhere((r) => r.method == method && r.url.path == path).body) as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-POS-01: sin sesión abre la caja en un punto de cobro con su fondo en centavos', (tester) async {
    final calls = <http.Request>[];
    var opened = false;
    final api = fakeApi({
      'GET /v1/pos/sessions/current': (r) => opened ? json(session()) : notFound(r),
      'GET /v1/terminals': (_) => json(terminalsBody),
      'POST /v1/pos/sessions': (_) {
        opened = true;
        return json(session());
      },
      'GET /v1/catalog/products': (_) => json(productsBody),
    }, calls: calls);
    await tester.pumpWidget(harness(PosScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.text('Caja principal'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '50');
    await tester.tap(find.widgetWithText(FilledButton, 'Abrir caja'));
    await tester.pumpAndSettle();

    final b = bodyOf(calls, 'POST', '/v1/pos/sessions');
    expect(b['terminal_label'], terminalCode);
    expect((b['opening_float'] as Map)['amount_minor'], '5000');
    expect(calls.firstWhere((r) => r.url.path == '/v1/pos/sessions').headers['idempotency-key'], isNotEmpty);
    // Con la sesión abierta entra a la venta (S-POS-02).
    expect(find.text('Café 250 g'), findsOneWidget);
  });

  testWidgets('S-POS-02: el ticket suma con ITBMS por tasa y Exento; el precio lo fija el servidor', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/pos/sessions/current': (_) => json(session()),
      'GET /v1/terminals': (_) => json(terminalsBody),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'POST /v1/pos/sales': (_) => json(sale('OPEN')),
      'PUT /v1/pos/sales/$saleId': (_) => json(sale('OPEN', total: 2275)),
    }, calls: calls);
    await tester.pumpWidget(harness(PosScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.pumpAndSettle(); // la vista de venta carga el catálogo al construirse

    await tester.tap(find.text('Café 250 g'));
    await tester.tap(find.text('Croissant'));
    await tester.pumpAndSettle();
    // 18.50 con 7 % incluido → 1.21; 4.25 exento.
    expect(find.text('ITBMS 7 %'), findsOneWidget);
    expect(find.text(r'$1.21'), findsOneWidget);
    expect(find.text('Exento'), findsOneWidget);
    expect(find.text(r'Cobrar $22.75'), findsOneWidget);

    await tester.tap(find.text(r'Cobrar $22.75'));
    await tester.pumpAndSettle();
    final put = bodyOf(calls, 'PUT', '/v1/pos/sales/$saleId');
    final lines = (put['lines'] as List).cast<Map<String, dynamic>>();
    expect(lines.map((l) => l['product_id']), [cafeId, panId]);
    expect(lines.every((l) => !l.containsKey('unit_price')), isTrue, reason: 'el cliente nunca fija el precio');
    expect(bodyOf(calls, 'POST', '/v1/pos/sales')['client_sale_id'], isNotEmpty);
    expect(find.text('Cobro'), findsOneWidget);
  });

  testWidgets('S-POS-03/05: efectivo con vuelto → recibo interno con su leyenda', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'POST /v1/pos/sales/$saleId/checkout': (_) => json(sale('PAID', receipt: '00000001', tenders: [
            {
              'rail': 'PAYMENT_RAIL_CASH',
              'amount': {'amount_minor': '1850', 'currency': 'USD'},
              'cash_tendered': {'amount_minor': '2000', 'currency': 'USD'},
              'status': 'CAPTURED'
            }
          ])),
    }, calls: calls);
    await tester.pumpWidget(harness(PosCheckoutScreen(api: api, sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20');
    await tester.pumpAndSettle();
    expect(find.text(r'Vuelto $1.50'), findsOneWidget);
    await tester.tap(find.text('Finalizar venta'));
    await tester.pumpAndSettle();

    final tenders = (bodyOf(calls, 'POST', '/v1/pos/sales/$saleId/checkout')['tenders'] as List).cast<Map<String, dynamic>>();
    expect(tenders.single['rail'], 'PAYMENT_RAIL_CASH');
    expect((tenders.single['cash_tendered'] as Map)['amount_minor'], '2000');
    expect(find.text('Recibo 00000001'), findsOneWidget);
    expect(find.text('Recibo interno'), findsOneWidget);
    expect(find.text('Este documento no es una factura fiscal.'), findsOneWidget);
    expect(find.textContaining('octubre'), findsOneWidget, reason: 'N-STD-10: mes en texto');
  });

  testWidgets('S-POS-03 e4: saldo PlentyPay muestra el QR y la venta se cierra sola al confirmarse', (tester) async {
    var polls = 0;
    const qr = 'https://plentypay.app/t/$terminalCode?sale=$saleId&amount=1850&currency=USD';
    final wallet = {
      'rail': 'PAYMENT_RAIL_WALLET',
      'amount': {'amount_minor': '1850', 'currency': 'USD'},
    };
    final api = fakeApi({
      'POST /v1/pos/sales/$saleId/checkout': (_) => json(sale('AWAITING_PAYMENT', tenders: [
            {
              ...wallet,
              'status': 'PENDING',
              'next_action': {'type': 'QR', 'url': qr, 'qr_payload': qr}
            }
          ])),
      'GET /v1/pos/sales/$saleId': (_) {
        polls++;
        return json(polls < 2
            ? sale('AWAITING_PAYMENT', tenders: [
                {...wallet, 'status': 'PENDING'}
              ])
            : sale('PAID', receipt: '00000002', tenders: [
                {...wallet, 'status': 'CAPTURED'}
              ]));
      },
    });
    await tester.pumpWidget(harness(PosCheckoutScreen(
        api: api, sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal', pollEvery: const Duration(milliseconds: 100))));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Saldo PlentyPay'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finalizar venta'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 10));
    }
    expect(find.text('Esperando al cliente…'), findsOneWidget);
    expect(find.text(r'Escanea para pagar $18.50'), findsOneWidget);

    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pumpAndSettle();
    expect(find.text('Recibo 00000002'), findsOneWidget);
  });

  testWidgets('S-POS-10: el esperado se muestra solo tras confirmar el conteo; una diferencia exige nota', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/pos/sessions/$sessionId': (_) => json(session(expected: 6000)),
      'POST /v1/pos/sessions/$sessionId/close': (_) => json({...session(expected: 6000), 'status': 'CLOSED'}),
    }, calls: calls);
    await tester.pumpWidget(harness(PosCloseSessionScreen(api: api, sessionId: sessionId)));
    await tester.pumpAndSettle();

    expect(find.textContaining('Esperado'), findsNothing);
    await tester.enterText(find.byType(TextField), '59');
    await tester.tap(find.text('Confirmar conteo'));
    await tester.pumpAndSettle();
    expect(find.text(r'Esperado $60.00'), findsOneWidget);
    expect(find.text(r'Diferencia −$1.00'), findsOneWidget);

    await tester.tap(find.text('Cerrar caja'));
    await tester.pumpAndSettle();
    expect(calls.where((r) => r.url.path.endsWith('/close')), isEmpty, reason: 'sin nota no cierra');
    await tester.enterText(find.byType(TextField).last, 'Faltó cambio');
    await tester.tap(find.text('Cerrar caja'));
    await tester.pumpAndSettle();
    final b = bodyOf(calls, 'POST', '/v1/pos/sessions/$sessionId/close');
    expect((b['counted_cash'] as Map)['amount_minor'], '5900');
    expect(b['notes'], 'Faltó cambio');
  });

  test('R2: impuesto incluido por línea con half_up (mismo cálculo que pos)', () {
    expect(halfUp(1850, 10000, 10700), 1729);
    expect(halfUp(399, 1500, 1000), 599, reason: '1.5 kg × 3.99 = 5.985 → 5.99');
  });
}
