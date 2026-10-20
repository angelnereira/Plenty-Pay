import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/l10n/locales.dart';
import 'package:plentypay/features/business/access_labels.dart';
import 'package:plentypay/features/modules/module_registry.dart';
import 'package:plentypay/main.dart';

Set<String> _messageKeys(String path) {
  final arb = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
  return arb.keys.where((k) => !k.startsWith('@')).toSet();
}

Widget _app({Locale? locale}) => PlentyPayApp(
      api: ApiClient(baseUrl: 'http://localhost:8080'),
      startSignedIn: false,
      locale: locale,
    );

void main() {
  test('es_PA es el idioma por defecto e inglés está soportado', () {
    expect(appSupportedLocales.first, const Locale('es', 'PA'));
    expect(appSupportedLocales, contains(const Locale('en')));
    for (final locale in appSupportedLocales) {
      expect(AppLocalizations.delegate.isSupported(locale), isTrue, reason: '$locale');
    }
  });

  test('en traduce todas las claves de es', () {
    expect(_messageKeys('lib/core/l10n/app_en.arb'), _messageKeys('lib/core/l10n/app_es.arb'));
  });

  test('los 13 módulos tienen etiqueta en español e inglés', () async {
    for (final locale in [const Locale('es', 'PA'), const Locale('en')]) {
      final l10n = await AppLocalizations.delegate.load(locale);
      final labels = moduleRegistry.map((m) => moduleLabel(l10n, m)).toList();
      expect(labels.toSet().length, moduleRegistry.length, reason: 'etiquetas únicas en $locale');
      for (final m in moduleRegistry) {
        expect(moduleLabel(l10n, m), isNot(m.id), reason: '${m.id} sin etiqueta en $locale');
      }
    }
    final es = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    final en = await AppLocalizations.delegate.load(const Locale('en'));
    expect(es.moduleWallet, 'Billetera');
    expect(en.moduleWallet, 'Wallet');
  });

  // Cada clave del servidor (capacidades, permisos, plantillas, verticales) tiene texto propio en
  // los dos idiomas: ninguna se muestra como su id técnico.
  test('etiquetas del modelo de acceso en español e inglés', () async {
    const caps = ['pos.counter', 'appointments.queue', 'payroll.commissions', 'analytics.export'];
    const perms = ['pos:sell', 'payments:refund', 'appointments:read:self', 'admin:roles:manage'];
    for (final locale in [const Locale('es', 'PA'), const Locale('en')]) {
      final l10n = await AppLocalizations.delegate.load(locale);
      for (final c in caps) {
        expect(capabilityLabel(l10n, c), isNot(c), reason: '$c en $locale');
        expect(capabilityDescription(l10n, c), isNotEmpty, reason: '$c en $locale');
      }
      for (final p in perms) {
        expect(permissionLabel(l10n, p), isNot(p), reason: '$p en $locale');
      }
      expect(templateLabel(l10n, 'stylist'), isNot('stylist'));
      expect(verticalLabel(l10n, 'beauty_wellness'), isNot('beauty_wellness'));
      expect(levelLabel(l10n, 'APPROVE'), isNot('APPROVE'));
    }
    final es = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(es.memberBranchCount(2), '2 sucursales');
    expect(permissionLabel(es, 'pos:sell'), 'Vender');
  });

  test('plurales del inicio', () async {
    final es = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(es.homeModuleCount(1), 'Tienes acceso a 1 módulo.');
    expect(es.homeModuleCount(11), 'Tienes acceso a 11 módulos.');
  });

  testWidgets('login en es_PA', (tester) async {
    await tester.pumpWidget(_app(locale: const Locale('es', 'PA')));
    await tester.pumpAndSettle();
    expect(find.text('Inicia sesión'), findsOneWidget);
    expect(find.text('Entrar'), findsOneWidget);
    // S-GEN-03 es su propia pantalla: el login navega a ella (F02.6).
    await tester.tap(find.text('Crear una cuenta'));
    await tester.pumpAndSettle();
    expect(find.text('Crea tu cuenta'), findsOneWidget);
    expect(find.text('Usa al menos 12 caracteres.'), findsOneWidget);
    expect(find.text('Tengo 18 años o más.'), findsOneWidget);
    expect(find.text('Acepto los Términos y condiciones.'), findsOneWidget);
    expect(find.text('Quiero recibir novedades y ofertas.'), findsOneWidget);
  });

  testWidgets('login en inglés', (tester) async {
    await tester.pumpWidget(_app(locale: const Locale('en')));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsNWidgets(2)); // título y botón
    expect(find.text('Create an account'), findsOneWidget);
    expect(find.text('Inicia sesión'), findsNothing);
  });

  testWidgets('idioma del dispositivo no soportado cae a español', (tester) async {
    tester.platformDispatcher.localesTestValue = const [Locale('fr', 'FR')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Inicia sesión'), findsOneWidget);
  });
}
