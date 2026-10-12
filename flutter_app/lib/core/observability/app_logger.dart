import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Telemetría del cliente (docs/standards/observability-standards.md §13).
/// Un fallo debe poder explicarse sin reproducirlo: qué, dónde, cómo, cuándo y por qué.

enum LogLevel { debug, info, warn, error, fatal }

/// Un registro listo para exportar. Las claves siguen las convenciones de OpenTelemetry;
/// las propias llevan el prefijo `pp.`.
class TelemetryRecord {
  TelemetryRecord({required this.ts, required this.level, required this.msg, required this.attributes});
  final DateTime ts;
  final LogLevel level;
  final String msg;
  final Map<String, Object?> attributes;

  Map<String, Object?> toJson() => {
        'ts': ts.toUtc().toIso8601String(),
        'level': level.name,
        'msg': msg,
        ...attributes,
      };
}

/// Destino de los registros. El envío por OTLP al gateway (`POST /v1/telemetry`) llega en F22.6;
/// hasta entonces los registros van a la consola de desarrollo y a una cola acotada en memoria.
abstract class TelemetrySink {
  void add(TelemetryRecord record);
}

class ConsoleSink implements TelemetrySink {
  const ConsoleSink();
  @override
  void add(TelemetryRecord record) {
    developer.log(jsonEncode(record.toJson()), name: 'plentypay', level: 500 + record.level.index * 100);
  }
}

/// Cola acotada: conserva los últimos [capacity] registros para el exportador (§13.5: 500 registros).
class QueueSink implements TelemetrySink {
  QueueSink({this.capacity = 500});
  final int capacity;
  final Queue<TelemetryRecord> _queue = Queue<TelemetryRecord>();

  List<TelemetryRecord> get records => List.unmodifiable(_queue);

  @override
  void add(TelemetryRecord record) {
    _queue.addLast(record);
    while (_queue.length > capacity) {
      _queue.removeFirst();
    }
  }

  /// Entrega y vacía lo pendiente (lo usará el exportador).
  List<TelemetryRecord> drain() {
    final out = _queue.toList(growable: false);
    _queue.clear();
    return out;
  }
}

/// Una miga: algo que el usuario o la app hizo justo antes de un fallo. Nunca lleva valores de campos.
class Breadcrumb {
  Breadcrumb(this.ts, this.type, this.name, [this.detail]);
  final DateTime ts;
  final String type; // navigation | action | http
  final String name;
  final String? detail;

  Map<String, Object?> toJson() => {
        'ts': ts.toUtc().toIso8601String(),
        'type': type,
        'name': name,
        if (detail != null) 'detail': detail,
      };
}

