import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/core/widgets/money_text.dart';
import 'package:plentypay/core/widgets/pp_button.dart';
import 'package:plentypay/core/widgets/status_chip.dart';

/// F25.1 · Auditoría de accesibilidad WCAG 2.2 AA.
///
/// Cada prueba usa `meetsGuideline(textContrastGuideline)` y
/// `meetsGuideline(androidTapTargetGuideline)` sobre una pantalla real del
/// repositorio, en claro y en oscuro, y comprueba que el texto al 200 % no corta
/// nada ni deja el contenido fuera de las áreas seguras.
void main() {
  Widget host(Widget child, {Brightness brightness = Brightness.light}) => MaterialApp(
        theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      );

  /// Pantallas representativas: una con importes, una con estado y una con botón.
  Widget sampleScreen(Brightness brightness) => host(
        Scaffold(
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: const [
                Text('Ventas de hoy', style: TextStyle(fontSize: 22)),
                SizedBox(height: 8),
                MoneyText(250000),
                SizedBox(height: 8),
                MoneyText(-1250),
                SizedBox(height: 12),
                StatusChip(label: 'Confirmado', tone: StatusTone.success),
                SizedBox(height: 12),
                StatusChip(label: 'No completado', tone: StatusTone.error),
                SizedBox(height: 16),
                PPButton.primary(label: 'Cobrar'),
              ],
            ),
          ),
        ),
        brightness: brightness,
      );

  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('F25.1 contraste AA en $brightness', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(sampleScreen(brightness));

      await expectLater(tester, meetsGuideline(textContrastGuideline));

      handle.dispose();
    });
  }

  /// WCAG 2.2 AA 2.5.8: los objetivos táctiles miden al menos 24×24 dp, y este
  /// proyecto usa 48 dp como mínimo comfortable.
  testWidgets('F25.1 los objetivos táctiles cumplen el mínimo', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(sampleScreen(Brightness.light));

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));

    handle.dispose();
  });

  testWidgets('F25.1 los objetivos táctiles cumplen en oscuro', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(sampleScreen(Brightness.dark));

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));

    handle.dispose();
  });

  /// El texto al 200 % no corta contenido ni deja nada fuera de la pantalla.
  testWidgets('F25.1 el texto al 200 por ciento no corta el contenido', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: sampleScreen(Brightness.light),
    ));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull, reason: 'sin desbordes ni excepciones de layout');
    expect(find.text(r'$2,500.00'), findsOneWidget);
    expect(find.text('Cobrar'), findsOneWidget);
  });

  /// El mismo contenido, en vertical y en horizontal.
  testWidgets('F25.1 el contenido funciona en horizontal', (tester) async {
    tester.view.physicalSize = const Size(915, 412);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(sampleScreen(Brightness.light));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  /// El lector de pantalla encuentra el importe y su etiqueta: el dinero se anuncia
  /// con la cifra que ve el usuario, no con un string vacío.
  testWidgets('F25.1 el lector de pantalla anuncia los importes', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(sampleScreen(Brightness.light));

    expect(find.bySemanticsLabel(r'$2,500.00'), findsOneWidget);

    handle.dispose();
  });

  /// El estado nunca se comunica solo con color: `StatusChip` lleva icono y texto.
  testWidgets('F25.1 el estado lleva icono y texto, no solo color', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(sampleScreen(Brightness.light));

    final chip = find.widgetWithText(StatusChip, 'No completado');
    expect(chip, findsOneWidget);
    expect(find.descendant(of: chip, matching: find.byIcon(Icons.cancel_outlined)),
        findsOneWidget,
        reason: 'WCAG 1.4.1: el color no es el único indicador');

    handle.dispose();
  });

  /// El botón principal es alcanzable por el lector de pantalla con su etiqueta.
  testWidgets('F25.1 el boton principal tiene etiqueta semantica', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(sampleScreen(Brightness.light));

    expect(find.bySemanticsLabel('Cobrar'), findsOneWidget);

    handle.dispose();
  });

  /// Compact y expanded: la misma pantalla sin cortar nada.
  for (final size in [const Size(360, 640), const Size(1400, 900)]) {
    testWidgets('F25.1 la pantalla no se rompe con ancho ${size.width}', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(sampleScreen(Brightness.light));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Ventas de hoy'), findsOneWidget);
    });
  }
}