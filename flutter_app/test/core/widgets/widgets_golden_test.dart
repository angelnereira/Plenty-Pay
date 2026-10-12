import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/core/widgets/app_shell.dart';
import 'package:plentypay/core/widgets/async_view.dart';
import 'package:plentypay/core/widgets/money_text.dart';
import 'package:plentypay/core/widgets/pp_button.dart';
import 'package:plentypay/core/widgets/pp_text_field.dart';
import 'package:plentypay/core/widgets/status_chip.dart';

/// Golden tests de design-system.md §6, en claro y oscuro.
/// Actualizar imágenes: `flutter test --update-goldens test/core/widgets`.
Future<void> _pump(WidgetTester tester, ThemeData theme, Widget child) async {
  tester.view.physicalSize = const Size(420, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: theme,
    home: Scaffold(
      body: Padding(padding: const EdgeInsets.all(16), child: child),
    ),
  ));
  // pump, no pumpAndSettle: el spinner de PPButton(loading) anima sin fin.
  await tester.pump();
}

Future<void> _pumpShell(WidgetTester tester, ThemeData theme, Size size, Widget child) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: theme,
    home: child,
  ));
  await tester.pump();
}

void _goldens(String name, Widget Function() build) {
  for (final mode in ['light', 'dark']) {
    testWidgets('$name ($mode)', (tester) async {
      final theme = mode == 'light' ? AppTheme.light() : AppTheme.dark();
      await _pump(tester, theme, build());
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/${name}_$mode.png'),
      );
    });
  }
}

void main() {
  _goldens(
    'pp_button',
    () => const Column(mainAxisSize: MainAxisSize.min, children: [
      PPButton.primary(label: 'Cobrar', onPressed: _noop),
      SizedBox(height: 12),
      PPButton.primary(label: 'Confirmando', loading: true),
      SizedBox(height: 12),
      PPButton.secondary(label: 'Cancelar', onPressed: _noop),
      SizedBox(height: 12),
      PPButton.text(label: 'Ver detalle', onPressed: _noop),
    ]),
  );

  _goldens(
    'pp_text_field',
    () => const Column(mainAxisSize: MainAxisSize.min, children: [
      PPTextField(label: 'Correo', hint: 'nombre@correo.com'),
      SizedBox(height: 16),
      PPTextField(label: 'Monto', hint: '0.00', error: 'Ingresa un monto mayor a cero'),
    ]),
  );

  _goldens(
    'money_text',
    () => const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      MoneyText(123456789, style: TextStyle(fontSize: 40, height: 48 / 40, fontWeight: FontWeight.w700)),
      SizedBox(height: 8),
      MoneyText(-1250, style: TextStyle(fontSize: 15, height: 22 / 15)),
    ]),
  );

  _goldens(
    'status_chip',
    () => const Wrap(spacing: 8, runSpacing: 8, children: [
      StatusChip(label: 'CAPTURED', tone: StatusTone.success),
      StatusChip(label: 'PENDING', tone: StatusTone.warning),
      StatusChip(label: 'Confirmando', tone: StatusTone.warning),
      StatusChip(label: 'FAILED', tone: StatusTone.error),
      StatusChip(label: 'DRAFT', tone: StatusTone.neutral),
    ]),
  );

  _goldens('async_view_loading', () => _asyncFrom(const AsyncSnapshot<List<String>>.nothing()));
  _goldens(
    'async_view_error',
    () => _asyncFrom(const AsyncSnapshot<List<String>>.withError(ConnectionState.done, 'sin red')),
  );
  _goldens(
    'async_view_empty',
    () => _asyncFrom(const AsyncSnapshot<List<String>>.withData(ConnectionState.done, [])),
  );
  _goldens(
    'async_view_data',
    () => _asyncFrom(const AsyncSnapshot<List<String>>.withData(ConnectionState.done, ['Pago 1', 'Pago 2'])),
  );

  const shellDestinations = [
    ShellDestination(label: 'Inicio', icon: Icons.home_outlined),
    ShellDestination(label: 'Billetera', icon: Icons.account_balance_wallet_outlined),
    ShellDestination(label: 'Comprar', icon: Icons.shopping_bag_outlined),
    ShellDestination(label: 'Cobrar', icon: Icons.point_of_sale_outlined),
    ShellDestination(label: 'Nómina', icon: Icons.badge_outlined),
  ];

  for (final mode in ['light', 'dark']) {
    testWidgets('app_shell_mobile ($mode)', (tester) async {
      final theme = mode == 'light' ? AppTheme.light() : AppTheme.dark();
      await _pumpShell(
        tester,
        theme,
        const Size(420, 800),
        AppShellScaffold(
          selectedIndex: 0,
          onDestinationSelected: (_) {},
          destinations: shellDestinations,
          body: const Center(child: Text('Contenido móvil')),
        ),
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_mobile_$mode.png'),
      );
    });

    testWidgets('app_shell_tablet ($mode)', (tester) async {
      final theme = mode == 'light' ? AppTheme.light() : AppTheme.dark();
      await _pumpShell(
        tester,
        theme,
        const Size(800, 600),
        AppShellScaffold(
          selectedIndex: 1,
          onDestinationSelected: (_) {},
          destinations: shellDestinations,
          body: const Center(child: Text('Contenido tablet')),
        ),
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_tablet_$mode.png'),
      );
    });

    testWidgets('app_shell_desktop ($mode)', (tester) async {
      final theme = mode == 'light' ? AppTheme.light() : AppTheme.dark();
      await _pumpShell(
        tester,
        theme,
        const Size(1200, 800),
        AppShellScaffold(
          selectedIndex: 2,
          onDestinationSelected: (_) {},
          destinations: shellDestinations,
          body: const Center(child: Text('Contenido escritorio')),
        ),
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/app_shell_desktop_$mode.png'),
      );
    });
  }
}

void _noop() {}

Widget _asyncFrom(AsyncSnapshot<List<String>> snapshot) {
  return AsyncView<List<String>>(
    snapshot: snapshot,
    errorMessage: 'No pudimos cargar tus pagos.',
    retryLabel: 'Reintentar',
    onRetry: _noop,
    isEmpty: (items) => items.isEmpty,
    emptyView: const Text('Aún no tienes pagos.'),
    builder: (context, items) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [for (final item in items) Text(item)],
    ),
  );
}
