import 'package:flutter/foundation.dart';

/// Configuración en tiempo de compilación. Se pasa con --dart-define, p. ej.:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000        (emulador Android → localhost del host)
///   flutter build ipa --dart-define=API_BASE_URL=https://api.plentypay.com
class AppConfig {
  static const _apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');

  /// Host de los enlaces de pago que van dentro de los tags NFC / QR.
  /// Debe ser un dominio TUYO con Universal Links (iOS) / App Links (Android)
  /// configurados — un tag con https:// abre la app si está instalada y, si no,
  /// una página web de respaldo. (Un esquema propio plentypay:// no abre nada
  /// en iOS al leer un tag en segundo plano.)
  static const paymentLinkHost = String.fromEnvironment('PAYMENT_LINK_HOST', defaultValue: 'pay.plentypay.com');

  /// En release se exige HTTPS: una build de producción que apunte por error a
  /// http:// falla de inmediato en vez de mandar tokens en claro.
  static String get apiBaseUrl {
    if (kReleaseMode && !_apiBaseUrl.startsWith('https://')) {
      throw StateError('API_BASE_URL debe ser https:// en builds release (recibido: $_apiBaseUrl).');
    }
    return _apiBaseUrl;
  }
}