class AppLogger {
  AppLogger({
    required this.sinks,
    this.buildId = 'dev',
    this.environment = 'dev',
    this.maxBreadcrumbs = 20,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  /// Logger que descarta todo (pruebas y valores por defecto).
  factory AppLogger.disabled() => AppLogger(sinks: const []);

  final List<TelemetrySink> sinks;
  final String buildId;
  final String environment;
  final int maxBreadcrumbs;
  final DateTime Function() _clock;
  final Queue<Breadcrumb> _breadcrumbs = Queue<Breadcrumb>();

  /// Pantalla actual (ruta); la mantiene [TelemetryNavigatorObserver].
  String screen = '';

  /// Correlación con el backend: ids de la última petición HTTP.
  String lastRequestId = '';
  String lastTraceId = '';

  List<Breadcrumb> get breadcrumbs => List.unmodifiable(_breadcrumbs);

  void breadcrumb(String type, String name, [String? detail]) {
    _breadcrumbs.addLast(Breadcrumb(_clock(), type, name, detail == null ? null : scrub(detail)));
    while (_breadcrumbs.length > maxBreadcrumbs) {
      _breadcrumbs.removeFirst();
    }
  }

  void debug(String msg, [Map<String, Object?> attributes = const {}]) => _emit(LogLevel.debug, msg, attributes);
  void info(String msg, [Map<String, Object?> attributes = const {}]) => _emit(LogLevel.info, msg, attributes);
  void warn(String msg, [Map<String, Object?> attributes = const {}]) => _emit(LogLevel.warn, msg, attributes);

  /// Registra un fallo con todo lo necesario para diagnosticarlo. Se llama una sola vez por fallo,
  /// en el borde: los manejadores globales o la pantalla que lo captura (§10.3).
  void error(
    String msg,
    Object error,
    StackTrace? stack, {
    String? widget,
    LogLevel level = LogLevel.error,
    Map<String, Object?> attributes = const {},
  }) {
    _emit(level, msg, {
      'error.type': error.runtimeType.toString(),
      'exception.type': error.runtimeType.toString(),
      'exception.message': scrub(error.toString()),
      if (stack != null) 'exception.stacktrace': scrub(stack.toString()),
      if (widget != null) 'pp.widget': widget,
      'pp.breadcrumbs': _breadcrumbs.map((b) => b.toJson()).toList(growable: false),
      ...attributes,
    });
  }

  /// Mide una operación (repositorio, controlador). Si falla, anota el tipo de error y relanza:
  /// el registro del fallo lo hace el borde, no esta función.
  Future<T> span<T>(String name, Future<T> Function() body) async {
    final started = _clock();
    String? errorType;
    try {
      return await body();
    } catch (e) {
      errorType = e.runtimeType.toString();
      rethrow;
    } finally {
      _emit(LogLevel.debug, 'span finished', {
        'pp.span': name,
        'duration_ms': _clock().difference(started).inMilliseconds,
        if (errorType != null) 'error.type': errorType,
      });
    }
  }

  void _emit(LogLevel level, String msg, Map<String, Object?> attributes) {
    if (sinks.isEmpty) return;
    final record = TelemetryRecord(ts: _clock(), level: level, msg: msg, attributes: {
      'service.name': 'flutter_app',
      'service.version': buildId,
      'deployment.environment.name': environment,
      'os.name': defaultTargetPlatform.name,
      if (screen.isNotEmpty) 'pp.screen': screen,
      if (lastRequestId.isNotEmpty) 'request_id': lastRequestId,
      if (lastTraceId.isNotEmpty) 'trace_id': lastTraceId,
      ...attributes,
    });
    for (final sink in sinks) {
      sink.add(record);
    }
  }

  static final List<RegExp> _secrets = [
    RegExp(r'eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*'), // JWT
    RegExp(r'Bearer\s+\S+', caseSensitive: false),
    RegExp(r'[\w.+-]+@[\w-]+\.[\w.-]+'), // correo
    RegExp(r'\b\d{13,19}\b'), // número de tarjeta
    RegExp(r'("?(password|contraseña|refresh_token|access_token)"?\s*[:=]\s*)"?[^",}\s]+"?', caseSensitive: false),
  ];

  /// Enmascara datos prohibidos antes de exportar (§1.4 y §11.6): los mensajes de excepción de
  /// librerías pueden contener tokens, correos o cuerpos de petición.
  static String scrub(String text) {
    var out = text;
    for (final pattern in _secrets) {
      out = out.replaceAllMapped(pattern, (m) => m.groupCount >= 1 && m.group(1) != null ? '${m.group(1)}[redacted]' : '[redacted]');
    }
    return out;
  }
}

/// Mantiene `pp.screen` y deja una miga por navegación.
class TelemetryNavigatorObserver extends NavigatorObserver {
  TelemetryNavigatorObserver(this.logger);
  final AppLogger logger;

  void _update(Route<dynamic>? route, String action) {
    final name = route?.settings.name ?? route?.runtimeType.toString() ?? '';
    logger.screen = name;
    logger.breadcrumb('navigation', action, name);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _update(route, 'push');
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _update(previousRoute, 'pop');
  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _update(newRoute, 'replace');
}

/// Instala las tres capturas globales obligatorias (§13.1) y ejecuta [body] dentro de la zona vigilada:
/// 1. `FlutterError.onError` — errores de construcción, layout y pintado de widgets.
/// 2. `PlatformDispatcher.instance.onError` — errores asíncronos no capturados.
/// 3. `runZonedGuarded` — lo que escape de la zona de la app.
void runGuarded(AppLogger logger, FutureOr<void> Function() body) {
  installFrameworkErrorHandlers(logger);
  runZonedGuarded<void>(
    () => body(),
    (error, stack) => logger.error('uncaught zone error', error, stack, level: LogLevel.fatal),
  );
}

void installFrameworkErrorHandlers(AppLogger logger) {
  final previous = FlutterError.onError;
  FlutterError.onError = (FlutterErrorDetails details) {
    logger.error(
      'flutter framework error',
      details.exception,
      details.stack,
      widget: details.context?.toDescription(),
      attributes: {if (details.library != null) 'pp.library': details.library},
    );
    if (kDebugMode) previous?.call(details);
  };
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    logger.error('uncaught async error', error, stack, level: LogLevel.fatal);
    return true; // manejado: la app no se cierra
  };
}

final Random _random = Random.secure();

String _hex(int bytes) => List.generate(bytes, (_) => _random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();

/// UUIDv7 (RFC 9562): 48 bits de milisegundos + aleatorio. Es el `X-Request-Id` de cada acción.
String newRequestId([DateTime? now]) {
  final ms = (now ?? DateTime.now()).toUtc().millisecondsSinceEpoch.toRadixString(16).padLeft(12, '0');
  final rand = _hex(10);
  final variant = (8 + _random.nextInt(4)).toRadixString(16);
  return '${ms.substring(0, 8)}-${ms.substring(8, 12)}-7${rand.substring(0, 3)}-$variant${rand.substring(3, 6)}-${rand.substring(6, 18)}';
}

/// Contexto de traza W3C para una petición saliente: `00-<trace-id>-<parent-id>-01`.
class TraceContext {
  TraceContext._(this.traceId, this.spanId);
  factory TraceContext.start() => TraceContext._(_hex(16), _hex(8));
  final String traceId;
  final String spanId;
  String get traceparent => '00-$traceId-$spanId-01';
}
