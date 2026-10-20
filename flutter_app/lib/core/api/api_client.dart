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
  Permissions(
      {required this.role, required this.modules, required this.permissions});
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

  SessionStore get session => _session;

  /// Telemetría de la app; las pantallas la usan para registrar los fallos que capturan.
  final AppLogger logger;

  /// URL base del gateway según el flavor (AppConfig.apiBaseUrl).
  String baseUrl;

  void updateBaseUrl(String newUrl) {
    final normalized =
        newUrl.endsWith('/') ? newUrl.substring(0, newUrl.length - 1) : newUrl;
    baseUrl = normalized;
    _dio.options.baseUrl = normalized;
  }

  void setBaseUrl(String newUrl) => updateBaseUrl(newUrl);

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
        final requestId =
            (options.headers['X-Request-Id'] as String?) ?? newRequestId();
        options.headers['X-Request-Id'] = requestId;
        logger.lastRequestId = requestId;

        // 3. traceparent (W3C)
        final trace = TraceContext.start();
        final traceparent =
            (options.headers['traceparent'] as String?) ?? trace.traceparent;
        options.headers['traceparent'] = traceparent;
        logger.lastTraceId = trace.traceId;

        // 4. Idempotency-Key en mutaciones (POST, PUT, PATCH)
        final method = options.method.toUpperCase();
        final isMutation =
            method == 'POST' || method == 'PUT' || method == 'PATCH';
        final skipIdempotency = options.extra['skipIdempotency'] == true;
        if (isMutation &&
            !skipIdempotency &&
            !options.headers.containsKey('Idempotency-Key')) {
          options.headers['Idempotency-Key'] = newRequestId();
        }

        handler.next(options);
      },
      onResponse: (response, handler) {
        final req = response.requestOptions;
        logger.breadcrumb(
            'http', '${req.method} ${req.path}', '${response.statusCode}');
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
        final isAuthEndpoint = path.contains('/v1/auth/login') ||
            path.contains('/v1/auth/refresh');
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
        logger.breadcrumb('http', '${req.method} $path',
            status != null ? '$status' : 'network error');

        if (status == null || status >= 500) {
          final errType = err.error != null
              ? err.error.runtimeType.toString()
              : err.type.toString();
          logger.warn('http request failed', {
            'http.request.method': req.method,
            'url.path': path,
            if (status != null) 'http.response.status_code': status,
            'error.type': errType,
            'exception.message':
                AppLogger.scrub(err.error?.toString() ?? err.message ?? ''),
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

  /// El registro público crea la cuenta del usuario (api-gateway).
  /// `consents` son las aceptaciones de S-GEN-03 (N-DAT-02, N-DAT-14): cada una lleva la versión
  /// del texto que la persona vio; el canal y el dispositivo los fija el gateway.
  Future<void> registerCustomer(String fullName, String email, String password,
      List<ConsentGrant> consents) async {
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
    List<String> strings(Object? v) =>
        (v as List<dynamic>? ?? const []).whereType<String>().toList();
    return Permissions(
      role: body['role'] as String? ?? '',
      modules: strings(body['enabled_modules']),
      permissions: strings(body['permissions']),
    );
  }

  Future<void> logout() => _session.clear();
  Future<void> logoutAll() async {}

  Future<void> forgotPassword(String email) async {
    await _post('/v1/auth/password/forgot', data: {'email': email});
  }

  Future<void> resetPassword(
      {required String token, required String newPassword}) async {
    await _post('/v1/auth/password/reset',
        data: {'token': token, 'new_password': newPassword});
  }

  // ── Identidad / negocio (F08.8) ────────────────────────────────────────────

  Future<Map<String, dynamic>> createBusiness({
    required String legalName,
    required String tradeName,
    required String taxId,
    String? dv,
    String? address,
    String? phone,
    String? email,
  }) async {
    return _post('/v1/business', data: {
      'legal_name': legalName,
      'trade_name': tradeName,
      'tax_id': taxId,
      if (dv != null) 'dv': dv,
      if (address != null) 'address': address,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
    });
  }

  Future<Map<String, dynamic>> getTenant(String tenantId) async {
    return _get('/v1/business/$tenantId');
  }

  Future<Map<String, dynamic>> listUsers(String tenantId,
      {int pageSize = 50, String? pageToken}) async {
    return _get('/v1/business/staff/$tenantId', queryParameters: {
      'page_size': pageSize,
      if (pageToken != null) 'page_token': pageToken,
    });
  }

  /// Invita al equipo (identity.InviteStaffRequest). El negocio sale del token (ADR 0011) y la
  /// invitación vence a los 7 días en el servidor; [tenantId] se conserva por compatibilidad de
  /// las pantallas y no viaja. [role] es el `role_id`. Si el rol mueve dinero, identity responde
  /// `STEP_UP_REQUIRED` y se reintenta con [stepUpToken] (operación `identity.staff.invite`).
  Future<Map<String, dynamic>> inviteStaff({
    required String tenantId,
    required String email,
    required String role,
    String? fullName,
    String scope = 'TENANT',
    List<String> branchIds = const [],
    String? jobTitle,
    String? stepUpToken,
  }) async {
    return _post('/v1/business/staff',
        data: {
          'email': email,
          'role_id': role,
          if (fullName != null) 'full_name': fullName,
          'scope': scope,
          if (branchIds.isNotEmpty) 'branch_ids': branchIds,
          if (jobTitle != null) 'job_title': jobTitle,
        },
        headers: _stepUpHeaders(stepUpToken));
  }

  Future<void> deactivateUser(String userId) async {
    try {
      await _dio.delete('/v1/business/staff/$userId');
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> listRoles(String tenantId) async {
    return _get('/v1/business/roles/$tenantId');
  }

  Future<Map<String, dynamic>> upsertRole({
    required String tenantId,
    required String roleId,
    required String name,
    required List<String> permissions,
    String description = '',
    String templateKey = '',
    String? stepUpToken,
  }) async {
    // identity.UpsertRoleRequest: el rol va anidado; role_id vacío = crear. El tenant sale del
    // token. El step-up viaja en la cabecera X-Step-Up-Token (operación `identity.role.upsert`).
    return _post('/v1/business/roles',
        data: {
          'role': {
            'role_id': roleId,
            'name': name,
            'permissions': permissions,
            'description': description,
            'template_key': templateKey,
          },
        },
        headers: _stepUpHeaders(stepUpToken));
  }

  Future<void> assignRole(
      {required String userId,
      required String roleId,
      String? stepUpToken}) async {
    await _post('/v1/business/roles/$userId/assign',
        data: {
          'role_id': roleId,
        },
        headers: _stepUpHeaders(stepUpToken));
  }

  /// Cabecera de confirmación fuerte (api-gateway SPEC §3.9 → `x-pp-step-up`).
  Map<String, String>? _stepUpHeaders(String? stepUpToken) =>
      stepUpToken == null ? null : {'X-Step-Up-Token': stepUpToken};

  // ── Modelo de acceso (ADR 0018, api-gateway/SPEC.md §4.1) ─────────────────
  // El negocio y el actor salen siempre del token (ADR 0011): ninguna llamada manda tenant_id.

  /// Pide un token de confirmación fuerte para [operation] (security-standards.md §4). El reto
  /// queda atado al usuario del token; la verificación con passkey llega en F28.
  Future<String> stepUp(String operation) async {
    final challenge = await _post('/v1/step-up/challenge',
        data: {'operation': operation}, skipIdempotency: true);
    final verified = await _post('/v1/step-up/verify',
        data: {'challenge_id': challenge['challenge_id']},
        skipIdempotency: true);
    final token = verified['token'] as String? ?? '';
    if (token.isEmpty) throw ApiException(403, 'STEP_UP_INVALID', '');
    return token;
  }

  Future<Map<String, dynamic>> getAccessCatalog() => _get('/v1/access/catalog');

  Future<Map<String, dynamic>> listVerticals() => _get('/v1/verticals');

  Future<Map<String, dynamic>> listRoleTemplates() =>
      _get('/v1/role-templates');

  Future<Map<String, dynamic>> getBusinessProfile() =>
      _get('/v1/business/profile');

  Future<Map<String, dynamic>> updateBusinessProfile({
    required String primaryVertical,
    List<String> secondaryVerticals = const [],
    Map<String, bool> traitAnswers = const {},
  }) =>
      _put('/v1/business/profile', data: {
        'primary_vertical': primaryVertical,
        'secondary_verticals': secondaryVerticals,
        'trait_answers': traitAnswers,
      });

  /// Enciende o apaga capacidades (S-ADM-08). Apagar Finanzas o Equipo pide step-up
  /// (operación `identity.capabilities.set`).
  Future<Map<String, dynamic>> setCapabilities(Map<String, bool> changes,
          {String? stepUpToken}) =>
      _put(
        '/v1/business/capabilities',
        data: {
          'changes': [
            for (final e in changes.entries)
              {'capability': e.key, 'enabled': e.value}
          ],
        },
        headers: _stepUpHeaders(stepUpToken),
      );

  Future<Map<String, dynamic>> listBranches({bool includeInactive = false}) =>
      _get('/v1/business/branches',
          queryParameters: {'include_inactive': includeInactive});

  /// Crea ([branchId] vacío) o edita una sucursal. [code] son 4 dígitos DGI ("0000" = matriz).
  Future<Map<String, dynamic>> upsertBranch({
    String branchId = '',
    required String code,
    required String name,
    String address = '',
  }) =>
      _post('/v1/business/branches', data: {
        'branch': {
          'branch_id': branchId,
          'code': code,
          'name': name,
          'address': address
        },
      });

  Future<Map<String, dynamic>> setBranchActive(String branchId,
          {required bool active}) =>
      _post(
          '/v1/business/branches/$branchId/${active ? 'reactivate' : 'deactivate'}');

  Future<Map<String, dynamic>> listStaff() => _get('/v1/business/staff');

  Future<Map<String, dynamic>> listBusinessRoles() =>
      _get('/v1/business/roles');

  /// Cambia rol, alcance y cargo (vacío = no cambia; cargo "-" = borrarlo). Si suma permisos de
  /// dinero pide step-up (operación `identity.membership.update`).
  Future<Map<String, dynamic>> updateMembership({
    required String userId,
    String roleId = '',
    String scope = '',
    List<String> branchIds = const [],
    String jobTitle = '',
    String? stepUpToken,
  }) =>
      _put('/v1/business/staff/$userId/membership',
          data: {
            'role_id': roleId,
            'scope': scope,
            'branch_ids': branchIds,
            'job_title': jobTitle,
          },
          headers: _stepUpHeaders(stepUpToken));

  Future<void> setMemberSuspended(String userId,
      {required bool suspended}) async {
    await _post(
        '/v1/business/staff/$userId/${suspended ? 'suspend' : 'reactivate'}');
  }

  Future<Map<String, dynamic>> listInvitations() =>
      _get('/v1/business/invitations');

  Future<Map<String, dynamic>> resendInvitation(String invitationId) =>
      _post('/v1/business/invitations/$invitationId/resend');

  Future<void> revokeInvitation(String invitationId) =>
      _delete('/v1/business/invitations/$invitationId');

  Future<void> archiveRole(String roleId) =>
      _delete('/v1/business/roles/$roleId');

  Future<Map<String, dynamic>> listSessions(String userId) async {
    return _get('/v1/sessions', queryParameters: {'user_id': userId});
  }

  Future<void> revokeSession(String sessionId) async {
    try {
      await _dio.delete('/v1/sessions/$sessionId');
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> listTenants(
      {String? status, int pageSize = 50, String? pageToken}) async {
    return _get('/v1/platform/tenants', queryParameters: {
      if (status != null) 'status': status,
      'page_size': pageSize,
      if (pageToken != null) 'page_token': pageToken,
    });
  }

  Future<Map<String, dynamic>> reviewBusiness({
    required String tenantId,
    required bool approve,
    String? notes,
  }) async {
    return _post('/v1/platform/tenants/$tenantId/review', data: {
      'tenant_id': tenantId,
      'approve': approve,
      if (notes != null) 'notes': notes,
    });
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    String? stepUpToken,
  }) async {
    await _post('/v1/me/password', data: {
      'current_password': currentPassword,
      'new_password': newPassword,
      if (stepUpToken != null) 'step_up_token': stepUpToken,
    });
  }

  /// S-GEN-17: datos de la invitación para quien tiene el enlace (sin sesión).
  Future<Map<String, dynamic>> previewInvitation(String token) =>
      _post('/v1/invitations/preview',
          data: {'invitation_token': token},
          skipAuth: true,
          skipIdempotency: true);

  /// Canjea la invitación (identity.AcceptInvitationRequest). Quien ya tiene cuenta manda su
  /// contraseña actual; una cuenta nueva manda además su nombre y las aceptaciones de S-GEN-03
  /// (R18, N-DAT-02, N-DAT-14). El correo ya está en la invitación.
  Future<Map<String, dynamic>> acceptInvitation({
    required String token,
    required String password,
    String fullName = '',
    List<ConsentGrant> consents = const [],
  }) async {
    final body = await _post('/v1/invitations/accept',
        data: {
          'invitation_token': token,
          'password': password,
          if (fullName.isNotEmpty) 'full_name': fullName,
          if (consents.isNotEmpty)
            'consents': consents.map((c) => c.toJson()).toList(),
        },
        skipAuth: true,
        skipIdempotency: false);
    if (body['success'] == false) {
      throw ApiException(400, body['reason'] as String? ?? 'UNKNOWN',
          body['error_message'] as String? ?? '');
    }
    if (body['access_token'] != null) {
      await _session.save(
        accessToken: body['access_token'] as String,
        refreshToken: body['refresh_token'] as String,
      );
    }
    return body;
  }

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

  Future<Map<String, dynamic>> _get(String path,
      {Map<String, dynamic>? queryParameters,
      Map<String, String>? headers}) async {
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

  Future<Map<String, dynamic>> _put(String path,
      {Object? data, Map<String, String>? headers}) async {
    try {
      final res = await _dio.put<dynamic>(path,
          data: data, options: Options(headers: headers));
      return _extractData(res);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<void> _delete(String path) async {
    try {
      await _dio.delete<dynamic>(path);
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
      body['reason'] as String? ??
          (e.type == DioExceptionType.connectionError
              ? 'CONNECTION_REFUSED'
              : 'UNKNOWN'),
      body['error'] as String? ?? e.message ?? '',
      requestId: reqId,
    );
  }

  /// Sube un archivo de imagen al almacenamiento de objetos (Garage) y devuelve la URL del medio.
  Future<String> uploadMedia(
      {required Uint8List bytes,
      required String filename,
      String mimeType = 'image/jpeg'}) async {
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '/v1/media/upload',
        data: formData,
        options: Options(
          headers: {'Content-Type': 'multipart/form-data'},
          extra: {'skipIdempotency': true},
        ),
      );
      final url = res.data?['url'] as String?;
      if (url == null || url.isEmpty) {
        throw ApiException(
            500, 'STORAGE_ERROR', 'No se recibió la URL del objeto');
      }
      return url;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
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
