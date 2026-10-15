/// Aceptaciones del registro (N-DAT-02). Espejo del mensaje `ConsentGrant` de
/// `network-contracts/proto/identity.proto`: mismas finalidades que valida `identity`
/// (docs/glossary.md §4).
class ConsentPurpose {
  ConsentPurpose._();

  /// Confirmación de mayoría de edad (N-DAT-14).
  static const ageConfirmation = 'AGE_CONFIRMATION';

  /// Términos y condiciones.
  static const terms = 'TERMS';

  /// Política de privacidad y autorización de tratamiento de datos.
  static const privacyDataProcessing = 'PRIVACY_DATA_PROCESSING';

  /// Novedades y ofertas (opcional, finalidad separada).
  static const marketing = 'MARKETING';
}

/// Una aceptación de la persona: finalidad, versión del texto que vio y si la marcó.
/// Nunca se premarca nada: el valor por omisión es `granted: false` (N-DAT-02).
class ConsentGrant {
  const ConsentGrant({required this.purpose, required this.textVersion, this.granted = false});

  final String purpose;
  final String textVersion;
  final bool granted;

  ConsentGrant copyWith({bool? granted}) =>
      ConsentGrant(purpose: purpose, textVersion: textVersion, granted: granted ?? this.granted);

  Map<String, dynamic> toJson() => {
        'purpose': purpose,
        'text_version': textVersion,
        'granted': granted,
      };
}
