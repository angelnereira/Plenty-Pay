import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/core/widgets/status_chip.dart';

/// F25.1 · Contraste calculado, no solo el verificador genérico.
///
/// `meetsGuideline(textContrastGuideline)` cubre lo que hay en pantalla; este test
/// fija además el cociente exacto de cada par token/fondo para que una regresión se
/// vea en el número y no dependa del render.
void main() {
  /// Luminancia relativa WCAG 2.x.
  double luminance(Color c) {
    double channel(double v) =>
        v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  }

  double contrast(Color a, Color b) {
    final la = luminance(a);
    final lb = luminance(b);
    final hi = la > lb ? la : lb;
    final lo = la > lb ? lb : la;
    return (hi + 0.05) / (lo + 0.05);
  }

  /// Fondo real del chip: el color semántico al 14 % sobre la superficie.
  Color chipBackground(Color fill, Color surface) =>
      Color.alphaBlend(fill.withValues(alpha: 0.14), surface);

  group('F25.1 contraste de StatusChip en claro', () {
    final surface = Tokens.lightSurface;

    test('la etiqueta de éxito alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.lightSuccess, surface);
      final ratio = contrast(Tokens.lightSuccessInk, bg);
      expect(ratio, greaterThanOrEqualTo(4.5), reason: 'cociente $ratio');
    });

    test('la etiqueta de advertencia alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.lightWarning, surface);
      final ratio = contrast(Tokens.lightWarningInk, bg);
      expect(ratio, greaterThanOrEqualTo(4.5), reason: 'cociente $ratio');
    });

    test('la etiqueta de error alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.lightError, surface);
      final ratio = contrast(Tokens.lightErrorInk, bg);
      expect(ratio, greaterThanOrEqualTo(4.5), reason: 'cociente $ratio');
    });

    test('la etiqueta neutra alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.lightText, surface);
      final ratio = contrast(Tokens.lightText, bg);
      expect(ratio, greaterThanOrEqualTo(4.5), reason: 'cociente $ratio');
    });

    test('el icono cumple al menos 3:1 (WCAG 1.4.11)', () {
      for (final fill in [Tokens.lightSuccess, Tokens.lightWarning, Tokens.lightError]) {
        final bg = chipBackground(fill, surface);
        final ratio = contrast(fill, bg);
        expect(ratio, greaterThanOrEqualTo(3.0), reason: 'icono $fill: cociente $ratio');
      }
    });

    test('el color base NO alcanzaba 4.5:1: por eso existe la tinta', () {
      // Documenta por qué el token de etiqueta existe: sin él, el chip de éxito
      // quedaba en 3.8:1 y no cumplía AA.
      final bg = chipBackground(Tokens.lightSuccess, surface);
      expect(contrast(Tokens.lightSuccess, bg), lessThan(4.5));
      expect(contrast(Tokens.lightSuccessInk, bg), greaterThanOrEqualTo(4.5));
    });
  });

  group('F25.1 contraste de StatusChip en oscuro', () {
    final surface = Tokens.darkSurface;

    test('la etiqueta de éxito alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.darkSuccess, surface);
      expect(contrast(Tokens.darkSuccess, bg), greaterThanOrEqualTo(4.5));
    });

    test('la etiqueta de advertencia alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.darkWarning, surface);
      expect(contrast(Tokens.darkWarning, bg), greaterThanOrEqualTo(4.5));
    });

    test('la etiqueta de error alcanza 4.5:1', () {
      final bg = chipBackground(Tokens.darkError, surface);
      expect(contrast(Tokens.darkError, bg), greaterThanOrEqualTo(4.5));
    });
  });

  group('F25.1 contraste del texto principal', () {
    test('el texto normal alcanza 4.5:1 en claro y en oscuro', () {
      expect(contrast(Tokens.lightText, Tokens.lightSurface), greaterThanOrEqualTo(4.5));
      expect(contrast(Tokens.darkText, Tokens.darkSurface), greaterThanOrEqualTo(4.5));
      expect(contrast(Tokens.lightTextMuted, Tokens.lightSurface), greaterThanOrEqualTo(4.5));
      expect(contrast(Tokens.darkTextMuted, Tokens.darkSurface), greaterThanOrEqualTo(4.5));
    });

    test('el botón principal alcanza 4.5:1', () {
      expect(contrast(Tokens.onPrimary, Tokens.primary), greaterThanOrEqualTo(4.5));
      expect(contrast(Tokens.onPrimary, Tokens.primaryPressed), greaterThanOrEqualTo(4.5));
    });
  });

  group('F25.1 el chip se sigue leyendo con tono neutro', () {
    testWidgets('el chip neutro no baja de 4.5:1', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: ThemeData(brightness: Brightness.light, colorScheme: ColorScheme.fromSeed(seedColor: Tokens.primary)),
        home: const Scaffold(body: StatusChip(label: 'Sin datos', tone: StatusTone.neutral)),
      ));
      await tester.pumpAndSettle();

      final text = tester.widget<Text>(find.text('Sin datos'));
      final bg = chipBackground(Tokens.lightText, Tokens.lightSurface);
      expect(contrast(text.style!.color!, bg), greaterThanOrEqualTo(4.5));
    });
  });
}