import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/widgets/barcode_scanner_dialog.dart';

import '../../support/fake_gateway.dart';

/// Defecto del 2026-10-21 (reportado en el Pixel): el diálogo no se dibujaba («Incorrect use of
/// ParentDataWidget» y «BoxConstraints forces an infinite width»). Estas pruebas fallan con el
/// diseño anterior.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget opener(void Function(String?) onResult) => Builder(
        builder: (context) => Center(
          child: TextButton(
            onPressed: () async =>
                onResult(await BarcodeScannerDialog.scan(context, startCamera: false)),
            child: const Text('abrir'),
          ),
        ),
      );

  for (final size in const [Size(360, 800), Size(1280, 800)]) {
    testWidgets('el diálogo se dibuja sin errores al 200 % en ${size.width.toInt()} dp', (tester) async {
      await pumpAt(tester, opener((_) {}), size: size);
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Escanear código de barras'), findsOneWidget);
      expect(find.text('O escribe el código'), findsOneWidget);
      expect(find.textContaining('Geisha'), findsNothing, reason: 'AGENTS §3.1: sin códigos de demostración');
    });
  }

  testWidgets('la entrada manual devuelve el código limpio; vacío no cierra', (tester) async {
    String? result = 'sin respuesta';
    await tester.pumpWidget(harness(opener((r) => result = r)));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Usar este código'));
    await tester.pumpAndSettle();
    expect(find.byType(BarcodeScannerDialog), findsOneWidget, reason: 'vacío no devuelve nada');

    await tester.enterText(find.byType(TextField), '  7501234567893 ');
    await tester.tap(find.text('Usar este código'));
    await tester.pumpAndSettle();
    expect(result, '7501234567893');
    expect(find.byType(BarcodeScannerDialog), findsNothing);
  });

  testWidgets('cerrar devuelve null', (tester) async {
    String? result = 'sin respuesta';
    await tester.pumpWidget(harness(opener((r) => result = r)));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Cerrar'));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });
}
