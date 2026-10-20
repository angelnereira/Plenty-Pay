import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../observability/app_logger.dart';
import 'app_config.dart';

/// Documento de descubrimiento del gateway (ADR 0019). Dirección estable: la del túnel cambia en
/// cada reinicio del servidor y la app no puede llevarla incrustada.
const String discoveryUrl = String.fromEnvironment('PP_DISCOVERY_URL',
    defaultValue: 'https://angelnereira.github.io/Plenty-Pay/server.json');

/// Hosts que el documento puede indicar (ADR 0019 §3): un documento alterado no saca la app de
/// estos dominios.
const List<String> _allowedHostSuffixes = ['.trycloudflare.com'];
const List<String> _allowedHosts = ['plentypay.app', 'api.plentypay.app'];

/// URL de túnel rápido: efímera, nunca se guarda como URL manual (ADR 0019 §6).
bool isEphemeralTunnel(String url) =>
    Uri.tryParse(url)?.host.endsWith('.trycloudflare.com') ?? false;

bool _hostAllowed(String host) =>
    _allowedHosts.contains(host) ||
    _allowedHostSuffixes.any((s) => host.endsWith(s) && host.length > s.length);

/// Lee y valida `{"api_base_url": "https://…"}`. Devuelve null si el documento no existe, no
/// responde a tiempo o no es válido; el fallo queda registrado con su causa.
class ServerDiscovery {
  ServerDiscovery(
      {required this.flavor,
      http.Client? client,
      AppLogger? logger,
      this.url = discoveryUrl,
      this.timeout = const Duration(seconds: 4)})
      : _client = client ?? http.Client(),
        _logger = logger ?? AppLogger.disabled();

  final String flavor;
  final String url;
  final Duration timeout;
  final http.Client _client;
  final AppLogger _logger;

  Future<String?> discover() async {
    final started = DateTime.now();
    try {
      // La consulta cambia cada minuto para no leer una copia vieja de la CDN de GitHub Pages.
      final minute = started.millisecondsSinceEpoch ~/ 60000;
      final res = await _client
          .get(Uri.parse(url).replace(queryParameters: {'m': '$minute'}))
          .timeout(timeout);
      if (res.statusCode != 200) {
        _fail('http ${res.statusCode}', started);
        return null;
      }
      final body = jsonDecode(res.body);
      final candidate =
          body is Map<String, dynamic> ? body['api_base_url'] : null;
      if (candidate is! String) {
        _fail('missing api_base_url', started);
        return null;
      }
      final config = AppConfig.resolve(flavor: flavor, apiBaseUrl: candidate);
      if (!_hostAllowed(Uri.parse(config.apiBaseUrl).host)) {
        _fail('host not allowed', started);
        return null;
      }
      return config.apiBaseUrl;
    } on TimeoutException {
      _fail('timeout', started);
      return null;
    } on FormatException {
      _fail('invalid document', started);
      return null;
    } on StateError {
      // AppConfig.resolve rechaza URLs sin https fuera de dev o mal formadas.
      _fail('invalid api_base_url', started);
      return null;
    } on http.ClientException catch (e) {
      _fail(e.runtimeType.toString(), started);
      return null;
    }
  }

  void _fail(String cause, DateTime started) =>
      _logger.warn('server discovery failed', {
        'error.type': cause,
        'peer.service': 'server-discovery',
        'duration_ms': DateTime.now().difference(started).inMilliseconds,
      });
}

/// ADR 0019 §2: URL manual de desarrollo → descubierta ahora → última descubierta → la del build.
String resolveBaseUrl(
        {String? manual,
        String? discovered,
        String? lastDiscovered,
        required String built}) =>
    [manual, discovered, lastDiscovered]
        .firstWhere((u) => u != null && u.isNotEmpty, orElse: () => built)!;
