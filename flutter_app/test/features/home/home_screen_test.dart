import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/session/session_store.dart';
import 'package:plentypay/features/home/home_screen.dart';
import 'package:plentypay/features/modules/module_registry.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ApiClient> buildApi() async {
    FlutterSecureStorage.setMockInitialValues({});
    return ApiClient(
      baseUrl: 'http://localhost:8080',
      client: MockClient((_) async => throw UnimplementedError()),
      session: SessionStore(),
    );
  }

  Widget harness(
    ApiClient api, {
    required List<ModuleDef> modules,
    required void Function(ModuleDef) onSelectModule,
    VoidCallback? onSignOut,
  }) =>
      MaterialApp(
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: HomeScreen(
          api: api,
          modules: modules,
          onSelectModule: onSelectModule,
          onSignOut: onSignOut ?? () {},
        ),
      );

  testWidgets('HomeScreen muestra saludo, billetera y modulos clickeables', (tester) async {
    final api = await buildApi();
    ModuleDef? selected;

    await tester.pumpWidget(harness(
      api,
      modules: moduleRegistry,
      onSelectModule: (m) => selected = m,
    ));
    await tester.pumpAndSettle();

    // Saludo y estado
    expect(find.text('¡Hola de nuevo!'), findsOneWidget);
    expect(find.textContaining('Comercio Activo'), findsOneWidget);

    // Billetera y saldo
    expect(find.text('Billetera'), findsWidgets);
    expect(find.textContaining(r'B/.2,450.00'), findsOneWidget);

    // Ventas de hoy
    expect(find.text('Ventas de Hoy'), findsOneWidget);
    expect(find.textContaining('18 ventas realizadas'), findsOneWidget);

    // Desplazar hacia abajo para ver los módulos del sistema
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();

    final posFinder = find.text('Caja');
    expect(posFinder, findsWidgets);

    // Tocar el módulo de Caja
    await tester.tap(posFinder.first);
    await tester.pumpAndSettle();

    expect(selected, isNotNull);
    expect(selected!.id, 'pos');
  });

  testWidgets('HomeScreen oculta y muestra el saldo al tocar el icono de ojo', (tester) async {
    final api = await buildApi();

    await tester.pumpWidget(harness(
      api,
      modules: moduleRegistry,
      onSelectModule: (_) {},
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining(r'B/.2,450.00'), findsOneWidget);

    // Ocultar saldo
    final eyeIcon = find.byTooltip('Ocultar saldo');
    expect(eyeIcon, findsOneWidget);
    await tester.tap(eyeIcon);
    await tester.pumpAndSettle();

    expect(find.text('••••••••'), findsOneWidget);
    expect(find.textContaining(r'B/.2,450.00'), findsNothing);

    // Volver a mostrar saldo
    final showIcon = find.byTooltip('Mostrar saldo');
    expect(showIcon, findsOneWidget);
    await tester.tap(showIcon);
    await tester.pumpAndSettle();

    expect(find.textContaining(r'B/.2,450.00'), findsOneWidget);
  });
}
