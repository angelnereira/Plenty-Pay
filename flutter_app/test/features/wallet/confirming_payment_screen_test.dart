import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/pay/qr_scanner.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/wallet/confirming_payment_screen.dart';

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      );

  /// F23.4: un pago `UNKNOWN` muestra "estamos confirmando", nunca "falló".
  testWidgets('F23.4 UNKNOWN nunca se muestra como fallo', (tester) async {
    await tester.pumpWidget(host(const ConfirmingPaymentScreen(
      display: PaymentDisplay.unknown,
      amountMinor: 2500,
      merchantName: 'Panadería La Esquina',
    )));
    await tester.pumpAndSettle();

    expect(find.text('Estamos confirmando tu pago'), findsOneWidget);
    expect(find.text('No se pudo completar el pago'), findsNothing);
    expect(find.text('Confirmando'), findsOneWidget);
    expect(find.text(r'$25.00'), findsOneWidget);
    expect(find.text('Panadería La Esquina'), findsOneWidget);
  });

  /// F23.4: `PENDING` se comporta igual que `UNKNOWN` para el usuario.
  testWidgets('F23.4 PENDING se muestra como confirmando', (tester) async {
    await tester.pumpWidget(host(const ConfirmingPaymentScreen(
      display: PaymentDisplay.pending,
      amountMinor: 1000,
      merchantName: 'Tienda',
    )));
    await tester.pumpAndSettle();
    expect(find.text('Estamos confirmando tu pago'), findsOneWidget);
    expect(find.text('Pendiente'), findsOneWidget);
  });

  /// F23.4: un estado que la app no conoce se degrada a "confirmando".
  testWidgets('F23.4 un estado desconocido se muestra como confirmando', (tester) async {
    final display = paymentDisplayFor('WAT');
    expect(display, PaymentDisplay.unknown);

    await tester.pumpWidget(host(ConfirmingPaymentScreen(
      display: display,
      amountMinor: 1000,
      merchantName: 'Tienda',
    )));
    await tester.pumpAndSettle();
    expect(find.text('No se pudo completar el pago'), findsNothing);
  });

  /// F23.4: solo un fallo definitivo cambia el tono y la acción.
  testWidgets('F23.4 un fallo definitivo cambia el mensaje y la accion', (tester) async {
    await tester.pumpWidget(host(const ConfirmingPaymentScreen(
      display: PaymentDisplay.failed,
      amountMinor: 2500,
      merchantName: 'Panadería La Esquina',
    )));
    await tester.pumpAndSettle();
    expect(find.text('No se pudo completar el pago'), findsOneWidget);
    expect(find.text('No completado'), findsOneWidget);
    expect(find.text('Listo'), findsOneWidget);
  });

  /// F23.4: un solo botón filled por pantalla.
  testWidgets('F23.4 un solo boton filled por pantalla', (tester) async {
    await tester.pumpWidget(host(const ConfirmingPaymentScreen(
      display: PaymentDisplay.unknown,
      amountMinor: 100,
      merchantName: 'Tienda',
    )));
    await tester.pumpAndSettle();
    expect(find.byType(FilledButton), findsNothing);
    expect(find.byType(OutlinedButton), findsOneWidget,
        reason: 'mientras se confirma la acción es secundaria, no destructiva');
  });

  /// F23.1: el aviso de QR rechazado muestra el mensaje traducido y nada del contenido.
  testWidgets('F23.1 el aviso de QR rechazado no filtra el contenido', (tester) async {
    final result = parsePaymentQr('https://evil.com/t/ABCD1234');
    await tester.pumpWidget(host(QrRejectedScreen(message: result.message!)));
    await tester.pumpAndSettle();

    expect(find.text(result.message!), findsOneWidget);
    expect(find.textContaining('evil.com'), findsNothing);
    expect(find.textContaining('ABCD1234'), findsNothing);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  /// F23.1: un QR de host desconocido dice explícitamente que no es de PlentyPay.
  testWidgets('F23.1 el aviso dice que el codigo no es de PlentyPay', (tester) async {
    final result = parsePaymentQr('https://evil.com/t/ABCD1234');
    expect(result.message, contains('no es de PlentyPay'));
  });

  /// Accesibilidad: texto al 200 % sin cortes en la pantalla de confirmación.
  testWidgets('F23.4 texto al 200 por ciento sin cortes', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: host(const ConfirmingPaymentScreen(
        display: PaymentDisplay.unknown,
        amountMinor: 123456789,
        merchantName: 'Comercio con nombre muy largo para probar el ajuste de línea',
      )),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text(r'$1,234,567.89'), findsOneWidget);
  });
}