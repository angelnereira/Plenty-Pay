import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/sync/local_sync.dart';

void main() {
  /// F22.2: la regla de 24 h. Una entrada más vieja se marca obsoleta y la app
  /// vuelve al servidor; una reciente sirve desde caché.
  test('F22_2 la entrada caduca a las 24 horas', () {
    final cache = VersionedCache<String>();
    final stored = DateTime.utc(2026, 10, 18, 12);
    cache.put('catalog:v1', 7, 'catálogo', stored);

    expect(cache.get('catalog:v1', stored.add(const Duration(hours: 23))),
        isNotNull,
        reason: 'a las 23 h sigue vigente');
    expect(
        cache.get('catalog:v1', stored.add(const Duration(hours: 24))), isNull,
        reason: 'a las 24 h exacta caduca');
  });

  test('F22_2 peek ignora la regla de 24 h', () {
    final cache = VersionedCache<String>();
    final stored = DateTime.utc(2026, 10, 18, 12);
    cache.put('catalog:v1', 7, 'catálogo', stored);
    final old = stored.add(const Duration(days: 30));
    expect(cache.get('catalog:v1', old), isNull);
    expect(cache.peek('catalog:v1')?.value, 'catálogo',
        reason:
            'la UI puede mostrar el último valor conocido marcándolo como viejo');
  });

  test('F22_2 evictExpired borra solo lo vencido', () {
    final cache = VersionedCache<String>();
    final stored = DateTime.utc(2026, 10, 18, 12);
    cache.put('a', 1, 'a', stored);
    cache.put('b', 1, 'b', stored.add(const Duration(hours: 2)));
    final now = stored.add(const Duration(hours: 25));
    expect(cache.evictExpired(now), 1);
    expect(cache.length, 1);
    expect(cache.peek('a'), isNull);
    expect(cache.peek('b'), isNotNull);
  });

  /// F22.2: una versión de servidor mayor invalida la caché aunque sea reciente.
  test('F22_2 una version mayor invalida la entrada', () {
    final cache = VersionedCache<String>();
    final now = DateTime.utc(2026, 10, 19, 12);
    cache.put('catalog', 7, 'viejo', now);
    expect(cache.put('catalog', 8, 'nuevo', now), isTrue);
    expect(cache.get('catalog', now)?.value, 'nuevo');
  });

  /// F22.2: una respuesta atrasada con versión antigua no pisa la caché.
  test('F22_2 una version antigua se ignora', () {
    final cache = VersionedCache<String>();
    final now = DateTime.utc(2026, 10, 19, 12);
    cache.put('catalog', 8, 'nuevo', now);
    expect(cache.put('catalog', 7, 'viejo', now), isFalse,
        reason: 'una respuesta de caché que llega tarde no degrada el dato');
    expect(cache.get('catalog', now)?.value, 'nuevo');
  });

  test('F22_2 la version por debajo del mínimo no sirve', () {
    final cache = VersionedCache<String>();
    final now = DateTime.utc(2026, 10, 19, 12);
    cache.put('catalog', 6, 'v6', now);
    expect(cache.get('catalog', now, minVersion: 7), isNull);
    expect(cache.get('catalog', now, minVersion: 6), isNotNull);
  });

  test('F22_2 round trip de serializacion', () {
    final cache = VersionedCache<String>();
    final now = DateTime.utc(2026, 10, 19, 12, 30);
    cache.put('catalog', 7, 'catálogo', now);
    final encoded = cache.encodeAll((v) => v);

    final restored = VersionedCache<String>();
    restored.decodeAll(
        jsonDecode(encoded) as List<dynamic>, (v) => v as String);
    expect(restored.peek('catalog')?.version, 7);
    expect(restored.peek('catalog')?.value, 'catálogo');
    expect(restored.peek('catalog')?.storedAt.isUtc, isTrue);
  });

  /// F22.1: encolar dos veces la misma operación no crea una segunda entrada.
  test('F22_1 la outbox no duplica client_txn_id', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    expect(
        outbox.enqueue(
          clientTxnId: 't1',
          aggregateType: 'sale',
          operation: 'sale.create',
          payload: [1, 2, 3],
          sequence: 1,
          now: now,
        ),
        isTrue);
    expect(
        outbox.enqueue(
          clientTxnId: 't1',
          aggregateType: 'sale',
          operation: 'sale.create',
          payload: [1, 2, 3],
          sequence: 1,
          now: now,
        ),
        isFalse);
    expect(outbox.length, 1);
  });

  /// F22.1: al completar no se pierde la deduplicación, para que un reintento del
  /// mismo evento con la misma clave no re-encole.
  test('F22_1 completar no reabre la deduplicacion', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 't1',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 1,
        now: now);
    outbox.complete('t1');
    expect(outbox.length, 0);
    expect(
        outbox.enqueue(
            clientTxnId: 't1',
            aggregateType: 'sale',
            operation: 'sale.create',
            payload: const [],
            sequence: 2,
            now: now),
        isFalse);
  });

  /// `forget` sí libera la clave: una operación rechazada con datos corregidos debe poder
  /// volver a encolarse.
  test('F22_1 forget libera la clave', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 't1',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 1,
        now: now);
    outbox.forget('t1');
    expect(
        outbox.enqueue(
            clientTxnId: 't1',
            aggregateType: 'sale',
            operation: 'sale.create',
            payload: const [],
            sequence: 2,
            now: now),
        isTrue);
  });

  /// F22.1: reintento ordenado — la más antigua primero.
  test('F22_1 la cola reintenta en orden de entrada', () {
    final outbox = LocalOutbox();
    final base = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 'c',
        aggregateType: 'attendance',
        operation: 'attendance.clock',
        payload: const [],
        sequence: 3,
        now: base.add(const Duration(minutes: 5)));
    outbox.enqueue(
        clientTxnId: 'a',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 2,
        now: base);
    outbox.enqueue(
        clientTxnId: 'b',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 1,
        now: base.add(const Duration(minutes: 1)));

    final order = outbox
        .ready(base.add(const Duration(minutes: 10)))
        .map((e) => e.clientTxnId)
        .toList();
    expect(order, ['a', 'b', 'c'],
        reason: 'el orden de replay define el estado final en el servidor');
  });

  /// F22.1: a igual antigüedad manda la secuencia.
  test('F22_1 a igual antiguedad manda la secuencia', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 'l',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 9,
        now: now);
    outbox.enqueue(
        clientTxnId: 'f',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 2,
        now: now);
    final order = outbox.ready(now).map((e) => e.clientTxnId).toList();
    expect(order, ['f', 'l']);
  });

  /// F22.1: el retroceso exponencial acota y programa el siguiente intento.
  test('F22_1 el fallo programa un retroceso exponencial', () {
    final outbox = LocalOutbox(baseBackoff: const Duration(seconds: 30));
    final now = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 't1',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 1,
        now: now);

    final first = outbox.fail('t1', 'timeout', now);
    expect(first.difference(now), const Duration(seconds: 30));

    final second = outbox.fail('t1', 'timeout', first);
    expect(second.difference(first), const Duration(seconds: 60));

    final third = outbox.fail('t1', 'timeout', second);
    expect(third.difference(second), const Duration(seconds: 120));
  });

  /// F22.1: una entrada con retroceso pendiente no se considera lista.
  test('F22_1 una entrada con retroceso no esta lista', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    outbox.enqueue(
        clientTxnId: 't1',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: const [],
        sequence: 1,
        now: now);
    final next = outbox.fail('t1', 'timeout', now);

    expect(outbox.ready(now), isEmpty,
        reason: 'no se reintenta antes de su instante');
    expect(outbox.ready(next).length, 1);
  });

  /// F22.1: el cuerpo va cifrado; la cola no lo interpreta ni lo expone en claro.
  test('F22_1 el payload viaja cifrado y no se lee en claro', () {
    final outbox = LocalOutbox();
    final now = DateTime.utc(2026, 10, 19, 9);
    // Bytes opacos: la cola no sabe qué son.
    final ciphertext = List<int>.generate(32, (i) => (i * 7) % 256);
    outbox.enqueue(
        clientTxnId: 't1',
        aggregateType: 'sale',
        operation: 'sale.create',
        payload: ciphertext,
        sequence: 1,
        now: now);
    expect(outbox.ready(now).first.payload, ciphertext);
  });
}
