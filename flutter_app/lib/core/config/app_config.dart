/// Configuración por flavor (flutter-standards.md §15). Los flavors se eligen con dart-define:
///   flutter run --dart-define=FLAVOR=dev --dart-define=API_BASE_URL=http://localhost:8080
enum Flavor {
  dev,
  staging,
  prod;

  /// Solo dev puede hablar http en claro (con el gateway local).
  bool get requiresHttps => this != Flavor.dev;

  static Flavor parse(String value) => switch (value) {
        'dev' => Flavor.dev,
        'staging' => Flavor.staging,
        'prod' => Flavor.prod,
        _ => throw StateError(
            'FLAVOR desconocido: "$value" (usa dev, staging o prod)'),
      };
}

class AppConfig {
  const AppConfig._({required this.flavor, required this.apiBaseUrl});

  /// Valida la combinación flavor/URL. staging y prod nunca hablan http en claro:
  /// la app falla al arrancar en vez de degradar la seguridad.
  factory AppConfig.resolve(
      {required String flavor, required String apiBaseUrl}) {
    final parsed = Flavor.parse(flavor);
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null ||
        uri.host.isEmpty ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw StateError('API_BASE_URL inválida: "$apiBaseUrl"');
    }
    final isLocal = uri.host == 'localhost' ||
        uri.host == '127.0.0.1' ||
        uri.host == '10.0.2.2' ||
        uri.host.startsWith('192.168.') ||
        uri.host.startsWith('10.') ||
        uri.host.startsWith('172.');
    if (parsed.requiresHttps && uri.scheme != 'https' && !isLocal) {
      throw StateError('API_BASE_URL debe ser https en ${parsed.name}');
    }
    final normalized = apiBaseUrl.endsWith('/')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
        : apiBaseUrl;
    return AppConfig._(flavor: parsed, apiBaseUrl: normalized);
  }

  /// Lee los dart-define del build. La URL del build es solo el último respaldo (ADR 0019 §2 y
  /// §7): la vigente la da el descubrimiento. `build-release.sh` inyecta la del túnel al compilar;
  /// sin define (desarrollo) es el gateway local, nunca una URL de túnel incrustada que caduca.
  factory AppConfig.fromEnvironment() => AppConfig.resolve(
        flavor: const String.fromEnvironment('FLAVOR', defaultValue: 'dev'),
        apiBaseUrl: const String.fromEnvironment('API_BASE_URL',
            defaultValue: 'http://localhost:8080'),
      );

  final Flavor flavor;
  final String apiBaseUrl;
}
