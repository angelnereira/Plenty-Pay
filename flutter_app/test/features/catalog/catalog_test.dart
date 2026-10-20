import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/catalog/catalog_screen.dart';
import 'package:plentypay/features/catalog/product_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

final taxRates = {
  'rates': [
    {'kind': 'STANDARD', 'rate_bps': 700},
    {'kind': 'ALCOHOL', 'rate_bps': 1000},
    {'kind': 'TOBACCO', 'rate_bps': 1500},
  ]
};

Future<void> reveal(WidgetTester tester, Finder f) =>
    tester.scrollUntilVisible(f, 200, scrollable: find.byType(Scrollable).first);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-CAT-01: lista real con SKU y precio; vacío dice "Aún no tienes productos."', (tester) async {
    await tester.pumpWidget(harness(CatalogScreen(api: fakeApi({'GET /v1/catalog/products': (_) => json(productsBody)}))));
    await tester.pumpAndSettle();
    expect(find.text('Café 250 g'), findsOneWidget);
    expect(find.text('SKU SKU-Café 250 g'), findsOneWidget);
    expect(find.text(r'$18.50'), findsOneWidget);
  });

  testWidgets('S-CAT-01 vacío: "Aún no tienes productos."', (tester) async {
    await tester.pumpWidget(harness(CatalogScreen(
        api: fakeApi({
      'GET /v1/catalog/products': (_) => json({'products': <Object>[], 'page': {'next_page_token': ''}})
    }))));
    await tester.pumpAndSettle();
    expect(find.text('Aún no tienes productos.'), findsOneWidget);
  });

  testWidgets('S-CAT-01: sin servicio de catálogo dice que no está disponible', (tester) async {
    await tester.pumpWidget(harness(CatalogScreen(
        api: fakeApi({'GET /v1/catalog/products': (_) => gatewayError(503, 'SERVICE_UNAVAILABLE')}))));
    await tester.pumpAndSettle();
    expect(find.text('El catálogo no está disponible en este momento. Intenta de nuevo más tarde.'), findsOneWidget);
  });

  testWidgets('S-CAT-02 / AGENTS §2.13: la tasa sale del servidor; el precio va en centavos y el SKU se genera', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/catalog/categories': (_) => json({'categories': <Object>[]}),
      'GET /v1/catalog/tax-rates': (_) => json(taxRates),
      'POST /v1/catalog/products': (_) => json(product(cafeId, 'Arroz', 425)),
    }, calls: calls);
    await tester.pumpWidget(harness(ProductScreen(api: api)));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Arroz 5 lb');
    await tester.enterText(find.widgetWithText(TextField, 'Código de barras'), '4006381333932');
    await tester.pumpAndSettle();
    expect(find.text('El código de barras no es válido.'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Código de barras'), '4006381333931');
    await reveal(tester, find.widgetWithText(TextField, 'Precio de venta'));
    await tester.enterText(find.widgetWithText(TextField, 'Precio de venta'), '4.25');
    await tester.pumpAndSettle();
    await reveal(tester, find.text('Guardar'));
    expect(find.text('Listo para vender'), findsOneWidget);

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final req = calls.firstWhere((r) => r.method == 'POST' && r.url.path == '/v1/catalog/products');
    final p = (jsonDecode(req.body) as Map)['product'] as Map;
    expect((p['price'] as Map)['amount_minor'], '425');
    expect(p['tax_rate_bps'], 700, reason: 'la general vigente, leída de /v1/catalog/tax-rates');
    expect(p['tax_exempt'], false);
    expect(p['sku'], startsWith('ARROZ5-'));
    expect(req.headers['idempotency-key'], isNotEmpty);
  });

  testWidgets('S-CAT-02: sin precio ni nombre lista lo que falta y no guarda', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(ProductScreen(
        api: fakeApi({
      'GET /v1/catalog/categories': (_) => json({'categories': <Object>[]}),
      'GET /v1/catalog/tax-rates': (_) => json(taxRates),
    }, calls: calls))));
    await tester.pumpAndSettle();
    await reveal(tester, find.text('Guardar'));
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Falta para vender'), findsOneWidget);
    expect(calls.where((r) => r.method == 'POST'), isEmpty);
  });

  test('N-STD-23/24/26: GTIN con dígito de control y código interno', () {
    expect(validGtin('4006381333931'), isTrue);
    expect(validGtin('4006381333932'), isFalse);
    expect(validGtin('96385074'), isTrue);
    final internal = generateInternalCode(123456789);
    expect(internal.length, 13);
    expect(internal.startsWith('2'), isTrue);
    expect(validGtin(internal), isTrue);
    expect(isInternalCode(internal), isTrue);
    expect(isInternalCode('4006381333931'), isFalse);
  });

  test('cantidades en milésimas y tasas en porcentaje', () {
    expect(parseQtyMilli('1.5'), 1500);
    expect(parseQtyMilli('0,250'), 250);
    expect(parseQtyMilli('1.2345'), isNull);
    expect(formatQty(1500, 'KG'), '1.5 kg');
    expect(formatQty(-2000, 'UNIT'), '−2');
    expect(percentOf(700), '7 %');
    expect(percentOf(250), '2.5 %');
  });
}
