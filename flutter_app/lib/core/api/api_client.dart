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

/// Reto de confirmación fuerte (identity.PasskeyChallenge, S-GEN-21).
class StepUpChallenge {
  StepUpChallenge({
    required this.id,
    required this.operation,
    required this.amountMinor,
    required this.currency,
    required this.level,
    required this.allowedMethods,
    required this.availableMethods,
  });

  factory StepUpChallenge.fromJson(Map<String, dynamic> j) {
    List<String> methods(Object? v) =>
        (v as List<dynamic>? ?? const []).map((e) => '$e').toList();
    return StepUpChallenge(
      id: j['challenge_id'] as String? ?? '',
      operation: j['operation'] as String? ?? '',
      amountMinor: int.tryParse('${j['amount_minor'] ?? 0}') ?? 0,
      currency: j['currency'] as String? ?? '',
      level: (j['level'] as num?)?.toInt() ?? 2,
      allowedMethods: methods(j['allowed_methods']),
      availableMethods: methods(j['available_methods']),
    );
  }

  final String id;
  final String operation;
  final int amountMinor;
  final String currency;
  final int level;
  final List<String> allowedMethods;
  final List<String> availableMethods;
}

/// Estado del PIN de confirmación (identity.StepUpPinStatus).
class StepUpPinStatus {
  StepUpPinStatus(
      {required this.isSet, required this.attemptsRemaining, this.lockedUntil});

  factory StepUpPinStatus.fromJson(Map<String, dynamic> j) {
    final locked = j['locked_until'] as String?;
    return StepUpPinStatus(
      isSet: j['is_set'] == true,
      attemptsRemaining: (j['attempts_remaining'] as num?)?.toInt() ?? 0,
      lockedUntil:
          locked == null || locked.isEmpty ? null : DateTime.tryParse(locked),
    );
  }

  final bool isSet;
  final int attemptsRemaining;
  final DateTime? lockedUntil;
}

class Me {
  Me(
      {required this.userId,
      required this.role,
      required this.tenantId,
      this.fullName = ''});
  final String userId;
  final String role;
  final String tenantId;

  /// Nombre de la persona (saludo de Inicio, S-GEN-05 e1).
  final String fullName;
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
    this.rediscover,
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

  /// ADR 0019 §4: devuelve la URL vigente del gateway (descubrimiento). Si el túnel deja de
  /// responder, el cliente la consulta como máximo una vez cada [_rediscoverEvery].
  final Future<String?> Function()? rediscover;
  static const _rediscoverEvery = Duration(seconds: 30);
  DateTime? _lastRediscovery;
  Future<bool>? _rediscovering;

  /// Sin respuesta del gateway: error de red, o 502/530 del túnel (1033 es el cuerpo de 530).
  static bool _unreachable(DioException err) {
    final status = err.response?.statusCode;
    if (status == 502 || status == 530) return true;
    return status == null &&
        (err.type == DioExceptionType.connectionError ||
            err.type == DioExceptionType.connectionTimeout);
  }

  /// true si la URL cambió (vale la pena reintentar en la nueva).
  Future<bool> _rediscoverOnce() {
    final fn = rediscover;
    if (fn == null) return Future.value(false);
    final pending = _rediscovering;
    if (pending != null) return pending;
    final last = _lastRediscovery;
    if (last != null && DateTime.now().difference(last) < _rediscoverEvery) {
      return Future.value(false);
    }
    _lastRediscovery = DateTime.now();
    final previous = baseUrl;
    final run = fn().then((url) {
      if (url == null || url == previous) return false;
      updateBaseUrl(url);
      logger.info(
          'gateway url rediscovered', {'url.domain': Uri.parse(url).host});
      return true;
    }).whenComplete(() => _rediscovering = null);
    return _rediscovering = run;
  }

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

