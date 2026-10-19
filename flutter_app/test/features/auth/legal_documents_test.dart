import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/auth/legal_documents_screen.dart';
import 'package:plentypay/features/auth/legal_texts.dart';

/// F25.4 · Textos legales, privacidad y consentimientos (S-PUB-03).
///
/// Q-08 sigue abierto: el contenido es un entregable legal. La app **no lo redacta**;
/// consume el que envía el servidor con su versión, y muestra un estado claro
/// mientras no exista.
void main() {
  LegalDocuments fixture() => LegalDocuments.fromJson({
        'terms': {
          'slug': 'terms',
          'title': 'Términos y condiciones',
          'version': '2026-10-12',
          'published_at': '2026-10-12T00:00:00Z',
          'body': 'Uso PlentyPay implica aceptar estos términos.',
        },
        'privacy': {
          'slug': 'privacy',
          'title': 'Política de privacidad',
          'version': '2026-10-12',
          'published_at': '2026-10-12T00:00:00Z',
          'body': 'Tratamos tus datos según la Ley 81 y esta política.',
        },
        'marketing': {
          'slug': 'marketing',
          'title': 'Novedades y ofertas',
          'version': '2026-10-12',
          'published_at': '2026-10-12T00:00:00Z',
          'body': 'Autorizas recibir novedades y ofertas.',
        },
      });

  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      );

  test('los tres textos llegan del servidor con su versión', () {
    final docs = fixture();
    expect(docs.terms.version, '2026-10-12');
    expect(docs.privacy.version, '2026-10-12');
    expect(docs.marketing.version, '2026-10-12');
    expect(docs.bySlug('terms')?.title, 'Términos y condiciones');
    expect(docs.bySlug('privacy')?.title, 'Política de privacidad');
    expect(docs.bySlug('marketing')?.title, 'Novedades y ofertas');
  });

  test('un slug desconocido no adivina un documento', () {
    expect(fixture().bySlug('inventado'), isNull);
  });

  test('round trip de serialización conserva la versión', () {
    final docs = fixture();
    final back = LegalDocuments.fromJson(docs.toJson());
    expect(back.terms.version, docs.terms.version);
    expect(back.terms.body, docs.terms.body);
    expect(back.marketing.publishedAt.isUtc, isTrue);
  });

  // La versión que la app declara al registrar debe ser la del texto que se muestra.
  test('la versión del texto y la del consentimiento coinciden', () {
    final docs = fixture();
    expect(docs.terms.version, LegalTexts.termsVersion,
        reason: 'N-DAT-02: el consentimiento registra la versión del texto que el usuario vio');
    expect(docs.privacy.version, LegalTexts.privacyVersion);
    expect(docs.marketing.version, LegalTexts.marketingVersion);
  });

  testWidgets('S-PUB-03 muestra el texto con su versión y fecha', (tester) async {
    await tester.pumpWidget(host(LegalDocumentScreen(
      load: LegalLoaded(fixture()),
      slug: 'terms',
    )));
    await tester.pumpAndSettle();

    expect(find.text('Términos y condiciones'), findsOneWidget);
    expect(find.text('Uso PlentyPay implica aceptar estos términos.'), findsOneWidget);
    // Versión y fecha con el mes en texto (N-STD-10).
    expect(find.textContaining('2026-10-12'), findsOneWidget);
    expect(find.textContaining('octubre'), findsOneWidget);
  });

  testWidgets('S-PUB-03 ofrece Aceptar solo cuando hay un texto', (tester) async {
    await tester.pumpWidget(host(LegalDocumentScreen(
      load: LegalLoaded(fixture()),
      slug: 'terms',
    )));
    await tester.pumpAndSettle();
    expect(find.text('Aceptar'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  testWidgets('S-PUB-03 un slug desconocido no ofrece aceptar', (tester) async {
    await tester.pumpWidget(host(LegalDocumentScreen(
      load: LegalLoaded(fixture()),
      slug: 'inventado',
    )));
    await tester.pumpAndSettle();
    expect(find.byType(FilledButton), findsNothing,
        reason: 'no hay texto que aceptar');
  });

  // Q-08: sin texto publicado, la app lo dice y no inventa nada.
  testWidgets('S-PUB-03 sin texto publicado lo dice y no inventa', (tester) async {
    const cases = {
      'not_configured': 'todavía no está publicado',
      'fetch_failed': 'No pudimos cargar el texto',
      'otro_motivo': 'no está disponible',
    };
    for (final entry in cases.entries) {
      await tester.pumpWidget(host(LegalDocumentScreen(
        load: LegalUnavailable(entry.key),
        slug: 'terms',
      )));
      await tester.pumpAndSettle();

      expect(find.textContaining(entry.value), findsOneWidget, reason: entry.key);
      expect(find.byType(FilledButton), findsNothing, reason: entry.key);
    }
  });

  // El aviso al usuario nunca es un código técnico ni una excepción.
  testWidgets('S-PUB-03 el aviso no muestra códigos técnicos', (tester) async {
    await tester.pumpWidget(host(const LegalDocumentScreen(
      load: LegalUnavailable('HTTP_500_INTERNAL'),
      slug: 'terms',
    )));
    await tester.pumpAndSettle();

    expect(find.textContaining('HTTP_500'), findsNothing);
    expect(find.textContaining('no está disponible'), findsOneWidget);
  });

  testWidgets('S-PUB-03 el texto al 200 por ciento no se corta', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: host(LegalDocumentScreen(load: LegalLoaded(fixture()), slug: 'privacy')),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  test('la fecha del documento lleva el mes en texto', () {
    final text = ReceiptDateFormat.format(DateTime(2026, 10, 12));
    expect(text, '12 de octubre de 2026');
    expect(ReceiptDateFormat.format(DateTime(2026, 1, 1)), '1 de enero de 2026');
  });
}