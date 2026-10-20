import 'dart:convert';

/// F22.3 · Deep links: `/t/`, `/track/`, `/invite/`, `/reset/`.
///
/// Un enlace abre **la pantalla correcta**, nunca una web suelta. El parser no
/// acepta un host ajeno: si el enlace no es de PlentyPay, devuelve
/// [DeepLinkKind.unsupported] en vez de adivinar.
///
/// Reglas de seguridad:
/// - El host se compara con la lista permitida; `evil.com/t/abc` no es un deep link.
/// - Solo `https` (o el esquema propio de la app). Un `http://` no se acepta.
/// - El código de un enlace es opaco: se pasa tal cual al servidor y **nunca** se
///   registra en claro ni se incluye en un mensaje de error.
enum DeepLinkKind { payment, tracking, invite, passwordReset, unsupported }

class DeepLink {
  const DeepLink({
    required this.kind,
    required this.rawPath,
    this.code = '',
    this.query = const {},
  });

  final DeepLinkKind kind;

  /// Ruta completa tal como llegó, sin el host. Se conserva para diagnóstico.
  final String rawPath;

  /// Código opaco (`<code>` de `/t/…`). Vacío si el enlace no lleva código.
  final String code;
  final Map<String, String> query;

  bool get isSupported => kind != DeepLinkKind.unsupported;
}

/// Hosts autorizados. El de pruebas está separado para que una app compilada para
/// desarrollo no acepte enlaces de producción por accidente.
const Set<String> allowedHosts = {'plentypay.app', 'www.plentypay.app'};

const Set<String> devAllowedHosts = {'10.0.2.2', 'localhost', '127.0.0.1'};

/// Prefijo de ruta → tipo de enlace.
const Map<String, DeepLinkKind> _routePrefixes = {
  't': DeepLinkKind.payment,
  'track': DeepLinkKind.tracking,
  'invite': DeepLinkKind.invite,
  'reset': DeepLinkKind.passwordReset,
};

/// Analiza un enlace.
///
/// Devuelve [DeepLinkKind.unsupported] cuando el host no está permitido, el esquema
/// no es seguro o la ruta no corresponde a ninguna pantalla conocida. No lanza:
/// un enlace inválido es una entrada de usuario, no un fallo de la app.
DeepLink parseDeepLink(Uri uri, {bool allowDevHosts = false}) {
  final scheme = uri.scheme.toLowerCase();

  // El esquema propio (`plentypay://t/ABC123`) deja el primer segmento en el host
  // porque el parser de URI lo toma como autoridad. Se reconstruye la ruta completa.
  final isAppScheme = scheme == 'plentypay';
  final host = isAppScheme ? 'plentypay.app' : uri.host.toLowerCase();
  final path = isAppScheme
      ? (uri.host.isEmpty ? uri.path : '/${uri.host}${uri.path}')
      : uri.path;

  final hostAllowed = allowedHosts.contains(host) ||
      (allowDevHosts && devAllowedHosts.contains(host));
  if (!hostAllowed) {
    return DeepLink(kind: DeepLinkKind.unsupported, rawPath: path);
  }

  // `https` en producción; `http` solo con los hosts de desarrollo. El esquema propio
  // de la app no viaja por la red, así que no exige TLS.
  final schemeAllowed = isAppScheme ||
      scheme == 'https' ||
      (scheme == 'http' && allowDevHosts && devAllowedHosts.contains(host));
  if (!schemeAllowed) {
    return DeepLink(kind: DeepLinkKind.unsupported, rawPath: path);
  }

  final segments =
      Uri.parse(path).pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.isEmpty) {
    return DeepLink(kind: DeepLinkKind.unsupported, rawPath: path);
  }

  final kind = _routePrefixes[segments.first.toLowerCase()];
  if (kind == null) {
    return DeepLink(kind: DeepLinkKind.unsupported, rawPath: path);
  }

  final query = <String, String>{};
  uri.queryParameters.forEach((k, v) => query[k] = v);

  return DeepLink(
    kind: kind,
    rawPath: path,
    // `/t/` sin código no abre la pantalla de cobro: se marca no soportado para que
    // la app ofrezca "buscar manualmente" en vez de una pantalla vacía.
    code: segments.length > 1 ? segments[1] : '',
    query: query,
  ).withRequiredCode();
}

extension on DeepLink {
  /// `/track/` y `/reset/` exigen código; `/invite/` también. Sin él no hay pantalla.
  DeepLink withRequiredCode() {
    if (code.isEmpty) {
      return DeepLink(
          kind: DeepLinkKind.unsupported, rawPath: rawPath, query: query);
    }
    return this;
  }
}

/// F22.4 · Actualización forzada por versión mínima.
///
/// La versión mínima llega de `GetClientConfig` (infra-management). Si la app es más
/// vieja, la pantalla de bloqueo ofrece **actualizar** y **salir**: no hay
/// "continuar", porque una app vieja puede mostrar algo que el servidor ya no acepta.
class UpdateGate {
  const UpdateGate({
    required this.currentVersion,
    required this.minimumVersion,
    this.storeUrl,
  });

  final String currentVersion;

  /// Versión mínima aceptada por el servidor. Vacía = el servidor no exige nada.
  final String minimumVersion;
  final String? storeUrl;

  bool get isForced => isOlderThan(currentVersion, minimumVersion);

  bool get isOptional =>
      minimumVersion.isNotEmpty && !isOlderThan(currentVersion, minimumVersion);
}

/// Compara versiones semánticas sin depender de un paquete externo.
/// `1.10.0` > `1.9.9`: la comparación es numérica por segmento, no lexicográfica.
bool isOlderThan(String current, String minimum) {
  if (minimum.isEmpty) return false;
  final a = _segments(current);
  final b = _segments(minimum);
  final len = a.length > b.length ? a.length : b.length;
  for (var i = 0; i < len; i++) {
    final x = i < a.length ? a[i] : 0;
    final y = i < b.length ? b[i] : 0;
    if (x != y) return x < y;
  }
  return false;
}

List<int> _segments(String version) {
  final core = version.split('+').first.split('-').first;
  return core
      .split('.')
      .map((s) => int.tryParse(s.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
      .toList();
}

/// Config de cliente que devuelve `GetClientConfig`.
class ClientConfig {
  const ClientConfig({
    required this.minimumAppVersion,
    required this.maintenanceMode,
    this.message,
  });

  factory ClientConfig.fromJson(Map<String, dynamic> json) => ClientConfig(
        minimumAppVersion: json['minimum_app_version'] as String? ?? '',
        maintenanceMode: json['maintenance_mode'] as bool? ?? false,
        message: json['message'] as String?,
      );

  final String minimumAppVersion;
  final bool maintenanceMode;

  /// Aviso en lenguaje llano del servidor. Nunca un código técnico.
  final String? message;

  String toJson() => jsonEncode({
        'minimum_app_version': minimumAppVersion,
        'maintenance_mode': maintenanceMode,
        if (message != null) 'message': message,
      });
}

/// Token de `/invite/<token>` en la ruta de [uri] (la web sirve la app desde su propio origen),
/// o null si la ruta no es una invitación.
String? inviteTokenFromPath(Uri uri) {
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.length == 2 &&
      segments[0] == 'invite' &&
      segments[1].length >= 16) {
    return segments[1];
  }
  return null;
}
