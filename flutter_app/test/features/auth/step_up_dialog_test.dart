import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/auth/step_up_dialog.dart';

import '../../support/fake_gateway.dart';

Widget opener(void Function(bool) done) => Builder(
      builder: (context) => TextButton(
        onPressed: () async =>
            done(await StepUpDialog.confirm(context, title: 'Pagar a Café La Esquina', amountMinor: 4125)),
        child: const Text('abrir'),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-GEN-21: muestra la operación y el monto, sin un PIN que la app no puede verificar',
      (tester) async {
    bool? result;
    await tester.pumpWidget(harness(Scaffold(body: opener((v) => result = v))));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    expect(find.text('Confirma que eres tú'), findsOneWidget);
    expect(find.text('Pagar a Café La Esquina'), findsOneWidget);
    expect(find.text(r'$41.25'), findsOneWidget);
    expect(find.byType(TextField), findsNothing, reason: 'el factor lo verifica identity (Q-38), no la app');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
  });

  testWidgets('C-06: "Cancelar" cierra y la operación no se envía', (tester) async {
    bool? result;
    await tester.pumpWidget(harness(Scaffold(body: opener((v) => result = v))));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });

  testWidgets('gravital §15.3: al 200 % en 360 dp sin desbordes', (tester) async {
    await pumpAt(tester, Scaffold(body: opener((_) {})));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
