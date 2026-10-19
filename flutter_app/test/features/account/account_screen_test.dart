import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/features/account/account_screen.dart';

void main() {
  testWidgets('AccountScreen renders title, profile, and preferences', (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('es', 'PA'),
      home: AccountScreen(api: ApiClient(baseUrl: 'http://localhost:8080')),
    ));
    await tester.pumpAndSettle();

    // Título y perfil
    expect(find.text('Mi cuenta'), findsOneWidget);
    expect(find.text('Dueño de Negocio'), findsOneWidget);
    expect(find.textContaining('testowner@plentypay.test'), findsOneWidget);
    expect(find.textContaining('Verificado'), findsOneWidget);

    // Preferencias de la aplicación
    expect(find.text('Preferencias de la Aplicación'), findsOneWidget);
    expect(find.text('Idioma'), findsOneWidget);
    expect(find.text('Tema visual'), findsOneWidget);
    expect(find.text('Moneda de visualización'), findsOneWidget);
    expect(find.text('Conexión al servidor'), findsOneWidget);

    // Cambiar selector de idioma a EN
    await tester.tap(find.text('EN'));
    await tester.pumpAndSettle();
    expect(find.text('English (US)'), findsOneWidget);

    // Desplazar hacia abajo para verificar secciones inferiores
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('Seguridad y Dispositivos'), findsOneWidget);
    expect(find.text('Avisos y Notificaciones'), findsOneWidget);
  });
}
