import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/widgets/app_shell.dart';

const _destinations = [
  ShellDestination(label: 'Inicio', icon: Icons.home_outlined),
  ShellDestination(label: 'Billetera', icon: Icons.wallet_outlined),
  ShellDestination(label: 'Comprar', icon: Icons.storefront_outlined),
  ShellDestination(label: 'Caja', icon: Icons.point_of_sale_outlined),
  ShellDestination(label: 'Agenda', icon: Icons.event_outlined),
  ShellDestination(label: 'Productos', icon: Icons.inventory_2_outlined),
  ShellDestination(label: 'Inventario', icon: Icons.warehouse_outlined),
  ShellDestination(label: 'Finanzas', icon: Icons.account_balance_outlined),
];

Future<List<int>> _pump(WidgetTester tester, Size size,
    {int selected = 0}) async {
  final picked = <int>[];
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    home: AppShellScaffold(
      selectedIndex: selected,
      onDestinationSelected: picked.add,
      destinations: _destinations,
      moreLabel: 'Más',
      body: const SizedBox.shrink(),
    ),
  ));
  return picked;
}

void main() {
  testWidgets(
      'screen-catalog §1: en el teléfono, Inicio + 3 módulos + «Más» con el resto',
      (tester) async {
    final picked = await _pump(tester, const Size(400, 800));
    for (final l in ['Inicio', 'Billetera', 'Comprar', 'Caja', 'Más']) {
      expect(find.text(l), findsOneWidget, reason: l);
    }
    expect(find.text('Finanzas'), findsNothing);
    await tester.tap(find.text('Más'));
    await tester.pumpAndSettle();
    for (final l in ['Agenda', 'Productos', 'Inventario', 'Finanzas']) {
      expect(find.text(l), findsOneWidget,
          reason: 'ningún módulo queda sin acceso: $l');
    }
    await tester.tap(find.text('Finanzas'));
    await tester.pumpAndSettle();
    expect(picked, [7]);
  });

  testWidgets('el módulo abierto desde «Más» deja «Más» marcado en la barra',
      (tester) async {
    await _pump(tester, const Size(400, 800), selected: 6);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 4);
  });

  testWidgets('con 5 destinos o menos no hay «Más»', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      home: AppShellScaffold(
        selectedIndex: 0,
        onDestinationSelected: (_) {},
        destinations: _destinations.take(5).toList(),
        moreLabel: 'Más',
        body: const SizedBox.shrink(),
      ),
    ));
    expect(find.text('Más'), findsNothing);
    expect(find.text('Agenda'), findsOneWidget);
  });

  testWidgets('el riel se desplaza cuando no cabe (teléfono en horizontal)',
      (tester) async {
    final picked = await _pump(tester, const Size(900, 400));
    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(find.text('Finanzas'), 100,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('Finanzas'));
    expect(picked, [7]);
  });
}
