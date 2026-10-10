import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../session/session_store.dart';

/// Error del gateway: {"error": "...", "reason": "..."} (api-gateway/SPEC.md §3.11).
/// La UI traduce `reason` con ARB; nunca muestra texto técnico.
class ApiException implements Exception {
  ApiException(this.status, this.reason, this.message);
  final int status;
  final String reason;
  final String message;
  @override
  String toString() => 'ApiException($status, $reason)';
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
  ApiClient({http.Client? client, SessionStore? session})
      : _http = client ?? http.Client(),
        _session = session ?? SessionStore();

  final http.Client _http;
  final SessionStore _session;
  Future<bool>? _refreshing; // un solo refresh concurrente

  Uri _u(String path) => Uri.parse('${AppConfig.apiBaseUrl}$path');

  Future<void> login(String email, String password) async {
    final res = await _http.post(_u('/v1/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}));
    final body = _decode(res);
    await _session.save(
        accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
  }

  /// El registro público siempre crea CUSTOMER (el gateway lo fuerza: api-gateway R2).
  Future<void> registerCustomer(String fullName, String email, String password) async {
    final res = await _http.post(_u('/v1/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'full_name': fullName, 'email': email, 'password': password}));
    final body = _decode(res);
    await _session.save(
        accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
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
    var res = await _http.get(_u(path), headers: await _authHeaders());
    if (res.statusCode == 401 && await _refreshOnce()) {
      res = await _http.get(_u(path), headers: await _authHeaders());
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
    final res = await _http.post(_u('/v1/auth/refresh'),
        headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refresh_token': refresh}));
    if (res.statusCode != 200) {
      await _session.clear();
      return false;
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    await _session.save(
        accessToken: body['access_token'] as String, refreshToken: body['refresh_token'] as String);
    return true;
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } on FormatException {
      body = <String, dynamic>{};
    }
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, body['reason'] as String? ?? 'UNKNOWN', body['error'] as String? ?? '');
    }
    return body;
  }
}