        // ADR 0019 §4: el túnel cambió de URL. Reintentar es seguro: las mutaciones llevan
        // Idempotency-Key, que se conserva en la petición reintentada.
        if (_unreachable(err) && req.extra['rediscovered'] != true) {
          final failedBase = req.baseUrl;
          if (await _rediscoverOnce() || baseUrl != failedBase) {
            req.extra['rediscovered'] = true;
            req.baseUrl = baseUrl;
            try {
              final response = await _dio.fetch<dynamic>(req);
              return handler.resolve(response);
            } on DioException catch (retryErr) {
              return handler.next(retryErr);
            }
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

  /// S-WAL-01 e1/e2: saldo de la billetera de la persona del token (ledger.GetBalance vía gateway).
  Future<Map<String, dynamic>> walletBalance({String currency = 'USD'}) =>
      _get('/v1/wallet/balance', queryParameters: {'currency': currency});

  /// S-WAL-01 e5: movimientos de la billetera en `[from, to)` (ledger.GetStatement, ≤ 366 días).
  Future<Map<String, dynamic>> walletStatement(
          {required DateTime from,
          DateTime? to,
          String currency = 'USD',
          int pageSize = 50}) =>
      _get('/v1/wallet/statement', queryParameters: {
        'currency': currency,
        'from': from.toUtc().toIso8601String(),
        if (to != null) 'to': to.toUtc().toIso8601String(),
        'page_size': '$pageSize',
      });

  // ── Pagos (F11.3, S-WAL-05/06/07, S-FIN-02/04) ─────────────────────────────

  /// S-WAL-05: nombre VERIFICADO del comercio de un código de cobro (R16).
  Future<Map<String, dynamic>> resolvePayLink(String code) =>
      _get('/v1/pay-links/${Uri.encodeComponent(code)}');

  /// N-CON-01: desglose antes de confirmar. El gateway completa moneda y riel (WALLET).
  Future<Map<String, dynamic>> quoteFees(int amountMinor) =>
      _get('/v1/payments/quote', queryParameters: {'amount': '$amountMinor'});

  /// Intent de pago con wallet desde una terminal. La misma [idempotencyKey] se reutiliza al
  /// reintentar la misma operación (grpc-conventions §3).
  Future<Map<String, dynamic>> createPaymentIntent(
          {required String terminalCode,
          required int amountMinor,
          required String idempotencyKey,
          String currency = 'USD',
          String? stepUpToken,
          String? saleId}) =>
      _post('/v1/payments/intents',
          data: {
            'amount': {'amount_minor': '$amountMinor', 'currency': currency},
            'rail': 'PAYMENT_RAIL_WALLET',
            'terminal_code': terminalCode,
            // Pago de una venta de caja: pos lo concilia por esta referencia (SPEC pos R4).
            if (saleId != null) 'reference': {'type': 'sale', 'id': saleId},
          },
          idempotencyKey: idempotencyKey,
          headers: {if (stepUpToken != null) 'X-Step-Up-Token': stepUpToken});

  /// S-WAL-02 (R10/T1): recarga desde un riel externo. El gateway fija la referencia `topup`.
  Future<Map<String, dynamic>> createTopup(
          {required int amountMinor,
          required String rail,
          required String idempotencyKey,
          String currency = 'USD'}) =>
      _post('/v1/wallet/topups',
          data: {
            'amount': {'amount_minor': '$amountMinor', 'currency': currency},
            'rail': rail,
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> confirmPaymentIntent(String intentId,
          {required String idempotencyKey}) =>
      _post('/v1/payments/intents/${Uri.encodeComponent(intentId)}/confirm',
          data: const <String, dynamic>{}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> getPaymentIntent(String intentId) =>
      _get('/v1/payments/intents/${Uri.encodeComponent(intentId)}');

  /// S-FIN-02: cobros del negocio del token, más recientes primero.
  Future<Map<String, dynamic>> listPayments(
          {int pageSize = 50, String pageToken = ''}) =>
      _get('/v1/payments', queryParameters: {
        'page_size': '$pageSize',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  /// S-FIN-04: puntos de cobro del negocio del token.
  Future<Map<String, dynamic>> listTerminals() => _get('/v1/terminals');

  Future<Map<String, dynamic>> createTerminal(String label,
          {required String idempotencyKey}) =>
      _post('/v1/terminals',
          data: {'label': label}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> setTerminalActive(
          String terminalId, bool active) =>
      _post('/v1/terminals/${Uri.encodeComponent(terminalId)}/active',
          data: {'active': active});

  // ── Catálogo (F15, S-CAT-01/02/04) ──────────────────────────────────────────────────────

  Future<Map<String, dynamic>> listProducts(
          {String query = '',
          String categoryId = '',
          bool archived = false,
          int pageSize = 50,
          String pageToken = ''}) =>
      _get('/v1/catalog/products', queryParameters: {
        if (query.isNotEmpty) 'q': query,
        if (categoryId.isNotEmpty) 'category_id': categoryId,
        'status':
            archived ? 'PRODUCT_STATUS_ARCHIVED' : 'PRODUCT_STATUS_ACTIVE',
        'page_size': '$pageSize',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  Future<Map<String, dynamic>> getProduct(String productId) =>
      _get('/v1/catalog/products/${Uri.encodeComponent(productId)}');

  Future<Map<String, dynamic>> lookupBarcode(String barcode) =>
      _get('/v1/catalog/barcodes/${Uri.encodeComponent(barcode)}');

  Future<Map<String, dynamic>> createProduct(Map<String, Object?> product,
          {required String idempotencyKey}) =>
      _post('/v1/catalog/products',
          data: {'product': product}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> updateProduct(
          String productId, Map<String, Object?> product, List<String> mask,
          {required String idempotencyKey}) =>
      _patch('/v1/catalog/products/${Uri.encodeComponent(productId)}',
          data: {'product': product, 'update_mask': mask},
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> archiveProduct(String productId,
          {required String idempotencyKey}) =>
      _post('/v1/catalog/products/${Uri.encodeComponent(productId)}/archive',
          data: const <String, Object>{}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> listCategories() =>
      _get('/v1/catalog/categories');

  /// Tasas de ITBMS vigentes (`legal.pa.itbms.*`): la app nunca las lleva en su código.
  Future<Map<String, dynamic>> getTaxRates() => _get('/v1/catalog/tax-rates');

  // ── Compras de inventario (inventory F16.5–F16.6) ──────────────────────────

  Future<Map<String, dynamic>> listSuppliers() =>
      _get('/v1/inventory/suppliers', queryParameters: {'page_size': '200'});

  /// Crear (sin `supplier_id`, con la clave de idempotencia) o actualizar.
  Future<Map<String, dynamic>> upsertSupplier(Map<String, Object?> supplier,
          {required String idempotencyKey}) =>
      _put('/v1/inventory/suppliers',
          data: {'supplier': supplier},
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> listPurchaseOrders({String status = ''}) =>
      _get('/v1/inventory/purchase-orders', queryParameters: {
        if (status.isNotEmpty) 'status': status,
        'page_size': '100',
      });

  Future<Map<String, dynamic>> createPurchaseOrder(Map<String, Object?> order,
          {required String idempotencyKey}) =>
      _post('/v1/inventory/purchase-orders',
          data: {'order': order}, idempotencyKey: idempotencyKey);

  /// `status`: PURCHASE_ORDER_STATUS_SENT o PURCHASE_ORDER_STATUS_CANCELLED.
  Future<Map<String, dynamic>> setPurchaseOrderStatus(String id, String status,
          {required String idempotencyKey}) =>
      _post('/v1/inventory/purchase-orders/${Uri.encodeComponent(id)}/status',
          data: {'status': status}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> receivePurchaseOrder(
          String id, List<Map<String, Object?>> lines,
          {String supplierInvoice = '', required String idempotencyKey}) =>
      _post('/v1/inventory/purchase-orders/${Uri.encodeComponent(id)}/receive',
          data: {'lines': lines, 'supplier_invoice': supplierInvoice},
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> reorderSuggestions() =>
      _get('/v1/inventory/reorder-suggestions');

  // ── Liquidación a comercios (settlement, api-gateway SPEC §4.3) ──────────────
  // El negocio sale del token; ninguna llamada manda tenant_id (ADR 0011).

  Future<Map<String, dynamic>> settlementSummary() =>
      _get('/v1/settlement/summary');

  Future<Map<String, dynamic>> payoutSchedule() =>
      _get('/v1/settlement/schedule');

  /// 🔒 `settlement.destination.update` si cambia el destino: sin token responde
  /// STEP_UP_REQUIRED. El número de cuenta viaja una sola vez y se cifra en security.
  Future<Map<String, dynamic>> setPayoutSchedule(Map<String, Object?> schedule,
          {Map<String, Object?>? destination,
          required String idempotencyKey,
          String? stepUpToken}) =>
      _put('/v1/settlement/schedule',
          data: {
            'schedule': schedule,
            if (destination != null) 'destination': destination,
          },
          headers: _stepUpHeaders(stepUpToken),
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> listSettlementBatches(
          {String status = '', String pageToken = ''}) =>
      _get('/v1/settlement/batches', queryParameters: {
        if (status.isNotEmpty) 'status': status,
        'page_size': '50',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  Future<Map<String, dynamic>> getSettlementBatch(String batchId) =>
      _get('/v1/settlement/batches/${Uri.encodeComponent(batchId)}');

  /// «Liquidar ahora» (S-FIN-05).
  Future<Map<String, dynamic>> createSettlementBatch(
          {required String idempotencyKey}) =>
      _post('/v1/settlement/batches',
          data: const <String, Object>{}, idempotencyKey: idempotencyKey);

  // ── Facturación electrónica (fiscal-invoicing, api-gateway SPEC §4.3) ──────
  // El negocio sale del token; ninguna llamada manda tenant_id (ADR 0011).

  Future<Map<String, dynamic>> getFiscalProfile() => _get('/v1/fiscal/profile');

  /// 🔒 `security.credentials.update`: sin token responde STEP_UP_REQUIRED. Las credenciales del
  /// PAC viajan una sola vez (bytes del contrato = JSON en base64) y van a security (ADR 0022).
  Future<Map<String, dynamic>> configureFiscalProfile(
          Map<String, Object?> profile,
          {required String idempotencyKey,
          String? stepUpToken,
          Map<String, String>? pacCredentials}) =>
      _put('/v1/fiscal/profile',
          data: {
            'profile': profile,
            if (pacCredentials != null)
              'pac_credentials':
                  base64Encode(utf8.encode(jsonEncode(pacCredentials))),
          },
          headers: _stepUpHeaders(stepUpToken),
          idempotencyKey: idempotencyKey);

  /// Adaptadores de PAC elegibles en el perfil fiscal (ADR 0022).
  Future<Map<String, dynamic>> listPacProviders() =>
      _get('/v1/fiscal/pac-providers');

  Future<Map<String, dynamic>> getFolioStatus() => _get('/v1/fiscal/folios');

  Future<Map<String, dynamic>> listInvoices(
          {String status = '',
          String documentType = '',
          String pageToken = ''}) =>
      _get('/v1/fiscal/invoices', queryParameters: {
        if (status.isNotEmpty) 'status': status,
        if (documentType.isNotEmpty) 'document_type': documentType,
        if (pageToken.isNotEmpty) 'page_token': pageToken,
        'page_size': '50',
      });

  Future<Map<String, dynamic>> getInvoice(String invoiceId) =>
      _get('/v1/fiscal/invoices/${Uri.encodeComponent(invoiceId)}');

  Future<Map<String, dynamic>> issueInvoice(Map<String, Object?> body,
          {required String idempotencyKey}) =>
      _post('/v1/fiscal/invoices', data: body, idempotencyKey: idempotencyKey);

  /// Nota de crédito (credit=true) o de débito sobre una factura autorizada.
  Future<Map<String, dynamic>> issueNote(String invoiceId,
          {required bool credit,
          required Map<String, Object?> body,
          required String idempotencyKey}) =>
      _post(
          '/v1/fiscal/invoices/${Uri.encodeComponent(invoiceId)}/${credit ? 'credit' : 'debit'}-notes',
          data: body,
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> searchTaxpayers(String query,
          {String pageToken = ''}) =>
      _get('/v1/fiscal/taxpayers', queryParameters: {
        'q': query,
        if (pageToken.isNotEmpty) 'page_token': pageToken,
        'page_size': '50',
      });

  Future<Map<String, dynamic>> upsertTaxpayer(Map<String, Object?> taxpayer,
          {required String idempotencyKey}) =>
      _put('/v1/fiscal/taxpayers',
          data: {'taxpayer': taxpayer}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> upsertCategory(
          {String id = '', required String name, String parentId = ''}) =>
      _post('/v1/catalog/categories',
          data: {
            'category': {
              if (id.isNotEmpty) 'category_id': id,
              'name': name,
              if (parentId.isNotEmpty) 'parent_id': parentId,
            }
          },
          skipIdempotency: true);

  // ── Marketplace y vitrina (F15.4–F15.5, S-MKT-01/02/03, S-CAT-05) ───────────────────────

  Future<Map<String, dynamic>> marketplaceSearch(
          {String query = '',
          String merchant = '',
          String sort = '',
          int pageSize = 20,
          String pageToken = ''}) =>
      _get('/v1/marketplace/search', queryParameters: {
        if (query.isNotEmpty) 'q': query,
        if (merchant.isNotEmpty) 'merchant': merchant,
        if (sort.isNotEmpty) 'sort': sort,
        'page_size': '$pageSize',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  Future<Map<String, dynamic>> marketplaceProduct(String productId) =>
      _get('/v1/marketplace/products/${Uri.encodeComponent(productId)}');

  Future<Map<String, dynamic>> storefront(String tenantId) =>
      _get('/v1/marketplace/storefronts/${Uri.encodeComponent(tenantId)}');

  Future<Map<String, dynamic>> myStorefront() => _get('/v1/catalog/storefront');

  Future<Map<String, dynamic>> updateStorefront(
          {required String displayName,
          String description = '',
          required bool published,
          required String idempotencyKey}) =>
      _put('/v1/catalog/storefront',
          data: {
            'storefront': {
              'display_name': displayName,
              'description': description,
              'published': published,
            }
          },
          idempotencyKey: idempotencyKey);

  /// Publica o despublica un producto en el marketplace (retiro en tienda por ahora).
  Future<Map<String, dynamic>> setListing(String productId,
          {required bool listed, required String idempotencyKey}) =>
      _put('/v1/catalog/products/${Uri.encodeComponent(productId)}/listing',
          data: {
            'listing': {'listed': listed, 'pickup_available': true}
          },
          idempotencyKey: idempotencyKey);

  // ── Carrito y pedidos (F15.6–F15.9, S-MKT-04/05/06/07, S-ORD-01/02) ───────────────────

  Future<Map<String, dynamic>> getCart() => _get('/v1/cart');

  /// `qtyMilli` = 0 quita el producto.
  Future<Map<String, dynamic>> setCartItem(String productId, int qtyMilli,
          {required String idempotencyKey}) =>
      _put('/v1/cart/items/${Uri.encodeComponent(productId)}',
          data: {'quantity_milli': '$qtyMilli'},
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> clearCart({required String idempotencyKey}) =>
      _post('/v1/cart/clear',
          data: const <String, Object>{}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> quoteOrder() => _post('/v1/orders/quote',
      data: {'fulfillment': 'FULFILLMENT_METHOD_PICKUP'},
      skipIdempotency: true);

  /// Saga de checkout (orders R3). Con step-up, la misma clave retoma el mismo pedido.
  Future<Map<String, dynamic>> checkoutOrder(String quoteId,
          {required String idempotencyKey, String? stepUpToken}) =>
      _post('/v1/orders',
          data: {
            'quote_id': quoteId,
            'fulfillment': 'FULFILLMENT_METHOD_PICKUP',
            'rail': 'PAYMENT_RAIL_WALLET',
          },
          idempotencyKey: idempotencyKey,
          headers: {if (stepUpToken != null) 'X-Step-Up-Token': stepUpToken});

  Future<Map<String, dynamic>> myOrders({int pageSize = 50}) =>
      _get('/v1/orders', queryParameters: {'page_size': '$pageSize'});

  Future<Map<String, dynamic>> getOrder(String orderId) =>
      _get('/v1/orders/${Uri.encodeComponent(orderId)}');

  Future<Map<String, dynamic>> cancelOrder(String orderId,
          {required String idempotencyKey}) =>
      _post('/v1/orders/${Uri.encodeComponent(orderId)}/cancel',
          data: const <String, Object>{}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> merchantOrders(
          {String status = '', int pageSize = 100}) =>
      _get('/v1/merchant/orders', queryParameters: {
        if (status.isNotEmpty) 'status': status,
        'page_size': '$pageSize',
      });

  /// `action`: accept | ready | complete.
  Future<Map<String, dynamic>> subOrderAction(String subOrderId, String action,
          {String pickupCode = '', required String idempotencyKey}) =>
      _post(
          '/v1/merchant/sub-orders/${Uri.encodeComponent(subOrderId)}/$action',
          data: {if (pickupCode.isNotEmpty) 'pickup_code': pickupCode},
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> rejectSubOrder(String subOrderId,
          {required String reason, required String idempotencyKey}) =>
      _post('/v1/merchant/sub-orders/${Uri.encodeComponent(subOrderId)}/reject',
          data: {'reason': reason}, idempotencyKey: idempotencyKey);

  // ── Inventario (F16, S-INV-01/02/03/04/09) ──────────────────────────────────────────────

  Future<Map<String, dynamic>> listWarehouses() =>
      _get('/v1/inventory/warehouses');

  Future<Map<String, dynamic>> upsertWarehouse(
          {String id = '', required String name, bool active = true}) =>
      _post('/v1/inventory/warehouses',
          data: {
            'warehouse': {
              if (id.isNotEmpty) 'warehouse_id': id,
              'name': name,
              'active': active,
            }
          },
          skipIdempotency: true);

  Future<Map<String, dynamic>> listStock(
          {String warehouseId = '',
          bool onlyLow = false,
          int pageSize = 200,
          String pageToken = ''}) =>
      _get('/v1/inventory/stock', queryParameters: {
        if (warehouseId.isNotEmpty) 'warehouse_id': warehouseId,
        if (onlyLow) 'only_low': 'true',
        'page_size': '$pageSize',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  Future<Map<String, dynamic>> getStock(String productId,
          {String warehouseId = ''}) =>
      _get('/v1/inventory/stock/${Uri.encodeComponent(productId)}',
          queryParameters: {
            if (warehouseId.isNotEmpty) 'warehouse_id': warehouseId,
          });

  /// `type`: MOVEMENT_TYPE_RECEIPT | MOVEMENT_TYPE_ADJUSTMENT | MOVEMENT_TYPE_WRITE_OFF.
  Future<Map<String, dynamic>> adjustStock(
          {required String productId,
          String warehouseId = '',
          required int deltaMilli,
          required String type,
          String reason = '',
          required String idempotencyKey}) =>
      _post('/v1/inventory/adjustments',
          data: {
            'product_id': productId,
            if (warehouseId.isNotEmpty) 'warehouse_id': warehouseId,
            'delta_milli': '$deltaMilli',
            'type': type,
            if (reason.isNotEmpty) 'reason': reason,
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> transferStock(
          {required String productId,
          required String fromWarehouseId,
          required String toWarehouseId,
          required int quantityMilli,
          String reason = '',
          required String idempotencyKey}) =>
      _post('/v1/inventory/transfers',
          data: {
            'product_id': productId,
            'from_warehouse_id': fromWarehouseId,
            'to_warehouse_id': toWarehouseId,
            'quantity_milli': '$quantityMilli',
            if (reason.isNotEmpty) 'reason': reason,
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> listMovements(
          {String productId = '',
          String warehouseId = '',
          int pageSize = 50}) =>
      _get('/v1/inventory/movements', queryParameters: {
        if (productId.isNotEmpty) 'product_id': productId,
        if (warehouseId.isNotEmpty) 'warehouse_id': warehouseId,
        'page_size': '$pageSize',
      });

  // ── Caja (F17, S-POS-01/02/03/05/07/09/10) ──────────────────────────────────────────────

  /// Sesión abierta del cajero; 404 NOT_FOUND si no tiene.
  Future<Map<String, dynamic>> currentCashSession() =>
      _get('/v1/pos/sessions/current');

  Future<Map<String, dynamic>> getCashSession(String sessionId) =>
      _get('/v1/pos/sessions/${Uri.encodeComponent(sessionId)}');

  /// `terminalCode` es el código público del punto de cobro (S-FIN-04) en que cobra la caja.
  Future<Map<String, dynamic>> openCashSession(
          {required String terminalCode,
          required int openingFloatMinor,
          required String idempotencyKey}) =>
      _post('/v1/pos/sessions',
          data: {
            'terminal_label': terminalCode,
            'opening_float': {
              'amount_minor': '$openingFloatMinor',
              'currency': 'USD'
            },
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> closeCashSession(String sessionId,
          {required int countedMinor,
          String notes = '',
          required String idempotencyKey}) =>
      _post('/v1/pos/sessions/${Uri.encodeComponent(sessionId)}/close',
          data: {
            'counted_cash': {
              'amount_minor': '$countedMinor',
              'currency': 'USD'
            },
            if (notes.isNotEmpty) 'notes': notes,
          },
          idempotencyKey: idempotencyKey);

  /// `direction`: IN | OUT.
  Future<Map<String, dynamic>> recordCashMovement(String sessionId,
          {required String direction,
          required int amountMinor,
          required String reason,
          required String idempotencyKey}) =>
      _post('/v1/pos/sessions/${Uri.encodeComponent(sessionId)}/movements',
          data: {
            'direction': direction,
            'amount': {'amount_minor': '$amountMinor', 'currency': 'USD'},
            'reason': reason,
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> createSale(String sessionId,
          {required String clientSaleId, required String idempotencyKey}) =>
      _post('/v1/pos/sales',
          data: {'session_id': sessionId, 'client_sale_id': clientSaleId},
          idempotencyKey: idempotencyKey);

  /// Reemplaza las líneas; el precio lo pone el servidor desde el catálogo.
  Future<Map<String, dynamic>> updateSale(
          String saleId, List<({String productId, int qtyMilli})> lines,
          {required String idempotencyKey}) =>
      _put('/v1/pos/sales/${Uri.encodeComponent(saleId)}',
          data: {
            'lines': [
              for (final l in lines)
                {'product_id': l.productId, 'quantity_milli': '${l.qtyMilli}'}
            ],
          },
          idempotencyKey: idempotencyKey);

  /// `tenders`: rail (PAYMENT_RAIL_CASH | PAYMENT_RAIL_WALLET), monto y, en efectivo, lo recibido.
  Future<Map<String, dynamic>> checkoutSale(String saleId,
          List<({String rail, int amountMinor, int cashTenderedMinor})> tenders,
          {required String idempotencyKey}) =>
      _post('/v1/pos/sales/${Uri.encodeComponent(saleId)}/checkout',
          data: {
            'tenders': [
              for (final t in tenders)
                {
                  'rail': t.rail,
                  'amount': {
                    'amount_minor': '${t.amountMinor}',
                    'currency': 'USD'
                  },
                  if (t.cashTenderedMinor > 0)
                    'cash_tendered': {
                      'amount_minor': '${t.cashTenderedMinor}',
                      'currency': 'USD'
                    },
                }
            ],
          },
          idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> voidSale(String saleId,
          {required String reason, required String idempotencyKey}) =>
      _post('/v1/pos/sales/${Uri.encodeComponent(saleId)}/void',
          data: {'reason': reason}, idempotencyKey: idempotencyKey);

  Future<Map<String, dynamic>> getSale(String saleId) =>
      _get('/v1/pos/sales/${Uri.encodeComponent(saleId)}');

  Future<Map<String, dynamic>> listSales(
          {String sessionId = '',
          String status = '',
          DateTime? from,
          int pageSize = 100,
          String pageToken = ''}) =>
      _get('/v1/pos/sales', queryParameters: {
        if (sessionId.isNotEmpty) 'session_id': sessionId,
        if (status.isNotEmpty) 'status': status,
        if (from != null) 'from': from.toUtc().toIso8601String(),
        'page_size': '$pageSize',
        if (pageToken.isNotEmpty) 'page_token': pageToken,
      });

  Future<Me> me() async {
    final body = await _get('/v1/me');
    return Me(
      userId: body['user_id'] as String? ?? '',
      role: body['role'] as String? ?? '',
      tenantId: body['tenant_id'] as String? ?? '',
      fullName: body['full_name'] as String? ?? '',
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

  // ── Confirmación fuerte (ADR 0020, S-GEN-21) ─────────────────────────────
  // La app nunca decide: identity verifica el PIN o la contraseña y emite el token de un uso,
  // atado al usuario, la operación, el monto y la moneda (`ConsumeStepUp` responde MISMATCH si
  // cambian). El PIN y la contraseña viajan solo en el cuerpo de `/v1/step-up/verify` y nunca se
  // registran (observability-standards.md §16).

  /// Pide el reto de [operation]: dice qué se confirma y con qué métodos (identity R27).
  Future<StepUpChallenge> issueStepUpChallenge(String operation,
          {int amountMinor = 0, String currency = ''}) async =>
      StepUpChallenge.fromJson(await _post('/v1/step-up/challenge',
          data: {
            'operation': operation,
            if (amountMinor > 0) 'amount_minor': '$amountMinor',
            if (currency.isNotEmpty) 'currency': currency,
          },
          skipIdempotency: true));

  /// Verifica el reto con [method] (`PIN` o `PASSWORD`) y devuelve el token.
  Future<String> verifyStepUp(String challengeId,
      {required String method, String? pin, String? password}) async {
    final verified = await _post('/v1/step-up/verify',
        data: {
          'challenge_id': challengeId,
          'method': method,
          if (pin != null) 'pin': pin,
          if (password != null) 'password': password,
        },
        skipIdempotency: true);
    final token = verified['token'] as String? ?? '';
    if (token.isEmpty) throw ApiException(403, 'STEP_UP_INVALID', '');
    return token;
  }

  /// Estado del PIN de confirmación (S-GEN-10 e6, S-GEN-21 e4).
  Future<StepUpPinStatus> getStepUpPinStatus() async =>
      StepUpPinStatus.fromJson(await _get('/v1/me/step-up-pin'));

  /// Crea o cambia el PIN (🔒 `identity.pin.set`, nivel 3: el token sale de la contraseña).
  Future<void> setStepUpPin(String pin, {String? stepUpToken}) async {
    await _put('/v1/me/step-up-pin',
        data: {'pin': pin},
        headers: _stepUpHeaders(stepUpToken),
        idempotencyKey: newRequestId());
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

  /// 🔒 `identity.password.change` (identity R14, R26): sin token responde STEP_UP_REQUIRED.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    String? stepUpToken,
  }) async {
    await _post('/v1/me/password',
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
        headers: _stepUpHeaders(stepUpToken));
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
      {Object? data,
      Map<String, String>? headers,
      String? idempotencyKey}) async {
    try {
      final res = await _dio.put<dynamic>(path,
          data: data,
          options: Options(headers: {
            if (headers != null) ...headers,
            if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
          }));
      return _extractData(res);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> _patch(String path,
      {Object? data, String? idempotencyKey}) async {
    try {
      final res = await _dio.patch<dynamic>(path,
          data: data,
          options: Options(headers: {
            if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
          }));
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
