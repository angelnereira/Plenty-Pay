import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/wallet/receipt.dart';

void main() {
  final paidAt = DateTime.utc(2026, 10, 19, 15, 4);

  ReceiptData fixture() => ReceiptData(
        merchantName: 'Panadería La Esquina',
        merchantTaxId: 'RUC 155-1234-5678',
        operationCode: 'OP-8F3K2Q',
        paidAt: paidAt,
        lines: const [
          ReceiptLine(label: 'Panela con queso', minor: 350),
          ReceiptLine(label: 'Jugo de naranja', minor: 225),
        ],
        totalMinor: 575,
        currencySymbol: r'$',
        customerName: 'Ana Pérez',
        customerMaskedId: 'Cédula •••-•••4567',
        paymentMethodLabel: 'Tarjeta Clave',
      );

  Widget host(Widget child, {Brightness brightness = Brightness.light}) => MaterialApp(
        theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: SingleChildScrollView(child: child)),
      );

  // F23.7 exige golden del recibo.
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('receipt goldens ($brightness)', (tester) async {
      await tester.pumpWidget(host(ReceiptView(data: fixture()), brightness: brightness));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(ReceiptView),
        matchesGoldenFile('goldens/receipt_${brightness.name}.png'),
      );
    });
  }

  testWidgets('el recibo muestra comercio, fecha, líneas y total', (tester) async {
    await tester.pumpWidget(host(ReceiptView(data: fixture())));
    await tester.pumpAndSettle();

    expect(find.text('Panadería La Esquina'), findsOneWidget);
    expect(find.text('RUC 155-1234-5678'), findsOneWidget);
    expect(find.text('Panela con queso'), findsOneWidget);
    expect(find.text(r'$3.50'), findsOneWidget);
    expect(find.text(r'$5.75'), findsOneWidget);
    expect(find.text('Operación OP-8F3K2Q'), findsOneWidget);
  });

  /// N-STD-10: la fecha lleva el mes en texto.
  testWidgets('N-STD-10 la fecha del recibo lleva el mes en texto', (tester) async {
    await tester.pumpWidget(host(ReceiptView(data: fixture())));
    await tester.pumpAndSettle();
    expect(find.textContaining('octubre'), findsOneWidget);
  });

  /// AGENTS.md §2.17: el recibo nunca lleva datos de tarjeta.
  testWidgets('el recibo no contiene datos de tarjeta', (tester) async {
    await tester.pumpWidget(host(ReceiptView(data: fixture())));
    await tester.pumpAndSettle();
    for (final forbidden in ['•••• 1234', 'CVV', 'PIN', 'tok_', '4242']) {
      expect(find.textContaining(forbidden), findsNothing, reason: forbidden);
    }
  });

  /// La cédula del pagador llega enmascarada y se muestra como llegó.
  testWidgets('la cedula del pagador se muestra enmascarada', (tester) async {
    await tester.pumpWidget(host(ReceiptView(data: fixture())));
    await tester.pumpAndSettle();
    expect(find.text('Cédula •••-•••4567'), findsOneWidget);
  });

  // F24.1: el ancho del ticket y el formato ESC/POS.
  test('F24_1 el layout declara el ancho de 80 mm', () {
    const layout = ReceiptPrintLayout();
    expect(layout.width, receiptWidth);
    expect(layout.escPosFormat(), '80mm');
    expect(layout.fitsInWidth(receiptWidth), isTrue);
    expect(layout.fitsInWidth(receiptWidth + 1), isFalse);
  });

  test('F24_1 el comando de corte cierra el ticket', () {
    const layout = ReceiptPrintLayout();
    expect(layout.escPosCutCommand(), contains('\x1dV'));
  });

  // El recibo compartido es texto plano estable, con fechas UTC e importes enteros.
  test('el recibo en texto plano usa ISO 8601 UTC e importes enteros', () {
    final text = encodeReceiptPlainText(fixture());
    expect(text, contains('paid_at=2026-10-19T15:04:00.000Z'));
    expect(text, contains('total=575'));
    expect(text, contains('item="Panela con queso":350'));
    expect(text, contains(r'currency=$'));
  });

  test('el recibo en texto plano no lleva datos de tarjeta', () {
    final text = encodeReceiptPlainText(fixture()).toLowerCase();
    for (final forbidden in ['cvv', 'pin', 'card_number', 'tok_']) {
      expect(text, isNot(contains(forbidden)), reason: forbidden);
    }
  });

  test('el recibo en texto plano es JSON-safe en las etiquetas', () {
    // Una etiqueta con comillas no rompe el formato.
    final data = ReceiptData(
      merchantName: 'Tienda',
      merchantTaxId: 'RUC 1',
      operationCode: 'OP1',
      paidAt: paidAt,
      lines: const [ReceiptLine(label: 'Producto "especial", grande', minor: 100)],
      totalMinor: 100,
      currencySymbol: r'$',
    );
    final line = encodeReceiptPlainText(data).split('\n').firstWhere((l) => l.startsWith('item='));
    final parsed = line.substring('item='.length);
    // La etiqueta va entrecomillada y con JSON escapado: parseable de vuelta.
    expect(jsonDecode(parsed.substring(0, parsed.lastIndexOf(':'))), 'Producto "especial", grande');
  });

  // Accesibilidad: el recibo no se corta con el texto al 200 %.
  testWidgets('el recibo no se corta con el texto al 200 por ciento', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: host(ReceiptView(data: fixture())),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text(r'$5.75'), findsOneWidget);
  });
}