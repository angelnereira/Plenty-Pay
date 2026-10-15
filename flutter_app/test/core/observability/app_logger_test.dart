import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/observability/app_logger.dart';

// docs/standards/observability-standards.md §13 y §15.
void main() {
  late QueueSink sink;
  late AppLogger logger;

  setUp(() {
    sink = QueueSink();
    logger = AppLogger(sinks: [sink], buildId: '1.2.3+45', environment: 'staging');
  });

  Map<String, Object?> lastRecord() => sink.records.last.toJson();

  test('§9 un error registra qué, dónde, cómo, cuándo y por qué', () {
    logger
      ..screen = '/pos/sell'
      ..lastRequestId = '0192f0c1-7b2a-7c3d-8e4f-5a6b7c8d9e0f'
      ..breadcrumb('action', 'tap_checkout');
    try {
      throw StateError('ticket vacío');
    } catch (e, st) {
      logger.error('checkout failed', e, st, widget: 'CheckoutButton');
    }
    final rec = lastRecord();
    expect(rec['level'], 'error');
    expect(rec['msg'], 'checkout failed');
    expect(rec['error.type'], 'StateError'); // qué
    expect(rec['exception.message'], contains('ticket vacío'));
    expect(rec['pp.screen'], '/pos/sell'); // dónde
    expect(rec['pp.widget'], 'CheckoutButton');
    expect(rec['service.name'], 'flutter_app');
    expect(rec['service.version'], '1.2.3+45');
    expect(rec['exception.stacktrace'], contains('app_logger_test.dart')); // cómo
    expect((rec['pp.breadcrumbs']! as List).single, containsPair('name', 'tap_checkout'));
    expect(DateTime.parse(rec['ts']! as String).isUtc, isTrue); // cuándo
    expect(rec['request_id'], '0192f0c1-7b2a-7c3d-8e4f-5a6b7c8d9e0f'); // correlación con el backend
  });

  test('§13.2 conserva solo las últimas 20 migas', () {
    for (var i = 0; i < 35; i++) {
      logger.breadcrumb('action', 'tap_$i');
    }
    expect(logger.breadcrumbs, hasLength(20));
    expect(logger.breadcrumbs.first.name, 'tap_15');
    expect(logger.breadcrumbs.last.name, 'tap_34');
  });

  test('§13.5 la cola del exportador está acotada', () {
    final small = QueueSink(capacity: 3);
    final l = AppLogger(sinks: [small]);
    for (var i = 0; i < 10; i++) {
      l.info('event $i');
    }
    expect(small.records.map((r) => r.msg), ['event 7', 'event 8', 'event 9']);
    expect(small.drain(), hasLength(3));
    expect(small.records, isEmpty);
  });

  test('§1.4 y §15.4 enmascara tokens, correos, tarjetas y contraseñas', () {
    const dirty = 'POST failed Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc123 '
        'user ana@test.co card 4242424242424242 {"password":"contraseña-larga-123"}';
    logger.error('request failed', Exception(dirty), StackTrace.fromString(dirty));
    final text = jsonEncode(lastRecord());
    for (final secret in ['eyJhbGci', 'ana@test.co', '4242424242424242', 'contraseña-larga-123']) {
      expect(text, isNot(contains(secret)), reason: 'el registro contiene $secret');
    }
    expect(text, contains('[redacted]'));
  });

  test('§13.1 captura errores del framework con el widget que falló', () {
    final original = FlutterError.onError;
    final originalPlatform = PlatformDispatcher.instance.onError;
    addTearDown(() {
      FlutterError.onError = original;
      PlatformDispatcher.instance.onError = originalPlatform;
    });
    installFrameworkErrorHandlers(logger);

    FlutterError.onError!(FlutterErrorDetails(
      exception: FlutterError('RenderFlex overflowed'),
      stack: StackTrace.current,
      library: 'rendering library',
      context: ErrorDescription('during layout of TicketPanel'),
    ));
    var rec = lastRecord();
    expect(rec['msg'], 'flutter framework error');
    expect(rec['pp.widget'], contains('TicketPanel'));
    expect(rec['pp.library'], 'rendering library');
    expect(rec['exception.stacktrace'], isNotNull);

    final handled = PlatformDispatcher.instance.onError!(TimeoutException('sin respuesta'), StackTrace.current);
    rec = lastRecord();
    expect(handled, isTrue, reason: 'la app no debe cerrarse');
    expect(rec['msg'], 'uncaught async error');
    expect(rec['level'], 'fatal');
    expect(rec['error.type'], 'TimeoutException');
  });

  test('§13.1 captura lo que escapa de la zona de la app', () async {
    final original = FlutterError.onError;
    final originalPlatform = PlatformDispatcher.instance.onError;
    addTearDown(() {
      FlutterError.onError = original;
      PlatformDispatcher.instance.onError = originalPlatform;
    });
    runGuarded(logger, () {
      Future<void>.delayed(Duration.zero, () => throw const FormatException('respuesta inesperada'));
    });
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final rec = lastRecord();
    expect(rec['msg'], 'uncaught zone error');
    expect(rec['error.type'], 'FormatException');
  });

  test('span mide la operación y relanza el error sin registrarlo como error', () async {
    await expectLater(logger.span('load_permissions', () async => throw StateError('x')), throwsStateError);
    final rec = lastRecord();
    expect(rec['level'], 'debug');
    expect(rec['pp.span'], 'load_permissions');
    expect(rec['error.type'], 'StateError');
    expect(rec['duration_ms'], isA<int>());
    expect(sink.records.where((r) => r.level == LogLevel.error), isEmpty);
  });

  test('el observador de navegación mantiene pp.screen y deja migas', () {
    final observer = TelemetryNavigatorObserver(logger);
    final route = PageRouteBuilder<void>(settings: const RouteSettings(name: '/wallet'), pageBuilder: (_, __, ___) => const SizedBox());
    observer.didPush(route, null);
    expect(logger.screen, '/wallet');
    expect(logger.breadcrumbs.single.toJson(), containsPair('detail', '/wallet'));
  });

  test('newRequestId genera UUIDv7 y TraceContext un traceparent W3C válido', () {
    final id = newRequestId(DateTime.utc(2026, 10, 12));
    expect(id, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(int.parse(id.replaceAll('-', '').substring(0, 12), radix: 16), DateTime.utc(2026, 10, 12).millisecondsSinceEpoch);
    expect(newRequestId(), isNot(newRequestId()));
    expect(TraceContext.start().traceparent, matches(RegExp(r'^00-[0-9a-f]{32}-[0-9a-f]{16}-01$')));
  });

  group('ApiClient', () {
    test('§12.6 cada petición lleva X-Request-Id y traceparent, y deja una miga sin datos sensibles', () async {
      late http.Request seen;
      final api = ApiClient(
        baseUrl: 'http://localhost:8080',
        logger: logger,
        client: MockClient((req) async {
          seen = req;
          return http.Response('{"error":"correo o contraseña incorrectos","reason":"INVALID_CREDENTIALS","request_id":"${req.headers['X-Request-Id']}"}', 401,
              headers: {'content-type': 'application/json; charset=utf-8'});
        }),
      );
      await expectLater(
        api.login('ana@test.co', 'contraseña-larga-123'),
        throwsA(isA<ApiException>()
            .having((e) => e.reason, 'reason', 'INVALID_CREDENTIALS')
            .having((e) => e.requestId, 'requestId', isNotEmpty)),
      );
      expect(seen.headers['X-Request-Id'], logger.lastRequestId);
      expect(seen.headers['traceparent'], '00-${logger.lastTraceId}-${seen.headers['traceparent']!.split('-')[2]}-01');
      final crumb = logger.breadcrumbs.single.toJson();
      expect(crumb, {'ts': isNotNull, 'type': 'http', 'name': 'POST /v1/auth/login', 'detail': '401'});
      // un 401 es un error esperable: no genera registro de fallo
      expect(sink.records.where((r) => r.level.index >= LogLevel.warn.index), isEmpty);
    });

    test('§10.1 un 5xx y un fallo de red se registran como fallo de dependencia', () async {
      var fail = false;
      final api = ApiClient(
        baseUrl: 'http://localhost:8080',
        logger: logger,
        client: MockClient((req) async {
          if (fail) throw http.ClientException('Connection refused');
          return http.Response('{"error":"servicio de identidad no disponible","reason":"IDENTITY_UNAVAILABLE"}', 503,
              headers: {'x-request-id': 'abc', 'content-type': 'application/json; charset=utf-8'});
        }),
      );
      await expectLater(api.login('a@b.co', 'x'), throwsA(isA<ApiException>().having((e) => e.requestId, 'requestId', 'abc')));
      var rec = lastRecord();
      expect(rec['level'], 'warn');
      expect(rec['http.response.status_code'], 503);
      expect(rec['peer.service'], 'api-gateway');
      expect(rec['url.path'], '/v1/auth/login');

      fail = true;
      await expectLater(api.login('a@b.co', 'x'), throwsA(isA<http.ClientException>()));
      rec = lastRecord();
      expect(rec['error.type'], 'ClientException');
      expect(jsonEncode(sink.records.map((r) => r.toJson()).toList()), isNot(contains('a@b.co')));
    });
  });
}
