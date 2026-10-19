import 'dart:convert';
import 'dart:math';

/// F22.2 · Caché de catálogo/precios versionada.
///
/// Regla de 24 h (roadmap F22.2): una entrada más vieja que eso se considera
/// obsoleta. El versionado usa el **número de versión del servidor** (monótono por
/// recurso), no la fecha: si el servidor sube la versión, la entrada vieja se
/// descarta aunque tenga menos de 24 h.
class CacheEntry<T> {
  CacheEntry({required this.key, required this.version, required this.value, required this.storedAt});

  final String key;

  /// Versión declarada por el servidor (`catalog.VERSION`).
  final int version;
  final T value;
  final DateTime storedAt;

  /// Antigüedad en horas; negativa si `storedAt` está en el futuro (reloj movido).
  double ageHours(DateTime now) => now.difference(storedAt).inMinutes / 60.0;

  /// Regla de 24 h: una entrada más vieja se marca obsoleta y la app vuelve al servidor.
  bool isStale(DateTime now, {Duration ttl = _defaultTtl}) => ageHours(now) >= ttl.inMinutes / 60.0;

  Map<String, dynamic> toJson(Object? Function(T) encode) => {
        'key': key,
        'version': version,
        'stored_at': storedAt.toUtc().toIso8601String(),
        'value': encode(value),
      };

  /// Reconstruye una entrada serializada. Es un constructor de fábrica y no un
  /// `static` porque Dart no permite variables de tipo en miembros estáticos.
  factory CacheEntry.fromJson(Map<String, dynamic> json, T Function(dynamic) decode) =>
      CacheEntry<T>(
        key: json['key'] as String,
        version: json['version'] as int,
        value: decode(json['value']),
        storedAt: DateTime.parse(json['stored_at'] as String),
      );
}

const Duration _defaultTtl = Duration(hours: 24);

/// Caché en memoria con descarte por versión y por antigüedad.
///
/// No guarda secretos: solo respuestas GET de catálogo y precios. Si alguna vez
/// guardara un dato sensible, la clave debe entrar en la denegación explícita de
/// §2.16 en vez de apoyarse en esta clase.
class VersionedCache<T> {
  VersionedCache({this.ttl = _defaultTtl});

  final Duration ttl;
  final Map<String, CacheEntry<T>> _entries = {};

  int get length => _entries.length;

  /// Guarda `value` solo si su versión es estrictamente mayor que la guardada.
  ///
  /// Devuelve `true` si la entrada se actualizó. Una versión igual o anterior se
  /// ignora: es la protección contra una respuesta de caché que llega tarde.
  bool put(String key, int version, T value, DateTime now) {
    final current = _entries[key];
    if (current != null && version <= current.version) {
      return false;
    }
    _entries[key] = CacheEntry<T>(key: key, version: version, value: value, storedAt: now);
    return true;
  }

  /// Devuelve la entrada si está vigente. Obsoleta o de versión anterior devuelve `null`
  /// y la app pide al servidor.
  CacheEntry<T>? get(String key, DateTime now, {int? minVersion}) {
    final entry = _entries[key];
    if (entry == null) return null;
    if (entry.isStale(now, ttl: ttl)) return null;
    if (minVersion != null && entry.version < minVersion) return null;
    return entry;
  }

  /// Entrada sin aplicar la regla de 24 h; para el estado vacío de la UI.
  CacheEntry<T>? peek(String key) => _entries[key];

  /// Las entradas más viejas que `ttl` se eliminan. Devuelve cuántas se borraron.
  int evictExpired(DateTime now) {
    final stale = _entries.values.where((e) => e.isStale(now, ttl: ttl)).map((e) => e.key).toList();
    for (final k in stale) {
      _entries.remove(k);
    }
    return stale.length;
  }

  void clear() => _entries.clear();

  String encodeAll(Object? Function(T) encode) =>
      jsonEncode(_entries.values.map((e) => e.toJson(encode)).toList());

  void decodeAll(List<dynamic> json, T Function(dynamic) decode) {
    _entries.clear();
    for (final raw in json) {
      final entry = CacheEntry<T>.fromJson(Map<String, dynamic>.from(raw as Map), decode);
      _entries[entry.key] = entry;
    }
  }
}

