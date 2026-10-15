import '../../core/api/consents.dart';

/// Versiones de los textos legales que la app declara al registrar una cuenta (N-DAT-02).
///
/// La versión que se envía al servidor debe ser **la del texto que la persona vio**. Hoy la app
/// todavía no muestra esos textos (su pantalla S-PUB-03 es F25.4 y sus textos son un entregable
/// legal, Q-08), así que estos valores son la versión de los documentos que se publicarán en esa
/// fase. Cuando exista `client-config` (F05.9) la versión la enviará el servidor y esta clase se
/// reduce a leerla.
///
/// Q-27: la pantalla S-GEN-03 (F02.6) se construye sin los enlaces a `/legal/terms` y
/// `/legal/privacy` porque su destino aún no existe; ver `docs/open-questions.md`.
class LegalTexts {
  LegalTexts._();

  /// Versión de los Términos y condiciones. La confirmación de mayoría de edad (e6) se acepta
  /// sobre este mismo texto, porque el requisito de 18 años se declara allí.
  static const termsVersion = '2026-10-12';

  /// Versión de la Política de privacidad y de la autorización de tratamiento de datos.
  static const privacyVersion = '2026-10-12';

  /// Versión del texto de novedades y ofertas (mercadeo, e9).
  static const marketingVersion = '2026-10-12';
}

/// Las cuatro aceptaciones de S-GEN-03, todas sin marcar (e6–e9).
/// La lista es modificable: la pantalla reemplaza cada elemento al marcar o desmarcar una casilla.
List<ConsentGrant> initialConsents() => [
      const ConsentGrant(purpose: ConsentPurpose.ageConfirmation, textVersion: LegalTexts.termsVersion),
      const ConsentGrant(purpose: ConsentPurpose.terms, textVersion: LegalTexts.termsVersion),
      const ConsentGrant(purpose: ConsentPurpose.privacyDataProcessing, textVersion: LegalTexts.privacyVersion),
      const ConsentGrant(purpose: ConsentPurpose.marketing, textVersion: LegalTexts.marketingVersion),
    ];
