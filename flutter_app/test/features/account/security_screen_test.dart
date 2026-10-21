import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/pin_pad.dart';
import 'package:plentypay/features/account/security_screen.dart';

import '../../support/fake_gateway.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-GEN-10 e6: el estado del PIN sale de identity', (tester) async {
    final api = fakeApi({
      'GET /v1/me/step-up-pin': (_) => json({'is_set': false, 'attempts_remaining': 0}),
    });
    await tester.pumpWidget(harness(SecurityScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('PIN de confirmación'), findsOneWidget);
    expect(find.text('Sin configurar'), findsOneWidget);
    expect(find.text('Cambiar contraseña'), findsOneWidget);
    expect(find.textContaining('Nivel de protección'), findsNothing,
        reason: 'no se muestra un nivel fijo (hallazgo B9)');
  });

  testWidgets('R28: crear el PIN pide la contraseña (nivel 3) y lo envía con el token', (tester) async {
    var pinSet = false;
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/me/step-up-pin': (_) => json({'is_set': pinSet, 'attempts_remaining': 3}),
      'POST /v1/step-up/challenge': (_) => json({
            'challenge_id': 'ch-pin',
            'operation': 'identity.pin.set',
            'amount_minor': '0',
            'level': 3,
            'allowed_methods': ['PASSWORD'],
            'available_methods': ['PASSWORD'],
          }),
      'POST /v1/step-up/verify': (_) => json({'token': 'tok-pin'}),
      'PUT /v1/me/step-up-pin': (_) {
        pinSet = true;
        return json({'success': true});
      },
    }, calls: calls);
    await tester.pumpWidget(harness(SecurityScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('PIN de confirmación'));
    await tester.pumpAndSettle();

    final pads = find.byType(PinPad);
    await tester.enterText(pads.at(0), '482915');
    await tester.enterText(pads.at(1), '482916');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar PIN'));
    await tester.pumpAndSettle();
    expect(find.text('Los PIN no coinciden.'), findsOneWidget);
    expect(calls.where((r) => r.url.path == '/v1/step-up/challenge'), isEmpty);

    await tester.enterText(find.byType(PinPad).at(1), '482915');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar PIN'));
    await tester.pumpAndSettle();
    expect(find.text('Crear o cambiar tu PIN'), findsOneWidget);
    await tester.enterText(find.byType(TextField).last, 'una-clave-muy-larga');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final put = calls.firstWhere((r) => r.method == 'PUT');
    expect(put.headers['X-Step-Up-Token'] ?? put.headers['x-step-up-token'], 'tok-pin');
    expect(jsonDecode(put.body), {'pin': '482915'});
    await tester.pump(const Duration(seconds: 1)); // la recarga del estado llega tras cerrar la hoja
    await tester.pumpAndSettle();
    expect(find.text('Configurado'), findsOneWidget);
  });

  testWidgets('gravital §15.3: al 200 % en 360 dp, oscuro, sin desbordes', (tester) async {
    final api = fakeApi({
      'GET /v1/me/step-up-pin': (_) => json({'is_set': true, 'attempts_remaining': 3}),
    });
    await pumpAt(tester, SecurityScreen(api: api));
    expect(find.text('Configurado'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
