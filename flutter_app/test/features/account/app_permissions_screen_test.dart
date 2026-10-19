import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/features/account/app_permissions_screen.dart';

void main() {
  testWidgets('AppPermissionsScreen renders all permission sections and actions', (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('es', 'PA'),
      home: AppPermissionsScreen(api: ApiClient(baseUrl: 'http://localhost:8080')),
    ));
    await tester.pumpAndSettle();

    // Título principal
    expect(find.text('Permisos de la Aplicación'), findsOneWidget);

    // Permisos del hardware
    expect(find.text('Cámara del Dispositivo'), findsOneWidget);
    expect(find.text('Fotos y Galería Multimedia'), findsOneWidget);

    // Desplazar hacia abajo para ver permisos restantes y botón
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();

    expect(find.text('Notificaciones Push'), findsOneWidget);
    expect(find.text('Ubicación Geográfica'), findsOneWidget);
    expect(find.text('Abrir Ajustes del Sistema'), findsOneWidget);
  });
}
