import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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
}
