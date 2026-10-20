import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/marketplace/cart_screen.dart';
import 'package:plentypay/features/marketplace/checkout_screen.dart';
import 'package:plentypay/features/marketplace/market_data.dart';
import 'package:plentypay/features/marketplace/market_discover_screen.dart';
import 'package:plentypay/features/marketplace/market_order_detail_screen.dart';
import 'package:plentypay/features/marketplace/market_orders_screen.dart';
import 'package:plentypay/features/marketplace/market_product_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Map<String, dynamic> bodyOf(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

/// Pantallas con temporizadores (sondeo, cuenta regresiva): se avanza el reloj en vez de esperar
/// a que se asienten.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('S-MKT-01 Descubrir', () {
    testWidgets('N-CON-01: precio total, tienda y "Agotado"; contador del carrito',
        (tester) async {
      await tester.pumpWidget(harness(MarketDiscoverScreen(
          api: fakeApi({
        'GET /v1/marketplace/search': (_) => json(searchBody),
        'GET /v1/cart': (_) => json(cartBody),
      }))));
      await tester.pumpAndSettle();
      expect(find.text('Café 250 g'), findsOneWidget);
      expect(find.text(r'$18.50'), findsOneWidget);
      expect(find.text('Café La Esquina'), findsOneWidget);
      expect(find.text('Agotado'), findsOneWidget);
      expect(find.text('2'), findsOneWidget); // dos líneas en el carrito
    });

    testWidgets('vacío con búsqueda: "No encontramos resultados para “…”."',
        (tester) async {
      final calls = <http.Request>[];
      await tester.pumpWidget(harness(MarketDiscoverScreen(
          api: fakeApi({
        'GET /v1/marketplace/search': (_) =>
            json({'results': <Object>[], 'page': {'next_page_token': ''}}),
        'GET /v1/cart': (_) => json({'items': <Object>[]}),
      }, calls: calls))));
      await tester.pumpAndSettle();
      expect(find.text('Todavía no hay productos publicados.'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'té verde');
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(find.text('No encontramos resultados para “té verde”.'),
          findsOneWidget);
      expect(
          calls.last.url.queryParameters['q'], 'té verde',
          reason: 'busca tras 400 ms sin escribir');
    });
  });

  group('S-MKT-02 Producto', () {
    testWidgets('agregar suma a lo que ya había en el carrito (cantidad total)',
        (tester) async {
      final calls = <http.Request>[];
      final p = MarketProduct.fromJson(listing(cafeId, 'Café 250 g', 1850, storeA, 'Café La Esquina'));
      await tester.pumpWidget(harness(MarketProductScreen(
          api: fakeApi({
            'GET /v1/marketplace/products/$cafeId': (_) =>
                json(listing(cafeId, 'Café 250 g', 1850, storeA, 'Café La Esquina')),
            'GET /v1/cart': (_) => json(cartBody),
            'PUT /v1/cart/items/$cafeId': (_) => json(cartBody),
          }, calls: calls),
          product: p)));
      await tester.pumpAndSettle();
      expect(find.text('ITBMS incluido'), findsOneWidget);
      expect(find.text('Vendido por Café La Esquina'), findsOneWidget);
      await tester.ensureVisible(find.byTooltip('+'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('+'));
      await tester.pump();
      await tester.tap(find.text('Agregar al carrito'));
      await tester.pumpAndSettle();
      final put = calls.singleWhere((r) => r.method == 'PUT');
      expect(bodyOf(put)['quantity_milli'], '4000', reason: '2 en el carrito + 2 elegidos');
      expect(put.headers['Idempotency-Key'] ?? put.headers['idempotency-key'], isNotEmpty);
      expect(find.text('Agregado al carrito.'), findsOneWidget);
    });

    testWidgets('agotado: el botón dice "Agotado" y está deshabilitado',
        (tester) async {
      final p = MarketProduct.fromJson(
          listing(panId, 'Croissant', 425, storeB, 'Panadería Sol', inStock: false));
      await tester.pumpWidget(harness(MarketProductScreen(
          api: fakeApi({
            'GET /v1/marketplace/products/$panId': (_) => json(
                listing(panId, 'Croissant', 425, storeB, 'Panadería Sol', inStock: false)),
          }),
          product: p)));
      await tester.pumpAndSettle();
      final button = tester.widget<FilledButton>(find.ancestor(
          of: find.text('Agotado'), matching: find.byType(FilledButton)));
      expect(button.onPressed, isNull);
    });
  });

  group('S-MKT-04 Carrito', () {
    testWidgets('grupos por tienda con subtotal; una línea agotada bloquea "Continuar"',
        (tester) async {
      await tester.pumpWidget(harness(CartScreen(
          api: fakeApi({
        'GET /v1/cart': (_) => json(cartBody),
        'POST /v1/orders/quote': (_) => json(quoteBody(unavailable: [panId])),
      }))));
      await tester.pumpAndSettle();
      expect(find.text('Café La Esquina'), findsOneWidget);
      expect(find.text('Panadería Sol'), findsOneWidget);
      expect(find.text(r'Subtotal $37.00'), findsOneWidget);
      expect(find.text(r'Total de productos $41.25'), findsOneWidget);
      expect(find.text('Agotado'), findsOneWidget);
      final button = tester.widget<FilledButton>(find.ancestor(
          of: find.text('Continuar'), matching: find.byType(FilledButton)));
      expect(button.onPressed, isNull);
    });

    testWidgets('cantidad 0 quita la línea y ofrece "Deshacer"', (tester) async {
      final calls = <http.Request>[];
      await tester.pumpWidget(harness(CartScreen(
          api: fakeApi({
        'GET /v1/cart': (_) => json(cartBody),
        'POST /v1/orders/quote': (_) => json(quoteBody()),
        'PUT /v1/cart/items/$panId': (_) => json(cartBody),
      }, calls: calls))));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('−').last);
      await tester.pumpAndSettle();
      expect(bodyOf(calls.lastWhere((r) => r.method == 'PUT'))['quantity_milli'], '0');
      expect(find.text('Croissant quitado del carrito.'), findsOneWidget);
      expect(find.text('Deshacer'), findsOneWidget);
    });

    testWidgets('vacío: "Tu carrito está vacío." con "Explorar tiendas"',
        (tester) async {
      await tester.pumpWidget(harness(CartScreen(
          api: fakeApi({'GET /v1/cart': (_) => json({'items': <Object>[]})}))));
      await tester.pumpAndSettle();
      expect(find.text('Tu carrito está vacío.'), findsOneWidget);
      expect(find.text('Explorar tiendas'), findsOneWidget);
    });
  });

  group('S-MKT-05 Pagar el pedido', () {
    testWidgets(
        'R5: STEP_UP_REQUIRED pide confirmación y reintenta con LA MISMA clave; luego confirma el cobro',
        (tester) async {
      final calls = <http.Request>[];
      var checkouts = 0;
      await tester.pumpWidget(harness(CheckoutScreen(
          api: fakeApi({
        'POST /v1/orders/quote': (_) => json(quoteBody()),
        'POST /v1/orders': (_) => ++checkouts == 1
            ? gatewayError(403, 'STEP_UP_REQUIRED')
            : json(orderBody('PENDING_PAYMENT', [
                subOrder(subA, storeA, 'PENDING_PAYMENT'),
              ])),
        'POST /v1/step-up/challenge': (_) => json({'challenge_id': 'ch-1'}),
        'POST /v1/step-up/verify': (_) => json({'token': 'tok-1'}),
        'POST /v1/payments/intents/$intentId/confirm': (_) =>
            json({'payment_intent_id': intentId, 'status': 'PAYMENT_STATUS_CAPTURED'}),
        'GET /v1/orders/$orderId': (_) => json(orderBody('PAID', [
              subOrder(subA, storeA, 'AWAITING_ACCEPTANCE',
                  deadline: DateTime.now().add(const Duration(minutes: 15)).toUtc().toIso8601String()),
            ])),
        'GET /v1/marketplace/storefronts/$storeA': (_) =>
            json(storefrontBody(storeA, 'Café La Esquina')),
      }, calls: calls))));
      await tester.pumpAndSettle();
      expect(find.text(r'Total a pagar'), findsOneWidget);
      expect(find.text(r'ITBMS incluido $2.42'), findsOneWidget);
      expect(find.text('Cada tienda tiene 15 minutos para aceptar tu pedido. Si una no lo acepta, te devolvemos su parte.'),
          findsOneWidget);
      await tester.tap(find.text(r'Pagar $41.25'));
      await settle(tester); // el botón gira mientras espera el diálogo
      await tester.enterText(find.byType(TextField).last, '1234');
      await tester.pump();
      await tester.tap(find.text('Confirmar'));
      await tester.pump(const Duration(milliseconds: 600));
      await settle(tester);
      final orders = calls.where((r) => r.method == 'POST' && r.url.path == '/v1/orders').toList();
      expect(orders, hasLength(2));
      String? key(http.Request r) => r.headers['Idempotency-Key'] ?? r.headers['idempotency-key'];
      expect(key(orders[0]), key(orders[1]), reason: 'el reintento retoma el mismo pedido');
      expect(orders[1].headers['X-Step-Up-Token'] ?? orders[1].headers['x-step-up-token'], 'tok-1');
      expect(calls.any((r) => r.url.path == '/v1/payments/intents/$intentId/confirm'), isTrue);
      expect(find.text('Café La Esquina'), findsOneWidget);
      expect(find.text('Esperando a la tienda'), findsOneWidget);
    });

    testWidgets('PRICE_CHANGED: muestra el total nuevo y no cobra', (tester) async {
      final calls = <http.Request>[];
      var quotes = 0;
      await tester.pumpWidget(harness(CheckoutScreen(
          api: fakeApi({
        'POST /v1/orders/quote': (_) => json(quoteBody(total: ++quotes == 1 ? 4125 : 4300)),
        'POST /v1/orders': (_) => gatewayError(409, 'PRICE_CHANGED'),
      }, calls: calls))));
      await tester.pumpAndSettle();
      await tester.tap(find.text(r'Pagar $41.25'));
      await settle(tester);
      expect(find.text(r'El total cambió de $41.25 a $43.00.'), findsOneWidget);
      await tester.tap(find.text('Aceptar nuevo total'));
      await tester.pumpAndSettle();
      expect(find.text(r'Pagar $43.00'), findsOneWidget);
      expect(calls.any((r) => r.url.path.contains('/confirm')), isFalse);
    });
  });

  group('S-MKT-06/07 Pedidos del comprador', () {
    testWidgets('lista con número, estado y total; filtro En curso / Anteriores',
        (tester) async {
      await tester.pumpWidget(harness(MarketOrdersScreen(
          api: fakeApi({
        'GET /v1/orders': (_) => json({
              'orders': [
                orderBody('PAID', [subOrder(subA, storeA, 'ACCEPTED')]),
              ]
            }),
      }))));
      await tester.pumpAndSettle();
      expect(find.text('Pedido ${orderNumber(orderId)}'), findsOneWidget);
      expect(find.text('Pagado'), findsOneWidget);
      expect(find.textContaining('octubre'), findsOneWidget, reason: 'N-STD-10: mes en texto');
      await tester.tap(find.text('Anteriores'));
      await tester.pumpAndSettle();
      expect(find.text('Aún no has hecho pedidos.'), findsOneWidget);
    });

    testWidgets('R6: código de retiro al estar listo; rechazo dice cuánto se devolvió; sin "Cancelar" tras aceptar',
        (tester) async {
      await tester.pumpWidget(harness(MarketOrderDetailScreen(
          api: fakeApi({
            'GET /v1/orders/$orderId': (_) => json(orderBody('PARTIALLY_FULFILLED', [
                  subOrder(subA, storeA, 'READY', code: '482913'),
                  subOrder(subB, storeB, 'REJECTED', reason: 'OUT_OF_STOCK', total: 425),
                ])),
            'GET /v1/marketplace/storefronts/$storeA': (_) =>
                json(storefrontBody(storeA, 'Café La Esquina')),
            'GET /v1/marketplace/storefronts/$storeB': (_) =>
                json(storefrontBody(storeB, 'Panadería Sol')),
          }),
          orderId: orderId)));
      await settle(tester);
      expect(find.text('Muestra este código al retirar: 482913'), findsOneWidget);
      expect(find.text(r'Panadería Sol no pudo aceptar tu pedido. Te devolvimos $4.25.'),
          findsOneWidget);
      expect(find.text('Cancelar pedido'), findsNothing);
    });

    testWidgets('R9: antes de aceptar se puede cancelar, con confirmación (C-05)',
        (tester) async {
      final calls = <http.Request>[];
      await tester.pumpWidget(harness(MarketOrderDetailScreen(
          api: fakeApi({
            'GET /v1/orders/$orderId': (_) => json(orderBody('PAID', [
                  subOrder(subA, storeA, 'AWAITING_ACCEPTANCE',
                      deadline: DateTime.now().add(const Duration(minutes: 10)).toUtc().toIso8601String()),
                ])),
            'POST /v1/orders/$orderId/cancel': (_) => json(orderBody('REFUNDED', [
                  subOrder(subA, storeA, 'CANCELLED'),
                ])),
          }, calls: calls),
          orderId: orderId)));
      await settle(tester);
      expect(find.textContaining('para que la tienda acepte'), findsOneWidget);
      await tester.tap(find.text('Cancelar pedido'));
      await settle(tester);
      await tester.tap(find.text('Cancelar pedido').last);
      await settle(tester);
      expect(calls.any((r) => r.url.path == '/v1/orders/$orderId/cancel'), isTrue);
      expect(find.text('Reembolsado'), findsOneWidget);
    });
  });
}