/// F22.1 · Outbox local de drift genérico.
///
/// Cola de operaciones pendientes de enviar. Dos garantías:
///
/// 1. **Sin duplicados**: cada entrada lleva su `client_txn_id`; encolar dos veces
///    la misma operación no crea una segunda entrada.
/// 2. **Reintentos ordenados**: se reintenta primero la más antigua, y entre
///    igual antigüedad, la de mayor secuencia.
///
/// El orden importa para el POS y para los marcajes: replayar una venta después de
/// su devolución produce un estado que el servidor nunca vio.
class LocalOutboxEntry {
  LocalOutboxEntry({
    required this.clientTxnId,
    required this.aggregateType,
    required this.operation,
    required this.payload,
    required this.sequence,
    required this.queuedAt,
    this.attempts = 0,
    this.lastError,
    this.nextAttemptAt,
  });

  final String clientTxnId;
  final String aggregateType;

  /// "sale.create" | "attendance.clock" | …
  final String operation;

  /// Cuerpo cifrado: nunca se escribe en claro en el almacenamiento (§2.16).
  final Uint8List payload;
  final int sequence;
  final DateTime queuedAt;
  int attempts;
  String? lastError;
  DateTime? nextAttemptAt;

  bool isReady(DateTime now) => nextAttemptAt == null || !now.isBefore(nextAttemptAt!);
}

typedef Uint8List = List<int>;

/// Cola de salida con deduplicación y reintento ordenado.
class LocalOutbox {
  LocalOutbox({this.baseBackoff = const Duration(seconds: 30)});

  final Duration baseBackoff;
  final List<LocalOutboxEntry> _queue = [];
  final Set<String> _seen = {};

  int get length => _queue.length;
  bool get isEmpty => _queue.isEmpty;

  /// Encola una operación. Devuelve `true` si se añadió; `false` si ya estaba
  /// encolada con el mismo `client_txn_id` (idempotencia local).
  bool enqueue({
    required String clientTxnId,
    required String aggregateType,
    required String operation,
    required List<int> payload,
    required int sequence,
    required DateTime now,
  }) {
    if (_seen.contains(clientTxnId)) return false;
    _seen.add(clientTxnId);
    _queue.add(LocalOutboxEntry(
      clientTxnId: clientTxnId,
      aggregateType: aggregateType,
      operation: operation,
      payload: payload,
      sequence: sequence,
      queuedAt: now,
    ));
    return true;
  }

  /// Las entradas listas para enviar, en orden de reintento: más antigua primero y,
  /// a igual antigüedad, menor secuencia.
  List<LocalOutboxEntry> ready(DateTime now) {
    final ready = _queue.where((e) => e.isReady(now)).toList()
      ..sort((a, b) {
        final byTime = a.queuedAt.compareTo(b.queuedAt);
        return byTime != 0 ? byTime : a.sequence.compareTo(b.sequence);
      });
    return ready;
  }

  /// Marca una entrada como enviada y la retira. El `client_txn_id` sigue en `_seen`
  /// hasta `forget`, de modo que un reintento del mismo evento no la re-encole.
  void complete(String clientTxnId) {
    _queue.removeWhere((e) => e.clientTxnId == clientTxnId);
  }

  /// Registra un fallo y programa el siguiente intento con retroceso exponencial
  /// acotado. Devuelve el instante del siguiente intento.
  DateTime fail(String clientTxnId, String error, DateTime now) {
    final entry = _queue.firstWhere((e) => e.clientTxnId == clientTxnId);
    entry.attempts += 1;
    entry.lastError = error;
    final exponent = entry.attempts.clamp(1, 8);
    final backoff = baseBackoff * pow(2, exponent - 1).toInt();
    final next = now.add(backoff);
    entry.nextAttemptAt = next;
    return next;
  }

  /// Libera el `client_txn_id` para que una operación rechazada de forma definitiva
  /// (por ejemplo, inválida) pueda intentarse de nuevo con datos corregidos.
  void forget(String clientTxnId) => _seen.remove(clientTxnId);

  void clear() {
    _queue.clear();
    _seen.clear();
  }
}