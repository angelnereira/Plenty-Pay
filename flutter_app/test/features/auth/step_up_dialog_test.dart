import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/widgets/pin_pad.dart';
import 'package:plentypay/features/auth/step_up_dialog.dart';

import '../../support/fake_gateway.dart';

Map<String, Object> challenge({
  String operation = 'payments.intent.create',
  int amount = 4125,
  int level = 2,
  List<String> allowed = const ['PASSKEY', 'PIN'],
  List<String> available = const ['PIN'],
}) =>
    {
      'challenge_id': 'ch-1',
      'operation': operation,
      'amount_minor': '$amount',
      'currency': amount > 0 ? 'USD' : '',
      'level': level,
      'allowed_methods': allowed,
      'available_methods': available,
    };

Widget opener(ApiClient api, void Function(String?) done,
        {String operation = 'payments.intent.create', int amount = 4125}) =>
    Builder(
      builder: (context) => TextButton(
        onPressed: () async => done(await StepUpDialog.obtainToken(context,
            api: api,
            operation: operation,
            amountMinor: amount,
            currency: amount > 0 ? 'USD' : '',
            title: 'Pagar a Café La Esquina')),
        child: const Text('abrir'),
      ),
    );

Future<void> open(WidgetTester tester, ApiClient api, void Function(String?) done,
    {String operation = 'payments.intent.create', int amount = 4125}) async {
  await tester.pumpWidget(harness(Scaffold(
      body: opener(api, done, operation: operation, amount: amount))));
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

Map<String, dynamic> body(http.Request r) => jsonDecode(r.body) as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-GEN-21: la operación y el monto salen del reto; identity verifica el PIN',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'POST /v1/step-up/challenge': (_) => json(challenge()),
      'POST /v1/step-up/verify': (_) => json({'token': 'tok-1', 'method': 'PIN'}),
    }, calls: calls);
    String? token = 'sin-respuesta';
    await open(tester, api, (v) => token = v);

    expect(find.text('Confirma que eres tú'), findsOneWidget);
    expect(find.text('Pago'), findsOneWidget, reason: 'e2 sale de la operación del reto');
    expect(find.text(r'$41.25'), findsOneWidget);
    expect(find.byType(PinPad), findsOneWidget);
    expect(body(calls.first), {'operation': 'payments.intent.create', 'amount_minor': '4125', 'currency': 'USD'});

    await tester.enterText(find.byType(PinPad), '482915');
    await tester.pumpAndSettle();
    final verify = calls.firstWhere((r) => r.url.path == '/v1/step-up/verify');
    expect(body(verify), {'challenge_id': 'ch-1', 'method': 'PIN', 'pin': '482915'});
    expect(token, 'tok-1');
  });

  testWidgets('R28: un PIN equivocado muestra los intentos que informa identity', (tester) async {
    final api = fakeApi({
      'POST /v1/step-up/challenge': (_) => json(challenge()),
      'POST /v1/step-up/verify': (_) => gatewayError(403, 'PIN_INVALID'),
      'GET /v1/me/step-up-pin': (_) => json({'is_set': true, 'attempts_remaining': 2}),
    });
    await open(tester, api, (_) {});
    await tester.enterText(find.byType(PinPad), '000000');
    await tester.pumpAndSettle();
    expect(find.text('PIN incorrecto. Te quedan 2 intentos.'), findsOneWidget);
    expect(tester.widget<PinPad>(find.byType(PinPad)).controller.text, isEmpty);
  });

  testWidgets('R28: PIN bloqueado: muestra la espera y deshabilita el PIN', (tester) async {
    final until = DateTime.now().toUtc().add(const Duration(minutes: 5));
    final api = fakeApi({
      'POST /v1/step-up/challenge': (_) => json(challenge()),
      'POST /v1/step-up/verify': (_) => gatewayError(409, 'PIN_LOCKED'),
      'GET /v1/me/step-up-pin': (_) => json(
          {'is_set': true, 'attempts_remaining': 0, 'locked_until': until.toIso8601String()}),
    });
    await open(tester, api, (_) {});
    await tester.enterText(find.byType(PinPad), '000000');
    await tester.pumpAndSettle();
    expect(find.text('Demasiados intentos. Espera 5 minutos.'), findsOneWidget);
    expect(tester.widget<PinPad>(find.byType(PinPad)).enabled, isFalse);
  });

  testWidgets('R27: en nivel 3 pide la contraseña, no el PIN', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'POST /v1/step-up/challenge': (_) => json(challenge(
          operation: 'identity.pin.set', amount: 0, level: 3,
          allowed: ['PASSWORD'], available: ['PASSWORD'])),
      'POST /v1/step-up/verify': (_) => json({'token': 'tok-3'}),
    }, calls: calls);
    String? token;
    await open(tester, api, (v) => token = v, operation: 'identity.pin.set', amount: 0);
    expect(find.byType(PinPad), findsNothing);
    expect(find.text('Crear o cambiar tu PIN'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'una-clave-muy-larga');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    final verify = calls.firstWhere((r) => r.url.path == '/v1/step-up/verify');
    expect(body(verify)['method'], 'PASSWORD');
    expect(token, 'tok-3');
  });

  testWidgets('S-GEN-21 e7: sin PIN ni passkey ofrece crear el PIN', (tester) async {
    final api = fakeApi({
      'POST /v1/step-up/challenge': (_) => json(challenge(available: const [])),
    });
    await open(tester, api, (_) {});
    expect(find.text('Primero crea tu PIN de confirmación.'), findsOneWidget);
    expect(find.text('Crear PIN'), findsOneWidget);
    expect(find.byType(PinPad), findsNothing);
  });

  testWidgets('C-06: "Cancelar" cierra sin verificar y la operación no se envía', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({'POST /v1/step-up/challenge': (_) => json(challenge())}, calls: calls);
    String? token = 'sin-respuesta';
    await open(tester, api, (v) => token = v);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(token, isNull);
    expect(calls.where((r) => r.url.path == '/v1/step-up/verify'), isEmpty);
  });

  testWidgets('gravital §15.3: al 200 % en 360 dp, oscuro, sin desbordes', (tester) async {
    final api = fakeApi({'POST /v1/step-up/challenge': (_) => json(challenge())});
    await pumpAt(tester, Scaffold(body: opener(api, (_) {})));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    expect(find.byType(PinPad), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
