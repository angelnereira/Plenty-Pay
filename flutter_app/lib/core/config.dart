/// Configuración por flavor (flutter-standards.md §15).
/// Uso: flutter run --dart-define=API_BASE_URL=http://localhost:8080 --dart-define=FLAVOR=dev
class AppConfig {
  static const String flavor = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
  static const String apiBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:8080');

  /// prod nunca habla http en claro: falla al arrancar en vez de degradar la seguridad.
  static void assertSecure() {
    if (flavor == 'prod' && !apiBaseUrl.startsWith('https://')) {
      throw StateError('API_BASE_URL debe ser https en prod');
    }
  }
}
