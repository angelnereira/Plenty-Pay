import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/catalog/storefront_settings_screen.dart';
import 'package:plentypay/features/marketplace/cart_screen.dart';
import 'package:plentypay/features/marketplace/checkout_screen.dart';
import 'package:plentypay/features/marketplace/market_data.dart';
import 'package:plentypay/features/marketplace/market_discover_screen.dart';
import 'package:plentypay/features/marketplace/market_order_detail_screen.dart';
import 'package:plentypay/features/marketplace/market_orders_screen.dart';
import 'package:plentypay/features/marketplace/market_product_screen.dart';
import 'package:plentypay/features/marketplace/storefront_screen.dart';
import 'package:plentypay/features/orders/order_manage_detail_screen.dart';
import 'package:plentypay/features/orders/orders_manage_screen.dart';

import '../support/commerce_fixtures.dart';
import '../support/fake_gateway.dart';

/// gravital-experience-ui §15.3: texto al 200 %, compact y expanded, oscuro y claro, sin desbordes,
/// para comprar (S-MKT-01..07), pedidos del comercio (S-ORD-01/02) y la vitrina (S-CAT-05).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final deadline =
      DateTime.now().add(const Duration(minutes: 4)).toUtc().toIso8601String();
  final long = 'Panadería y Repostería Artesanal Sol de Bella Vista';
  final routes = <String, FakeRoute>{
    'GET /v1/marketplace/search': (_) => json({
          'results': [
            listing(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850, storeA, long),
            listing(panId, 'Croissant', 425, storeB, 'Panadería Sol', inStock: false),
          ],
          'page': {'next_page_token': ''},
        }),
    'GET /v1/marketplace/products/$cafeId': (_) =>
        json(listing(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850, storeA, long)),
    'GET /v1/marketplace/storefronts/$storeA': (_) => json(storefrontBody(storeA, long)),
    'GET /v1/marketplace/storefronts/$storeB': (_) => json(storefrontBody(storeB, 'Panadería Sol')),
    'GET /v1/cart': (_) => json(cartBody),
    'POST /v1/orders/quote': (_) => json(quoteBody(unavailable: [panId])),
    'GET /v1/orders': (_) => json({
          'orders': [
            orderBody('PAID', [subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: deadline)]),
          ]
        }),
    'GET /v1/orders/$orderId': (_) => json(orderBody('PARTIALLY_FULFILLED', [
          subOrder(subA, storeA, 'READY', code: '482913'),
          subOrder(subB, storeB, 'REJECTED', reason: 'OUT_OF_STOCK', total: 425),
        ])),
    'GET /v1/merchant/orders': (_) => json({
          'sub_orders': [
            subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: deadline),
            subOrder(subB, storeA, 'READY'),
          ]
        }),
    'GET /v1/catalog/storefront': (_) => json(storefrontBody(storeA, long)),
    'GET /v1/catalog/products': (_) => json(productsBody),
  };

  final screens = <String, Widget Function()>{
    'descubrir': () => MarketDiscoverScreen(api: fakeApi(routes)),
    'producto': () => MarketProductScreen(
        api: fakeApi(routes),
        product: MarketProduct.fromJson(
            listing(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850, storeA, long))),
    'tienda': () => StorefrontScreen(api: fakeApi(routes), tenantId: storeA, name: long),
    'carrito': () => CartScreen(api: fakeApi(routes)),
    'pagar': () => CheckoutScreen(api: fakeApi(routes)),
    'mis pedidos': () => MarketOrdersScreen(api: fakeApi(routes)),
    'detalle del pedido': () => MarketOrderDetailScreen(api: fakeApi(routes), orderId: orderId),
    'bandeja del comercio': () => OrdersManageScreen(api: fakeApi(routes)),
    'sub-pedido por aceptar': () => OrderManageDetailScreen(
        api: fakeApi(routes),
        sub: SubOrderItem.fromJson(subOrder(subA, storeA, 'AWAITING_ACCEPTANCE', deadline: deadline))),
    'sub-pedido listo': () => OrderManageDetailScreen(
        api: fakeApi(routes), sub: SubOrderItem.fromJson(subOrder(subA, storeA, 'READY'))),
    'mi tienda en línea': () => StorefrontSettingsScreen(api: fakeApi(routes)),
  };

  for (final entry in screens.entries) {
    for (final size in const [Size(360, 800), Size(1280, 800)]) {
      for (final brightness in Brightness.values) {
        testWidgets('${entry.key} al 200 % en ${size.width.toInt()} dp, ${brightness.name}, sin desbordes',
            (tester) async {
          await pumpAt(tester, entry.value(), brightness: brightness, size: size);
          await tester.pump(const Duration(seconds: 1));
          expect(tester.takeException(), isNull);
        });
      }
    }
  }
}
