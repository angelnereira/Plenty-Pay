import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/session/session_store.dart';
import 'package:plentypay/features/pos/pos_screen.dart';

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

  Widget harness(ApiClient api) => MaterialApp(
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: PosScreen(api: api),
      );

  testWidgets('PosScreen muestra lineas con steppers y actualiza totales', (tester) async {
    final api = await buildApi();

    await tester.pumpWidget(harness(api));
    await tester.pumpAndSettle();

    // Líneas iniciales: Café Geisha (1 un = 18.50) y Croissant (2 un = 8.50). Subtotal = 27.00. Tax = 1.89. Total = 28.89.
    expect(find.text('Café Geisha Especial 250g'), findsOneWidget);
    expect(find.text('Croissant de Almendras'), findsOneWidget);

    // Controles de cantidad: buscar botón de aumentar en la primera línea
    final addButtons = find.byTooltip('Aumentar');
    expect(addButtons, findsNWidgets(2));

    // Aumentar Café Geisha de 1 a 2
    await tester.tap(addButtons.first);
    await tester.pumpAndSettle();

    // Nueva cantidad de Café Geisha = 2 (2 x 18.50 = 37.00). Croissant = 8.50. Subtotal = 45.50. Tax = 3.18. Total = 48.68.
    expect(find.textContaining('B/.48.68'), findsWidgets);

    // Reducir Croissant de 2 a 1
    final removeButtons = find.byTooltip('Reducir');
    await tester.tap(removeButtons.last);
    await tester.pumpAndSettle();

    // Nueva cantidad Croissant = 1 (4.25). Total = 37.00 + 4.25 = 41.25. Tax = 2.88. Total = 44.13.
    expect(find.textContaining('B/.44.13'), findsWidgets);
  });

  testWidgets('PosScreen permite cambiar cliente a nombre y RUC', (tester) async {
    final api = await buildApi();

    await tester.pumpWidget(harness(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('Consumidor Final'), findsOneWidget);

    // Tocar barra de cliente para editar
    await tester.tap(find.text('Cambiar'));
    await tester.pumpAndSettle();

    // Escribir nombre y RUC
    await tester.enterText(find.byType(TextField).first, 'Restaurante El Valle');
    await tester.enterText(find.byType(TextField).last, '155678-1-2022 DV 44');
    await tester.pumpAndSettle();

    // Guardar
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Restaurante El Valle'), findsOneWidget);
  });
}
