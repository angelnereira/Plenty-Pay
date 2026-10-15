import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;

import '../observability/app_logger.dart';
import '../session/session_store.dart';
import 'consents.dart';

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

/// Cliente HTTP principal (Dio) con sesión segura, refresh único, request-id,
/// traceparent W3C, Idempotency-Key y telemetría de observabilidad (F02.5).
class ApiClient {
  ApiClient({
    required this.baseUrl,
    Dio? dio,
    http.Client? client,
    SessionStore? session,
    AppLogger? logger,
  })  : _session = session ?? SessionStore(),
        logger = logger ?? AppLogger.disabled() {
    _dio = dio ??
        Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
          responseType: ResponseType.json,
        ));

    // Si se pasa un http.Client (p. ej. MockClient en pruebas), adaptarlo a Dio
    if (client != null) {
      _dio.httpClientAdapter = _HttpAdapter(client);
    }

    _dio.interceptors.add(_buildInterceptor());
  }

  late final Dio _dio;
  final SessionStore _session;

  /// Telemetría de la app; las pantallas la usan para registrar los fallos que capturan.
  final AppLogger logger;

  /// URL base del gateway según el flavor (AppConfig.apiBaseUrl).
  final String baseUrl;

  Future<bool>? _refreshing; // un solo refresh concurrente

  InterceptorsWrapper _buildInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final started = DateTime.now();
        options.extra['started'] = started;

        // 1. Tokens de autorización
        final skipAuth = options.extra['skipAuth'] == true;
        if (!skipAuth) {
          final token = await _session.accessToken();
          if (token != null && !options.headers.containsKey('Authorization')) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }

        // 2. X-Request-Id (UUIDv7)
        final requestId = (options.headers['X-Request-Id'] as String?) ?? newRequestId();
        options.headers['X-Request-Id'] = requestId;
        logger.lastRequestId = requestId;

        // 3. traceparent (W3C)
        final trace = TraceContext.start();
        final traceparent = (options.headers['traceparent'] as String?) ?? trace.traceparent;
        options.headers['traceparent'] = traceparent;
        logger.lastTraceId = trace.traceId;

        // 4. Idempotency-Key en mutaciones (POST, PUT, PATCH)
        final method = options.method.toUpperCase();
        final isMutation = method == 'POST' || method == 'PUT' || method == 'PATCH';
        final skipIdempotency = options.extra['skipIdempotency'] == true;
        if (isMutation && !skipIdempotency && !options.headers.containsKey('Idempotency-Key')) {
          options.headers['Idempotency-Key'] = newRequestId();
        }

        handler.next(options);
      },
      onResponse: (response, handler) {
        final req = response.requestOptions;
        logger.breadcrumb('http', '${req.method} ${req.path}', '${response.statusCode}');
        if ((response.statusCode ?? 200) >= 500) {
          final started = req.extra['started'] as DateTime? ?? DateTime.now();
          logger.warn('http request failed', {
            'http.request.method': req.method,
            'url.path': req.path,
            'http.response.status_code': response.statusCode,
            'error.type': '${response.statusCode}',
            'peer.service': 'api-gateway',
            'duration_ms': DateTime.now().difference(started).inMilliseconds,
          });
        }
        handler.next(response);
      },
      onError: (DioException err, handler) async {
        final req = err.requestOptions;
        final status = err.response?.statusCode;
        final path = req.path;

        // 401: intentar refresh único y reintentar si no era ya una petición de auth
        final isAuthEndpoint = path.contains('/v1/auth/login') || path.contains('/v1/auth/refresh');
        final isRetry = req.extra['retry'] == true;

        if (status == 401 && !isAuthEndpoint && !isRetry) {
          final refreshed = await _refreshOnce();
          if (refreshed) {
            req.extra['retry'] = true;
            final newToken = await _session.accessToken();
            if (newToken != null) {
              req.headers['Authorization'] = 'Bearer $newToken';
            }
            try {
              final response = await _dio.fetch<dynamic>(req);
              return handler.resolve(response);
            } on DioException catch (retryErr) {
              return handler.next(retryErr);
            }
          } else {
            await _session.clear();
          }
        }

        final started = req.extra['started'] as DateTime? ?? DateTime.now();
        logger.breadcrumb('http', '${req.method} $path', status != null ? '$status' : 'network error');

        if (status == null || status >= 500) {
          final errType = err.error != null ? err.error.runtimeType.toString() : err.type.toString();
          logger.warn('http request failed', {
            'http.request.method': req.method,
            'url.path': path,
            if (status != null) 'http.response.status_code': status,
            'error.type': errType,
            'exception.message': AppLogger.scrub(err.error?.toString() ?? err.message ?? ''),
            'peer.service': 'api-gateway',
            'duration_ms': DateTime.now().difference(started).inMilliseconds,
          });
        }

        handler.next(err);
      },
    );
  }

  Future<void> login(String email, String password) async {
    final body = await _post(
      '/v1/auth/login',
      data: {'email': email, 'password': password},
      skipAuth: true,
      skipIdempotency: true,
    );
    await _session.save(
      accessToken: body['access_token'] as String,
      refreshToken: body['refresh_token'] as String,
    );
  }

  /// El registro público siempre crea CUSTOMER (el gateway lo fuerza: api-gateway R2).
  /// `consents` son las aceptaciones de S-GEN-03 (N-DAT-02, N-DAT-14): cada una lleva la versión
  /// del texto que la persona vio; el canal y el dispositivo los fija el gateway.
  Future<void> registerCustomer(String fullName, String email, String password, List<ConsentGrant> consents) async {
    final body = await _post(
      '/v1/auth/register',
      data: {
        'full_name': fullName,
        'email': email,
        'password': password,
        'consents': consents.map((c) => c.toJson()).toList(),
      },
      skipAuth: true,
      skipIdempotency: true,
    );
    await _session.save(
      accessToken: body['access_token'] as String,
      refreshToken: body['refresh_token'] as String,
    );
  }

  Future<Me> me() async {
    final body = await _get('/v1/me');
    return Me(
      userId: body['user_id'] as String? ?? '',
      role: body['role'] as String? ?? '',
      tenantId: body['tenant_id'] as String? ?? '',
    );
  }

  Future<Permissions> permissions() async {
    final body = await _get('/v1/me/permissions');
    List<String> strings(Object? v) => (v as List<dynamic>? ?? const []).whereType<String>().toList();
    return Permissions(
      role: body['role'] as String? ?? '',
      modules: strings(body['enabled_modules']),
      permissions: strings(body['permissions']),
    );
  }

  Future<void> logout() => _session.clear();

  Future<bool> _refreshOnce() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _session.refreshToken();
    if (refresh == null) return false;
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/v1/auth/refresh',
        data: {'refresh_token': refresh},
        options: Options(extra: {'skipAuth': true, 'skipIdempotency': true}),
      );
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data!;
        await _session.save(
          accessToken: data['access_token'] as String,
          refreshToken: data['refresh_token'] as String,
        );
        return true;
      }
    } catch (_) {
      // Refresh falló
    }
    await _session.clear();
    return false;
  }

  Future<Map<String, dynamic>> _get(String path, {Map<String, dynamic>? queryParameters, Map<String, String>? headers}) async {
    try {
      final res = await _dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      return _extractData(res);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    Object? data,
    String? idempotencyKey,
    Map<String, String>? headers,
    bool skipAuth = false,
    bool skipIdempotency = false,
  }) async {
    try {
      final res = await _dio.post<dynamic>(
        path,
        data: data,
        options: Options(
          headers: {
            if (headers != null) ...headers,
            if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
          },
          extra: {'skipAuth': skipAuth, 'skipIdempotency': skipIdempotency},
        ),
      );
      return _extractData(res);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Map<String, dynamic> _extractData(Response<dynamic> res) {
    if (res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    if (res.data is String) {
      try {
        return jsonDecode(res.data as String) as Map<String, dynamic>;
      } catch (_) {}
    }
    return <String, dynamic>{};
  }

  ApiException _toApiException(DioException e) {
    if (e.error is http.ClientException) {
      throw e.error!;
    }
    final res = e.response;
    final status = res?.statusCode ?? 500;
    Map<String, dynamic> body = {};
    if (res?.data is Map<String, dynamic>) {
      body = res!.data as Map<String, dynamic>;
    } else if (res?.data is String) {
      try {
        body = jsonDecode(res!.data as String) as Map<String, dynamic>;
      } catch (_) {}
    }
    final reqId = body['request_id'] as String? ??
        res?.headers.value('x-request-id') ??
        e.requestOptions.headers['X-Request-Id'] as String? ??
        '';
    return ApiException(
      status,
      body['reason'] as String? ?? (e.type == DioExceptionType.connectionError ? 'CONNECTION_REFUSED' : 'UNKNOWN'),
      body['error'] as String? ?? e.message ?? '',
      requestId: reqId,
    );
  }
}

/// Adaptador para dirigir llamadas de Dio a través de http.Client (compatibilidad y pruebas con MockClient).
class _HttpAdapter implements HttpClientAdapter {
  _HttpAdapter(this._client);
  final http.Client _client;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final uri = options.uri;
    final req = http.Request(options.method, uri);

    options.headers.forEach((k, v) {
      if (v != null) req.headers[k] = v.toString();
    });

    if (options.data != null) {
      if (options.data is String) {
        req.body = options.data as String;
      } else {
        req.body = jsonEncode(options.data);
      }
      req.headers['content-type'] ??= 'application/json; charset=utf-8';
    } else if (requestStream != null) {
      final bytes = await requestStream.expand((b) => b).toList();
      req.bodyBytes = Uint8List.fromList(bytes);
    }

    final streamedResponse = await _client.send(req);
    final responseBytes = await streamedResponse.stream.toBytes();

    final responseHeaders = <String, List<String>>{};
    streamedResponse.headers.forEach((k, v) {
      responseHeaders[k] = [v];
    });

    return ResponseBody(
      Stream.value(responseBytes),
      streamedResponse.statusCode,
      headers: responseHeaders,
      statusMessage: streamedResponse.reasonPhrase,
    );
  }

  @override
  void close({bool force = false}) {
    _client.close();
  }
}
