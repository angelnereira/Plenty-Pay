import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/session/session_store.dart';
import 'package:plentypay/core/theme/app_theme.dart';

/// Respuesta del gateway para una ruta `MÉTODO /path`.
typedef FakeRoute = http.Response Function(http.Request req);

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status,
        headers: {'content-type': 'application/json'});

http.Response gatewayError(int status, String reason) => json(
    {'reason': reason, 'message': reason, 'request_id': 'req-test'}, status);

/// Cliente con un gateway de prueba: cada petición se responde con [routes] (clave
/// `GET /v1/wallet/balance`); lo no declarado es un 404. Guarda las peticiones en [calls].
ApiClient fakeApi(Map<String, FakeRoute> routes, {List<http.Request>? calls}) {
  FlutterSecureStorage.setMockInitialValues({});
  return ApiClient(
    baseUrl: 'http://localhost:8080',
    session: SessionStore(),
    client: MockClient((req) async {
      calls?.add(req);
      final r = routes['${req.method} ${req.url.path}'];
      return r != null ? r(req) : gatewayError(404, 'NOT_FOUND');
    }),
  );
}

Widget harness(Widget home, {Locale locale = const Locale('es', 'PA')}) =>
    MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    );

Map<String, Object> balance(int available, {int held = 0}) => {
      'account': {
        'party_id': 'u-1',
        'type': 'ACCOUNT_TYPE_WALLET',
        'currency': 'USD',
        'scope_id': ''
      },
      'posted_minor': '${available + held}',
      'held_minor': '$held',
      'available_minor': '$available',
    };

/// gravital §15.3: pantalla en [size] con tema oscuro o claro y texto escalado.
Future<void> pumpAt(WidgetTester tester, Widget screen,
    {Brightness brightness = Brightness.dark,
    double textScale = 2,
    Size size = const Size(360, 800)}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    locale: const Locale('es', 'PA'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: MediaQuery(
      data:
          MediaQueryData(size: size, textScaler: TextScaler.linear(textScale)),
      child: screen,
    ),
  ));
  await tester.pumpAndSettle();
}
