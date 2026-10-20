import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/catalog/catalog_screen.dart';
import 'package:plentypay/features/catalog/product_screen.dart';
import 'package:plentypay/features/catalog/storefront_settings_screen.dart';
import 'package:plentypay/features/inventory/stock_detail_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

/// Producto con foto y su publicación en el marketplace (`listed_in_marketplace`, catalog R4).
Map<String, Object> listedProduct({bool listed = true}) => {
      ...product(cafeId, 'Café 250 g', 1850, barcode: '4006381333931'),
      'image_object_keys': ['/media/t/cafe.jpg'],
      'listed_in_marketplace': listed,
    };

final refs = <String, FakeRoute>{
  'GET /v1/catalog/categories': (_) => json({'categories': <Object>[]}),
  'GET /v1/catalog/tax-rates': (_) => json({
        'rates': [
          {'kind': 'STANDARD', 'rate_bps': 700}
        ]
      }),
};

Finder listingSwitch() => find.byKey(const Key('listing-$cafeId'));

Future<void> reveal(WidgetTester tester, Finder f) => tester.scrollUntilVisible(f, 200,
    scrollable: find.byType(Scrollable).first);

bool switchValue(WidgetTester tester) =>
    tester.widget<SwitchListTile>(listingSwitch()).value;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('R4: el producto trae su publicación en el marketplace', () {
    expect(ProductItem.fromJson(listedProduct()).listed, isTrue);
    expect(ProductItem.fromJson(product(panId, 'Croissant', 425)).listed, isFalse);
  });

  testWidgets('S-CAT-02: "Mostrar en el marketplace" oculta el producto al instante',
      (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(ProductScreen(
        api: fakeApi({
          ...refs,
          'GET /v1/catalog/storefront': (_) => json(storefrontBody(storeA, 'Café La Esquina')),
          'PUT /v1/catalog/products/$cafeId/listing': (_) =>
              json({'product_id': cafeId, 'listed': false}),
        }, calls: calls),
        product: ProductItem.fromJson(listedProduct()))));
    await tester.pumpAndSettle();
    await reveal(tester, listingSwitch());
    expect(find.text('Mostrar en el marketplace'), findsOneWidget);
    expect(switchValue(tester), isTrue);
    await tester.tap(listingSwitch());
    await tester.pumpAndSettle();
    final put = calls.singleWhere((r) => r.method == 'PUT');
    expect((jsonDecode(put.body) as Map)['listing']['listed'], false);
    expect(switchValue(tester), isFalse);
    expect(find.text('Producto oculto del marketplace.'), findsOneWidget);
    expect(calls.any((r) => r.url.path == '/v1/catalog/products/$cafeId' && r.method != 'GET'), isFalse,
        reason: 'no espera a "Guardar"');
  });

  testWidgets('S-CAT-02: LISTING_INCOMPLETE deja el interruptor apagado y dice qué falta',
      (tester) async {
    await tester.pumpWidget(harness(ProductScreen(
        api: fakeApi({
          ...refs,
          'GET /v1/catalog/storefront': (_) => json(storefrontBody(storeA, 'Café La Esquina')),
          'PUT /v1/catalog/products/$cafeId/listing': (_) => gatewayError(400, 'LISTING_INCOMPLETE'),
        }),
        product: ProductItem.fromJson(listedProduct(listed: false)))));
    await tester.pumpAndSettle();
    await reveal(tester, listingSwitch());
    await tester.tap(listingSwitch());
    await tester.pumpAndSettle();
    expect(switchValue(tester), isFalse);
    expect(find.text('Al producto le falta foto o precio para publicarse.'), findsOneWidget);
  });

  testWidgets('N-CON-02: publicado con la tienda oculta avisa que no se verá hasta mostrarla',
      (tester) async {
    await tester.pumpWidget(harness(ProductScreen(
        api: fakeApi({...refs}), // sin vitrina: 404
        product: ProductItem.fromJson(listedProduct()))));
    await tester.pumpAndSettle();
    await reveal(tester, listingSwitch());
    expect(find.text('Tu tienda está oculta: el producto se verá cuando la muestres.'), findsOneWidget);
  });

  testWidgets('S-CAT-01 e3: etiqueta "En el marketplace" en los publicados', (tester) async {
    await tester.pumpWidget(harness(CatalogScreen(
        api: fakeApi({
      'GET /v1/catalog/products': (_) => json({
            'products': [listedProduct(), product(panId, 'Croissant', 425, rate: 0)],
            'page': {'next_page_token': ''},
          }),
    }))));
    await tester.pumpAndSettle();
    expect(find.text('En el marketplace'), findsOneWidget);
  });

  testWidgets('S-INV-02: el detalle de existencias publica el producto', (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(StockDetailScreen(
        api: fakeApi({
          'GET /v1/inventory/warehouses': (_) => json({'warehouses': <Object>[]}),
          'GET /v1/inventory/stock': (_) => json({'levels': <Object>[], 'page': {'next_page_token': ''}}),
          'GET /v1/inventory/movements': (_) => json({'movements': <Object>[]}),
          'GET /v1/catalog/storefront': (_) => json(storefrontBody(storeA, 'Café La Esquina')),
          'PUT /v1/catalog/products/$cafeId/listing': (_) =>
              json({'product_id': cafeId, 'listed': true}),
        }, calls: calls),
        product: ProductItem.fromJson(listedProduct(listed: false)))));
    await tester.pumpAndSettle();
    expect(switchValue(tester), isFalse);
    await tester.tap(listingSwitch());
    await tester.pumpAndSettle();
    expect(switchValue(tester), isTrue);
    expect(find.text('Producto publicado en el marketplace.'), findsOneWidget);
  });

  testWidgets('S-CAT-05 e6: los interruptores reflejan lo publicado aunque la tienda esté oculta',
      (tester) async {
    final calls = <http.Request>[];
    await tester.pumpWidget(harness(StorefrontSettingsScreen(
        api: fakeApi({
          'GET /v1/catalog/storefront': (_) =>
              json({...storefrontBody(storeA, 'Café La Esquina'), 'published': false}),
          'GET /v1/catalog/products': (_) => json({
                'products': [listedProduct()],
                'page': {'next_page_token': ''},
              }),
          'PUT /v1/catalog/products/$cafeId/listing': (_) =>
              json({'product_id': cafeId, 'listed': false}),
        }, calls: calls))));
    await tester.pumpAndSettle();
    await reveal(tester, listingSwitch());
    expect(switchValue(tester), isTrue);
    expect(find.text('Tu tienda está oculta: el producto se verá cuando la muestres.'), findsOneWidget);
    await tester.tap(listingSwitch());
    await tester.pumpAndSettle();
    expect(switchValue(tester), isFalse);
    expect(calls.any((r) => r.url.path == '/v1/marketplace/search'), isFalse,
        reason: 'lo publicado sale del producto, no de la búsqueda');
  });
}
