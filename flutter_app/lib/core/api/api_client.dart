import 'dart:convert';

import 'package:http/http.dart' as http;

import '../observability/app_logger.dart';
import '../session/session_store.dart';

/// Error del gateway: {"error": "...", "reason": "...", "request_id": "..."} (api-gateway/SPEC.md §3.11).
/// La UI traduce `reason` con ARB; nunca muestra texto técnico. `requestId` es el código de soporte
/// que el usuario puede copiar (observability-standards.md §13.4).
class ApiException implements Exception {
  ApiException(this.status, this.reason, this.message, {this.requestId = ''});
  final int status;
  final String reason;
  final String message;
  final String requestId;
  @override
  String toString() => 'ApiException($status, $reason, $requestId)';
}

class Me {
  Me({required this.userId, required this.role, required this.tenantId});
  final String userId;
  final String role;
  final String tenantId;
}

class Permissions {
  Permissions({required this.role, required this.modules, required this.permissions});
  final String role;
  final List<String> modules;
  final List<String> permissions;
  bool can(String permission) => permissions.contains(permission);
}

/// Cliente mínimo (F02). F02.5 lo migra a dio con interceptores (request-id, Idempotency-Key, reintentos).
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, SessionStore? session, AppLogger? logger})
      : _http = client ?? http.Client(),
        _session = session ?? SessionStore(),
        logger = logger ?? AppLogger.disabled();

  /// Telemetría de la app; las pantallas la usan para registrar los fallos que capturan.
  final AppLogger logger;

  /// URL base del gateway según el flavor (AppConfig.apiBaseUrl).
  final String baseUrl;
  final http.Client _http;
  final SessionStore _session;
  Future<bool>? _refreshing; // un solo refresh concurrente

  Uri _u(String path) => Uri.parse('$baseUrl$path');

  Future<void> login(String email, String password) async {
    final res = await _send('POST', '/v1/auth/login', body: {'email': email, 'password': password});
    final body = _decode(res);
    await _session.save(accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
  }

  /// El registro público siempre crea CUSTOMER (el gateway lo fuerza: api-gateway R2).
  Future<void> registerCustomer(String fullName, String email, String password) async {
    final res = await _send('POST', '/v1/auth/register', body: {'full_name': fullName, 'email': email, 'password': password});
    final body = _decode(res);
    await _session.save(accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
  }

  Future<Me> me() async {
    final body = await _authedGet('/v1/me');
    return Me(
      userId: body['user_id'] as String? ?? '',
      role: body['role'] as String? ?? '',
      tenantId: body['tenant_id'] as String? ?? '',
    );
  }

  Future<Permissions> permissions() async {
    final body = await _authedGet('/v1/me/permissions');
    List<String> strings(Object? v) => (v as List<dynamic>? ?? const []).whereType<String>().toList();
    return Permissions(
      role: body['role'] as String? ?? '',
      modules: strings(body['enabled_modules']),
      permissions: strings(body['permissions']),
    );
  }

  Future<void> logout() => _session.clear();

  Future<Map<String, dynamic>> _authedGet(String path) async {
    var res = await _send('GET', path, headers: await _authHeaders());
    if (res.statusCode == 401 && await _refreshOnce()) {
      res = await _send('GET', path, headers: await _authHeaders());
    }
    return _decode(res);
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _session.accessToken();
    return {if (token != null) 'Authorization': 'Bearer $token'};
  }

  Future<bool> _refreshOnce() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _session.refreshToken();
    if (refresh == null) return false;
    final res = await _send('POST', '/v1/auth/refresh', body: {'refresh_token': refresh});
    if (res.statusCode != 200) {
      await _session.clear();
      return false;
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    await _session.save(accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
    return true;
  }

  /// Único punto de salida HTTP. Cada petición lleva `X-Request-Id` (UUIDv7) y `traceparent` (W3C),
  /// deja una miga con método, ruta y estado, y registra como `warn` los fallos de red y los 5xx
  /// (fallo de dependencia). Nunca registra cuerpos ni cabeceras.
  Future<http.Response> _send(String method, String path, {Map<String, String> headers = const {}, Map<String, Object?>? body}) async {
    final requestId = newRequestId();
    final trace = TraceContext.start();
    logger
      ..lastRequestId = requestId
      ..lastTraceId = trace.traceId;
    final request = http.Request(method, _u(path))
      ..headers.addAll({...headers, 'X-Request-Id': requestId, 'traceparent': trace.traceparent});
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final started = DateTime.now();
    try {
      final res = await http.Response.fromStream(await _http.send(request));
      logger.breadcrumb('http', '$method $path', '${res.statusCode}');
      if (res.statusCode >= 500) {
        logger.warn('http request failed', {
          'http.request.method': method,
          'url.path': path,
          'http.response.status_code': res.statusCode,
          'error.type': '${res.statusCode}',
          'peer.service': 'api-gateway',
          'duration_ms': DateTime.now().difference(started).inMilliseconds,
        });
      }
      return res;
    } catch (e) {
      logger.breadcrumb('http', '$method $path', 'network error');
      logger.warn('http request failed', {
        'http.request.method': method,
        'url.path': path,
        'error.type': e.runtimeType.toString(),
        'exception.message': AppLogger.scrub(e.toString()),
        'peer.service': 'api-gateway',
        'duration_ms': DateTime.now().difference(started).inMilliseconds,
      });
      rethrow;
    }
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } on FormatException {
      body = <String, dynamic>{};
    }
    if (res.statusCode >= 400) {
      throw ApiException(
        res.statusCode,
        body['reason'] as String? ?? 'UNKNOWN',
        body['error'] as String? ?? '',
        requestId: body['request_id'] as String? ?? res.headers['x-request-id'] ?? '',
      );
    }
    return body;
  }
}
