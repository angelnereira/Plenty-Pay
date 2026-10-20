import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/config/server_discovery.dart';
import 'package:plentypay/core/observability/app_logger.dart';
import 'package:plentypay/core/session/session_store.dart';

const _old = 'https://old-dead-tunnel.trycloudflare.com';
const _new = 'https://fresh-live-tunnel.trycloudflare.com';

ServerDiscovery discoveryWith(http.Response Function(http.Request) respond,
        {QueueSink? sink, Duration timeout = const Duration(seconds: 4)}) =>
    ServerDiscovery(
      flavor: 'prod',
      client: MockClient((req) async => respond(req)),
      logger: sink == null ? null : AppLogger(sinks: [sink]),
      timeout: timeout,
    );

http.Response doc(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

void main() {
  group('ADR 0019 §3 documento de descubrimiento', () {
    test('ADR 0019 una URL https de túnel válida se acepta', () async {
      final d = discoveryWith((_) => doc({'api_base_url': '$_new/'}));
      expect(await d.discover(), _new);
    });

    test(
        'ADR 0019 un host fuera de la lista permitida se rechaza y se registra',
        () async {
      final sink = QueueSink();
      final d = discoveryWith(
          (_) => doc({'api_base_url': 'https://evil.example.com'}),
          sink: sink);
      expect(await d.discover(), isNull);
      final r = sink.records.single;
      expect(r.msg, 'server discovery failed');
      expect(r.attributes['error.type'], 'host not allowed');
    });

    test('ADR 0019 http en claro se rechaza fuera de dev', () async {
      final d = discoveryWith(
          (_) => doc({'api_base_url': 'http://x.trycloudflare.com'}));
      expect(await d.discover(), isNull);
    });

    test('ADR 0019 un sufijo sin subdominio no basta', () async {
      final d = discoveryWith(
          (_) => doc({'api_base_url': 'https://.trycloudflare.com'}));
      expect(await d.discover(), isNull);
    });

    test('ADR 0019 404, JSON inválido y campo ausente devuelven null',
        () async {
      final sink = QueueSink();
      expect(await discoveryWith((_) => doc({}, 404), sink: sink).discover(),
          isNull);
      expect(
          await discoveryWith((_) => http.Response('<html>', 200), sink: sink)
              .discover(),
          isNull);
      expect(await discoveryWith((_) => doc({'x': 1}), sink: sink).discover(),
          isNull);
      expect(sink.records.map((r) => r.attributes['error.type']),
          ['http 404', 'invalid document', 'missing api_base_url']);
    });

    test('ADR 0019 sin respuesta a tiempo devuelve null', () async {
      final sink = QueueSink();
      final d = ServerDiscovery(
        flavor: 'prod',
        client: MockClient((_) => Completer<http.Response>().future),
        logger: AppLogger(sinks: [sink]),
        timeout: const Duration(milliseconds: 20),
      );
      expect(await d.discover(), isNull);
      expect(sink.records.single.attributes['error.type'], 'timeout');
    });

    test(
        'ADR 0019 la consulta cambia por minuto para saltar la caché de la CDN',
        () async {
      Uri? asked;
      await discoveryWith((req) {
        asked = req.url;
        return doc({'api_base_url': _new});
      }).discover();
      expect(asked!.queryParameters.keys, contains('m'));
    });
  });

  test('ADR 0019 §2 orden: manual → descubierta → última → build', () {
    expect(
        resolveBaseUrl(
            manual: 'm', discovered: 'd', lastDiscovered: 'l', built: 'b'),
        'm');
    expect(
        resolveBaseUrl(discovered: 'd', lastDiscovered: 'l', built: 'b'), 'd');
    expect(resolveBaseUrl(manual: '', lastDiscovered: 'l', built: 'b'), 'l');
    expect(resolveBaseUrl(built: 'b'), 'b');
  });

  test('ADR 0019 §6 los túneles rápidos son efímeros', () {
    expect(isEphemeralTunnel(_old), isTrue);
    expect(isEphemeralTunnel('http://192.168.1.10:8080'), isFalse);
  });

  group('ADR 0019 §4 reconexión en plena sesión', () {
    late List<http.Request> calls;
    late int rediscoveries;

    ApiClient client({String? next = _new}) {
      FlutterSecureStorage.setMockInitialValues({});
      calls = [];
      rediscoveries = 0;
      return ApiClient(
        baseUrl: _old,
        session: SessionStore(),
        rediscover: () async {
          rediscoveries++;
          return next;
        },
        client: MockClient((req) async {
          calls.add(req);
          if (req.url.host == Uri.parse(_old).host) {
            return http.Response('error code: 1033', 530);
          }
          return http.Response(
              jsonEncode({
                'balance': {'amount_minor': '0'}
              }),
              200,
              headers: {'content-type': 'application/json'});
        }),
      );
    }

    test('ADR 0019 un 530 del túnel descubre la URL nueva y reintenta allí',
        () async {
      final api = client();
      await api.walletBalance();
      expect(api.baseUrl, _new);
      expect(calls.map((r) => r.url.host),
          [Uri.parse(_old).host, Uri.parse(_new).host]);
      expect(rediscoveries, 1);
    });

    test('ADR 0019 el reintento de una mutación conserva su Idempotency-Key',
        () async {
      final api = client();
      await api.createTopup(
          amountMinor: 5000,
          rail: 'PAYMENT_RAIL_YAPPY',
          idempotencyKey: 'topup-test-key-0001');
      expect(calls, hasLength(2));
      expect(calls[1].headers['idempotency-key'],
          calls[0].headers['idempotency-key']);
    });

    test(
        'ADR 0019 si la URL no cambió no reintenta y se consulta una vez cada 30 s',
        () async {
      final api = client(next: _old);
      await expectLater(api.walletBalance(), throwsA(anything));
      await expectLater(api.walletBalance(), throwsA(anything));
      expect(rediscoveries, 1);
      expect(calls, hasLength(2));
    });
  });
}
