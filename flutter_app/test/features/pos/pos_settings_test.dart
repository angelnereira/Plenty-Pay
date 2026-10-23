import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/pp_text_field.dart';
import 'package:plentypay/features/pos/pos_checkout_screen.dart';
import 'package:plentypay/features/pos/pos_data.dart';
import 'package:plentypay/features/pos/pos_receipt_screen.dart';
import 'package:plentypay/features/pos/pos_settings_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Map<String, Object> settings(
        {String pref = 'INTERNAL_ONLY',
        bool cash = true,
        bool wallet = true,
        String footer = '',
        int bps = 0,
        int version = 2}) =>
    {
      'checkout_preference': 'CHECKOUT_PREFERENCE_$pref',
      'cash_enabled': cash,
      'enabled_rails': [if (wallet) 'PAYMENT_RAIL_WALLET'],
      'receipt_footer': footer,
      'max_discount_bps': bps,
      'version': version,
    };

Finder field(String label) =>
    find.descendant(of: find.widgetWithText(PPTextField, label), matching: find.byType(TextField));

Future<void> save(WidgetTester tester) async {
  await tester.scrollUntilVisible(find.text('Guardar'), 200, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(find.text('Guardar'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Guardar'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('F17.11 porcentaje a puntos básicos y de vuelta', () {
    expect(parsePercentBps('15'), 1500);
    expect(parsePercentBps('12.5'), 1250);
    expect(parsePercentBps('0,05'), 5);
    expect(parsePercentBps('100'), 10000);
    expect(parsePercentBps('100.01'), isNull);
    expect(parsePercentBps('1.234'), isNull);
    expect(parsePercentBps('abc'), isNull);
    expect(formatPercentBps(1250), '12.5');
    expect(formatPercentBps(1500), '15');
    expect(formatPercentBps(5), '0.05');
  });

  testWidgets('R14 S-POS-11: carga lo guardado, valida y guarda con la versión leída', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/pos/settings': (_) => json(settings(footer: 'Gracias', bps: 1000)),
      'PUT /v1/pos/settings': (r) => json({...(jsonDecode(r.body) as Map)['settings'] as Map<String, dynamic>, 'version': 3}),
    }, calls: calls);
    await tester.pumpWidget(harness(PosSettingsScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Un recibo interno no sustituye la factura. Consulta tus obligaciones con la DGI.'), findsOneWidget);
    expect(find.text('Por ahora la caja emite recibo interno. La factura desde la venta llegará pronto.'), findsOneWidget);
    expect(find.widgetWithText(TextField, '10'), findsOneWidget, reason: '1000 pb = 10 %');

    // Automático sin monto, sin medios y con un porcentaje inválido: no se envía.
    await tester.tap(find.text('Solo recibo interno'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Automático desde un monto').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Efectivo'));
    await tester.tap(find.text('Saldo PlentyPay'));
    await tester.pumpAndSettle();
    expect(find.text('Deja al menos un medio de pago activo.'), findsOneWidget);
    await tester.tap(find.text('Saldo PlentyPay'));
    await tester.pumpAndSettle();
    expect(find.text('Deja al menos un medio de pago activo.'), findsNothing);
    await tester.enterText(field('Máximo sin supervisor (%)'), '150');
    await tester.pumpAndSettle();
    expect(find.text('Indica un porcentaje de 0 a 100.'), findsOneWidget);
    await save(tester);
    expect(find.text('Indica un monto mayor que 0.'), findsOneWidget);
    expect(calls.where((r) => r.method == 'PUT'), isEmpty);

    await tester.enterText(field('Factura desde'), '50');
    await tester.enterText(field('Máximo sin supervisor (%)'), '12.5');
    await tester.pumpAndSettle();
    await save(tester);
    final put = calls.singleWhere((r) => r.method == 'PUT');
    final body = (jsonDecode(put.body) as Map)['settings'] as Map<String, dynamic>;
    expect(body['checkout_preference'], 'CHECKOUT_PREFERENCE_AUTO_THRESHOLD');
    expect(body['auto_threshold_minor'], '5000');
    expect(body['cash_enabled'], false);
    expect(body['enabled_rails'], ['PAYMENT_RAIL_WALLET']);
    expect(body['max_discount_bps'], 1250);
    expect(body['receipt_footer'], 'Gracias');
    expect(body['version'], 2, reason: 'la versión leída');
    expect(put.headers['Idempotency-Key'], isNotEmpty);
  });

  testWidgets('R14 S-POS-11: si otra persona guardó antes, lo dice y permite recargar', (tester) async {
    var gets = 0;
    final api = fakeApi({
      'GET /v1/pos/settings': (_) {
        gets++;
        return json(settings(version: gets == 1 ? 2 : 3, footer: gets == 1 ? '' : 'Pie nuevo'));
      },
      'PUT /v1/pos/settings': (_) => gatewayError(409, 'VERSION_CONFLICT'),
    });
    await tester.pumpWidget(harness(PosSettingsScreen(api: api)));
    await tester.pumpAndSettle();
    await save(tester);
    expect(find.text('Alguien más cambió la configuración. Vuelve a cargarla.'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'Pie nuevo'), findsOneWidget);
  });

  testWidgets('R14 S-POS-03: con el saldo PlentyPay apagado, el cobro solo ofrece efectivo', (tester) async {
    final api = fakeApi({'GET /v1/pos/settings': (_) => json(settings(wallet: false))});
    await tester.pumpWidget(harness(PosCheckoutScreen(api: api, sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal')));
    await tester.pumpAndSettle();
    expect(find.byType(SegmentedButton<bool>), findsNothing);
    expect(find.text('Saldo PlentyPay'), findsNothing);
  });

  testWidgets('R14 S-POS-03: sin efectivo, todo el cobro va por saldo PlentyPay', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/pos/settings': (_) => json(settings(cash: false)),
      'POST /v1/pos/sales/$saleId/checkout': (_) => json(sale('AWAITING_PAYMENT', tenders: [
            {'rail': 'PAYMENT_RAIL_WALLET', 'amount': {'amount_minor': '1850', 'currency': 'USD'}, 'status': 'PENDING'}
          ])),
      'GET /v1/pos/sales/$saleId': (_) => json(sale('AWAITING_PAYMENT')),
    }, calls: calls);
    await tester.pumpWidget(harness(PosCheckoutScreen(
        api: api, sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal', pollEvery: const Duration(hours: 1))));
    await tester.pumpAndSettle();
    expect(find.byType(SegmentedButton<bool>), findsNothing);
    await tester.tap(find.text('Finalizar venta'));
    await tester.pumpAndSettle();
    final tenders = ((jsonDecode(calls.lastWhere((r) => r.method == 'POST').body) as Map)['tenders'] as List).cast<Map<String, dynamic>>();
    expect(tenders.single['rail'], 'PAYMENT_RAIL_WALLET');
  });

  testWidgets('R14 S-POS-05: el recibo muestra el pie de la configuración', (tester) async {
    final api = fakeApi({'GET /v1/pos/settings': (_) => json(settings(footer: '¡Gracias por su compra!'))});
    await tester.pumpWidget(harness(PosReceiptScreen(
        api: api, sale: SaleItem.fromJson(sale('PAID', receipt: '00000007')), terminalLabel: 'Caja principal')));
    await tester.pumpAndSettle();
    expect(find.text('¡Gracias por su compra!'), findsOneWidget);
  });
}
