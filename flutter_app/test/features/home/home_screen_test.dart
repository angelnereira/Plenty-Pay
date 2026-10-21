import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/features/home/home_screen.dart';
import 'package:plentypay/features/modules/module_registry.dart';
import 'package:plentypay/features/wallet/wallet_data.dart';

import '../../support/fake_gateway.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(() => hideWalletBalance.value = false);

  Widget home(Map<String, FakeRoute> routes) => harness(HomeScreen(
        api: fakeApi(routes),
        modules: moduleRegistry,
        onSelectModule: (_) {},
        onSignOut: () {},
      ));

  final me = {
    'GET /v1/me': (_) =>
        json({'user_id': 'u-1', 'role': 'CUSTOMER', 'tenant_id': ''})
  };

  testWidgets(
      'S-GEN-05 e4: el saldo de la tarjeta es el del ledger, no un valor fijo',
      (tester) async {
    await tester.pumpWidget(
        home({...me, 'GET /v1/wallet/balance': (_) => json(balance(12345))}));
    await tester.pumpAndSettle();

    expect(find.text('Hola'), findsOneWidget);
    expect(find.text(r'$123.45'), findsOneWidget);
    expect(find.textContaining('2,450'), findsNothing);
    expect(find.textContaining('ventas'), findsNothing);
    expect(find.text('Registrar mi negocio'), findsOneWidget);
  });

  testWidgets('S-GEN-05 e4: el ojo oculta y muestra el saldo', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
        home({...me, 'GET /v1/wallet/balance': (_) => json(balance(5000))}));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Ocultar saldo'));
    await tester.pumpAndSettle();
    expect(find.text(r'$50.00'), findsNothing);
    expect(find.bySemanticsLabel(RegExp('Saldo oculto')), findsOneWidget);

    await tester.tap(find.byTooltip('Mostrar saldo'));
    await tester.pumpAndSettle();
    expect(find.text(r'$50.00'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets(
      'AGENTS §3.1: sin ledger desplegado se dice, no se inventa un saldo',
      (tester) async {
    await tester.pumpWidget(home({
      ...me,
      'GET /v1/wallet/balance': (_) => gatewayError(503, 'SERVICE_UNAVAILABLE')
    }));
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Tu billetera todavía no está disponible. Intenta de nuevo más tarde.'),
        findsOneWidget);
    expect(find.textContaining(r'$'), findsNothing);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('quien ya tiene negocio no ve "Registrar mi negocio"',
      (tester) async {
    await tester.pumpWidget(home({
      'GET /v1/me': (_) =>
          json({'user_id': 'u-1', 'role': 'OWNER', 'tenant_id': 't-1'}),
      'GET /v1/wallet/balance': (_) => json(balance(0)),
    }));
    await tester.pumpAndSettle();
    expect(find.text('Registrar mi negocio'), findsNothing);
  });

  group('S-GEN-05 tarjetas del negocio', () {
    final now = DateTime.utc(2026, 10, 21, 15); // 10:00 en Panamá
    Map<String, Object> money(int v) =>
        {'amount_minor': '$v', 'currency': 'USD'};
    Map<String, FakeRoute> owner({String status = 'TENANT_STATUS_ACTIVE'}) => {
          'GET /v1/me': (_) => json({
                'user_id': 'u-1',
                'role': 'BUSINESS_OWNER',
                'tenant_id': 't-1',
                'full_name': 'Ana María Pérez'
              }),
          'GET /v1/me/permissions': (_) => json({
                'role': 'BUSINESS_OWNER',
                'enabled_modules': [
                  'wallet',
                  'pos',
                  'inventory',
                  'orders',
                  'finance',
                  'admin'
                ],
                'permissions': [
                  'pos:sell',
                  'orders:read',
                  'inventory:read',
                  'fiscal:read',
                  'fiscal:profile:manage'
                ]
              }),
          'GET /v1/business/t-1': (_) =>
              json({'tenant_id': 't-1', 'status': status}),
          'GET /v1/wallet/balance': (_) => json(balance(0)),
          'GET /v1/fiscal/profile': (_) => gatewayError(409, 'PROFILE_MISSING'),
          'GET /v1/fiscal/folios': (_) => gatewayError(409, 'PROFILE_MISSING'),
          'GET /v1/pos/sales': (http.Request r) => json({
                'sales': [
                  {
                    'sale_id': 's1',
                    'status': 'SALE_STATUS_PAID',
                    'total': money(1700)
                  },
                  {
                    'sale_id': 's2',
                    'status': 'SALE_STATUS_PAID',
                    'total': money(1000)
                  },
                ],
                'page': {'next_page_token': ''}
              }),
          'GET /v1/merchant/orders': (_) => json({
                'sub_orders': [
                  {
                    'sub_order_id': 'o1',
                    'acceptance_deadline': '2026-10-21T15:05:00Z'
                  },
                  {
                    'sub_order_id': 'o2',
                    'acceptance_deadline': '2026-10-21T15:12:00Z'
                  },
                ]
              }),
          'GET /v1/inventory/stock': (_) => json({
                'levels': [
                  {'product_id': 'p1'},
                  {'product_id': 'p2'},
                  {'product_id': 'p3'}
                ]
              }),
        };

    Widget ownerHome(Map<String, FakeRoute> routes,
            {List<http.Request>? calls}) =>
        harness(HomeScreen(
          api: fakeApi(routes, calls: calls),
          modules: moduleRegistry,
          onSelectModule: (_) {},
          onSignOut: () {},
          now: () => now,
        ));

    testWidgets('e1, e3, e5, e6 y e8 con datos reales del negocio',
        (tester) async {
      tester.view.physicalSize = const Size(420, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final calls = <http.Request>[];
      await tester.pumpWidget(ownerHome(owner(), calls: calls));
      await tester.pumpAndSettle();

      expect(find.text('Hola, Ana'), findsOneWidget);
      expect(find.text('Completa tu perfil fiscal'), findsOneWidget);
      expect(find.text('Ventas de hoy'), findsOneWidget);
      expect(find.text(r'$27.00'), findsOneWidget);
      expect(find.text('2 ventas'), findsOneWidget);
      expect(find.text('Pedidos por aceptar'), findsOneWidget);
      expect(find.text('2 pedidos'), findsOneWidget);
      expect(find.text('vence en 05:00'), findsOneWidget,
          reason: 'el plazo más cercano');
      expect(find.text('1 alerta'), findsOneWidget);
      expect(find.text('3 productos con existencias bajas'), findsOneWidget);

      final sales = calls.firstWhere((r) => r.url.path == '/v1/pos/sales');
      expect(sales.url.queryParameters['status'], 'SALE_STATUS_PAID');
      expect(sales.url.queryParameters['from'], '2026-10-21T05:00:00.000Z',
          reason: 'el día empieza a medianoche en Panamá (UTC−5)');
    });

    testWidgets('e3: el negocio en revisión manda sobre el perfil fiscal',
        (tester) async {
      await tester
          .pumpWidget(ownerHome(owner(status: 'TENANT_STATUS_PENDING_REVIEW')));
      await tester.pumpAndSettle();
      expect(find.text('Tu negocio está en revisión'), findsOneWidget);
      expect(find.text('Completa tu perfil fiscal'), findsNothing);
    });

    testWidgets(
        'AGENTS §2.14: si un servicio falla, su tarjeta no aparece y las demás sí',
        (tester) async {
      tester.view.physicalSize = const Size(420, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ownerHome({
        ...owner(),
        'GET /v1/pos/sales': (_) => gatewayError(503, 'SERVICE_UNAVAILABLE'),
      }));
      await tester.pumpAndSettle();
      expect(find.text('Ventas de hoy'), findsNothing);
      expect(find.text('Pedidos por aceptar'), findsOneWidget);
      expect(find.textContaining('existencias bajas'), findsOneWidget);
    });

    testWidgets('sin pedidos esperando no se muestra la tarjeta e6',
        (tester) async {
      await tester.pumpWidget(ownerHome({
        ...owner(),
        'GET /v1/merchant/orders': (_) => json({'sub_orders': []}),
      }));
      await tester.pumpAndSettle();
      expect(find.text('Pedidos por aceptar'), findsNothing);
    });
  });
}
