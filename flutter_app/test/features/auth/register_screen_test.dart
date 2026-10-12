import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/api/consents.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/session/session_store.dart';
import 'package:plentypay/features/auth/legal_texts.dart';
import 'package:plentypay/features/auth/register_screen.dart';

/// Registro S-GEN-03 (F02.6): N-DAT-02 y N-DAT-14.

/// Marca la casilla `index` (e6–e9). El formulario es desplazable: hay que traerla a la vista
/// antes de tocarla o el gesto cae fuera de la pantalla.
Future<void> _checkConsent(WidgetTester tester, int index) async {
  final finder = find.byType(CheckboxListTile).at(index);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ApiClient> buildApi(MockClient client) async {
    FlutterSecureStorage.setMockInitialValues({});
    return ApiClient(
      baseUrl: 'http://localhost:8080',
      client: client,
      session: SessionStore(),
    );
  }

  Widget harness(ApiClient api, {VoidCallback? onRegistered, VoidCallback? onHaveAccount}) => MaterialApp(
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: RegisterScreen(
          api: api,
          onRegistered: onRegistered ?? () {},
          onHaveAccount: onHaveAccount ?? () {},
        ),
      );

  group('Consentimientos del registro (N-DAT-02, N-DAT-14)', () {
    test('ninguna casilla viene premarcada y cada finalidad tiene su versión', () {
      final consents = initialConsents();
      expect(consents.map((c) => c.purpose), [
        ConsentPurpose.ageConfirmation,
        ConsentPurpose.terms,
        ConsentPurpose.privacyDataProcessing,
        ConsentPurpose.marketing,
      ]);
      expect(consents.every((c) => !c.granted), isTrue, reason: 'N-DAT-02: nunca premarcadas');
      expect(consents.every((c) => c.textVersion.isNotEmpty), isTrue, reason: 'sin versión no hay trazabilidad');
      expect(consents[1].textVersion, LegalTexts.termsVersion);
      expect(consents[2].textVersion, LegalTexts.privacyVersion);
    });

    test('el JSON que viaja lleva purpose, text_version y granted', () {
      const c = ConsentGrant(purpose: ConsentPurpose.terms, textVersion: '2026-10-12', granted: true);
      expect(c.toJson(), {'purpose': 'TERMS', 'text_version': '2026-10-12', 'granted': true});
    });

    testWidgets('el botón solo se habilita con datos válidos y e6–e8 marcadas', (tester) async {
      final api = await buildApi(MockClient((req) async => http.Response('{}', 200)));
      await tester.pumpWidget(harness(api));

      final button = find.byType(FilledButton);
      expect(tester.widget<FilledButton>(button).onPressed, isNull, reason: 'sin datos no se envía');

      await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
      await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
      await tester.enterText(find.byType(TextField).at(2), 'contraseña-larga-123456');
      await tester.pump();
      expect(tester.widget<FilledButton>(button).onPressed, isNull, reason: 'faltan las casillas obligatorias');

      await _checkConsent(tester, 0);
      await _checkConsent(tester, 1);
      await _checkConsent(tester, 2);
      expect(tester.widget<FilledButton>(button).onPressed, isNotNull, reason: 'e9 (mercadeo) es opcional');
    });

    testWidgets('N-DAT-14: sin confirmar la edad el botón sigue inhabilitado', (tester) async {
      final api = await buildApi(MockClient((req) async => http.Response('{}', 200)));
      await tester.pumpWidget(harness(api));

      await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
      await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
      await tester.enterText(find.byType(TextField).at(2), 'contraseña-larga-123456');
      await _checkConsent(tester, 1);
      await _checkConsent(tester, 2);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    });

    testWidgets('una contraseña de 11 caracteres no habilita el envío', (tester) async {
      final api = await buildApi(MockClient((req) async => http.Response('{}', 200)));
      await tester.pumpWidget(harness(api));

      await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
      await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
      await tester.enterText(find.byType(TextField).at(2), 'contraseña1');
      await _checkConsent(tester, 0);
      await _checkConsent(tester, 1);
      await _checkConsent(tester, 2);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    });

    testWidgets('el registro envía las cuatro aceptaciones con su versión', (tester) async {
      String? sent;
      final api = await buildApi(MockClient((req) async {
        sent = req.body;
        return http.Response(
          '{"access_token":"a","refresh_token":"r","role":"CUSTOMER"}',
          200,
          headers: {'content-type': 'application/json'},
        );
      }));
      await tester.pumpWidget(harness(api));

      await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
      await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
      await tester.enterText(find.byType(TextField).at(2), 'contraseña-larga-123456');
      await _checkConsent(tester, 0);
      await _checkConsent(tester, 1);
      await _checkConsent(tester, 2);
      await _checkConsent(tester, 3);
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      // N-DAT-02: cada finalidad viaja con la versión del texto y su estado.
      final decoded = jsonDecode(sent!) as Map<String, dynamic>;
      expect(decoded['consents'], [
        {'purpose': 'AGE_CONFIRMATION', 'text_version': LegalTexts.termsVersion, 'granted': true},
        {'purpose': 'TERMS', 'text_version': LegalTexts.termsVersion, 'granted': true},
        {'purpose': 'PRIVACY_DATA_PROCESSING', 'text_version': LegalTexts.privacyVersion, 'granted': true},
        {'purpose': 'MARKETING', 'text_version': LegalTexts.marketingVersion, 'granted': true},
      ]);
      // El canal y el dispositivo NO viajan en el cuerpo: los fija el gateway.
      expect(decoded.containsKey('channel'), isFalse);
      expect(decoded.containsKey('device'), isFalse);
    });

    testWidgets('EMAIL_TAKEN muestra el mensaje y ofrece iniciar sesión', (tester) async {
      var haveAccount = false;
      final api = await buildApi(MockClient((req) async => http.Response(
            '{"error":"ese correo ya está registrado","reason":"EMAIL_TAKEN"}',
            400,
            headers: {'content-type': 'application/json'},
          )));
      await tester.pumpWidget(harness(api, onHaveAccount: () => haveAccount = true));

      await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
      await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
      await tester.enterText(find.byType(TextField).at(2), 'contraseña-larga-123456');
      await _checkConsent(tester, 0);
      await _checkConsent(tester, 1);
      await _checkConsent(tester, 2);
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(find.text('Ya existe una cuenta con este correo.'), findsOne);
      // El enlace "Iniciar sesión" que acompaña al error (el de abajo es el alternador fijo).
      await tester.tap(find.widgetWithText(TextButton, 'Ya tengo cuenta').first);
      await tester.pumpAndSettle();
      expect(haveAccount, isTrue);
    });

    testWidgets('AGE_REQUIREMENT y CONSENT_REQUIRED se traducen', (tester) async {
      for (final reason in ['AGE_REQUIREMENT', 'CONSENT_REQUIRED']) {
        final api = await buildApi(MockClient((req) async => http.Response(
              '{"error":"x","reason":"$reason"}',
              400,
              headers: {'content-type': 'application/json'},
            )));
        await tester.pumpWidget(harness(api));
        await tester.enterText(find.byType(TextField).at(0), 'Ana Pérez');
        await tester.enterText(find.byType(TextField).at(1), 'ana@test.co');
        await tester.enterText(find.byType(TextField).at(2), 'contraseña-larga-123456');
        await _checkConsent(tester, 0);
        await _checkConsent(tester, 1);
        await _checkConsent(tester, 2);
        await tester.tap(find.byType(FilledButton));
        await tester.pumpAndSettle();
        expect(find.byIcon(Icons.error_outline), findsOne, reason: 'reason $reason');
      }
    });
  });
}
