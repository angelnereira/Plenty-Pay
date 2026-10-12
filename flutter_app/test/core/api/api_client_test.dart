import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/api/consents.dart';
import 'package:plentypay/core/session/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SessionStore session;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    session = SessionStore();
  });

  group('ApiClient — Sesión segura y autenticación (F02.5)', () {
    test('login guarda tokens en SessionStore', () async {
      final client = MockClient((req) async {
        expect(req.url.path, '/v1/auth/login');
        expect(req.method, 'POST');
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['email'], 'comercio@test.co');
        expect(body['password'], 'clave-segura-123');
        return http.Response(
          jsonEncode({
            'access_token': 'access-token-123',
            'refresh_token': 'refresh-token-456',
            'token_type': 'Bearer',
            'expires_in': 900,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);
      await api.login('comercio@test.co', 'clave-segura-123');

      expect(await session.accessToken(), 'access-token-123');
      expect(await session.refreshToken(), 'refresh-token-456');
    });

    test('registerCustomer guarda tokens en SessionStore', () async {
      final client = MockClient((req) async {
        expect(req.url.path, '/v1/auth/register');
        expect(req.method, 'POST');
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['full_name'], 'Carlos Pérez');
        expect(body['email'], 'carlos@test.co');
        return http.Response(
          jsonEncode({
            'access_token': 'access-customer-1',
            'refresh_token': 'refresh-customer-2',
            'token_type': 'Bearer',
            'expires_in': 900,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);
      await api.registerCustomer('Carlos Pérez', 'carlos@test.co', 'clave-segura-123', const [
        ConsentGrant(purpose: ConsentPurpose.ageConfirmation, textVersion: 'v1', granted: true),
        ConsentGrant(purpose: ConsentPurpose.terms, textVersion: 'v1', granted: true),
        ConsentGrant(purpose: ConsentPurpose.privacyDataProcessing, textVersion: 'v1', granted: true),
      ]);

      expect(await session.accessToken(), 'access-customer-1');
      expect(await session.refreshToken(), 'refresh-customer-2');
    });

    test('logout limpia los tokens de SessionStore', () async {
      await session.save(accessToken: 'token-a', refreshToken: 'token-r');
      final api = ApiClient(baseUrl: 'http://localhost:8080', session: session);

      await api.logout();

      expect(await session.accessToken(), isNull);
      expect(await session.refreshToken(), isNull);
    });
  });

  group('ApiClient — 401, refresh único y reintento (F02.5)', () {
    test('401 -> refresh exitoso -> reintento exitoso', () async {
      await session.save(accessToken: 'token-expirado', refreshToken: 'refresh-valido');

      var meCalls = 0;
      var refreshCalls = 0;

      final client = MockClient((req) async {
        if (req.url.path == '/v1/me') {
          meCalls++;
          if (meCalls == 1) {
            // Primer intento: token expirado
            expect(req.headers['authorization'], 'Bearer token-expirado');
            return http.Response(
              jsonEncode({'error': 'token expirado', 'reason': 'UNAUTHENTICATED'}),
              401,
              headers: {'content-type': 'application/json'},
            );
          } else {
            // Reintento: con el token nuevo renovado
            expect(req.headers['authorization'], 'Bearer token-renovado');
            return http.Response(
              jsonEncode({'user_id': 'usr_1', 'role': 'CUSTOMER', 'tenant_id': 'ten_1'}),
              200,
              headers: {'content-type': 'application/json'},
            );
          }
        } else if (req.url.path == '/v1/auth/refresh') {
          refreshCalls++;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['refresh_token'], 'refresh-valido');
          return http.Response(
            jsonEncode({
              'access_token': 'token-renovado',
              'refresh_token': 'refresh-nuevo',
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);
      final me = await api.me();

      expect(me.userId, 'usr_1');
      expect(me.role, 'CUSTOMER');
      expect(meCalls, 2);
      expect(refreshCalls, 1);
      expect(await session.accessToken(), 'token-renovado');
      expect(await session.refreshToken(), 'refresh-nuevo');
    });

    test('401 -> refresh fallido -> borra sesión y falla con ApiException', () async {
      await session.save(accessToken: 'token-expirado', refreshToken: 'refresh-invalido');

      var refreshCalls = 0;

      final client = MockClient((req) async {
        if (req.url.path == '/v1/me') {
          return http.Response(
            jsonEncode({'error': 'token expirado', 'reason': 'UNAUTHENTICATED'}),
            401,
            headers: {'content-type': 'application/json'},
          );
        } else if (req.url.path == '/v1/auth/refresh') {
          refreshCalls++;
          return http.Response(
            jsonEncode({'error': 'refresh token inválido', 'reason': 'INVALID_REFRESH_TOKEN'}),
            401,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);

      await expectLater(
        api.me(),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
      );

      expect(refreshCalls, 1);
      expect(await session.accessToken(), isNull);
      expect(await session.refreshToken(), isNull);
    });

    test('múltiples llamadas 401 concurrentes solo ejecutan un único refresh', () async {
      await session.save(accessToken: 'token-expirado', refreshToken: 'refresh-valido');

      var refreshCalls = 0;

      final client = MockClient((req) async {
        if (req.url.path == '/v1/me' || req.url.path == '/v1/me/permissions') {
          if (req.headers['authorization'] == 'Bearer token-expirado') {
            return http.Response(
              jsonEncode({'error': 'token expirado', 'reason': 'UNAUTHENTICATED'}),
              401,
              headers: {'content-type': 'application/json'},
            );
          }
          if (req.url.path == '/v1/me') {
            return http.Response(
              jsonEncode({'user_id': 'usr_1', 'role': 'CUSTOMER', 'tenant_id': 'ten_1'}),
              200,
              headers: {'content-type': 'application/json'},
            );
          } else {
            return http.Response(
              jsonEncode({'role': 'CUSTOMER', 'enabled_modules': ['wallet'], 'permissions': ['wallet:pay']}),
              200,
              headers: {'content-type': 'application/json'},
            );
          }
        } else if (req.url.path == '/v1/auth/refresh') {
          refreshCalls++;
          // Simular latencia de red en refresh para coincidir con llamadas concurrentes
          await Future<void>.delayed(const Duration(milliseconds: 30));
          return http.Response(
            jsonEncode({
              'access_token': 'token-renovado',
              'refresh_token': 'refresh-nuevo',
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);

      // Disparar me() y permissions() concurrentemente
      final results = await Future.wait([api.me(), api.permissions()]);

      expect((results[0] as Me).userId, 'usr_1');
      expect((results[1] as Permissions).modules, ['wallet']);
      expect(refreshCalls, 1, reason: 'Solo debe ejecutarse un único refresh para peticiones concurrentes');
      expect(await session.accessToken(), 'token-renovado');
    });
  });

  group('ApiClient — Idempotency-Key y cabeceras obligatorias (F02.5)', () {
    test('mutaciones POST llevan Idempotency-Key y X-Request-Id', () async {
      late Map<String, String> capturedHeaders;

      final client = MockClient((req) async {
        capturedHeaders = req.headers;
        return http.Response(
          jsonEncode({'access_token': 'tok', 'refresh_token': 'ref'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);
      await api.registerCustomer('Test', 'test@example.com', 'pass-1234', const []);

      expect(capturedHeaders.containsKey('x-request-id'), isTrue);
      expect(capturedHeaders['x-request-id'], isNotEmpty);
      expect(capturedHeaders.containsKey('traceparent'), isTrue);
    });

    test('permissions devuelve lista tipada y método can()', () async {
      await session.save(accessToken: 'token-valido', refreshToken: 'ref');

      final client = MockClient((req) async {
        return http.Response(
          jsonEncode({
            'role': 'CASHIER',
            'enabled_modules': ['pos'],
            'permissions': ['pos:charge', 'pos:refund'],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiClient(baseUrl: 'http://localhost:8080', client: client, session: session);
      final perms = await api.permissions();

      expect(perms.role, 'CASHIER');
      expect(perms.modules, ['pos']);
      expect(perms.can('pos:charge'), isTrue);
      expect(perms.can('pos:admin'), isFalse);
    });
  });
}
