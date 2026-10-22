import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/pin_pad.dart';
import 'package:plentypay/features/pos/pos_data.dart';
import 'package:plentypay/features/pos/pos_receipt_screen.dart';
import 'package:plentypay/features/pos/pos_refund_screen.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

Map<String, Object> money(int minor) =>
    {'amount_minor': '$minor', 'currency': 'USD'};

Map<String, Object> tender(String rail, int minor) => {
      'rail': 'PAYMENT_RAIL_$rail',
      'amount': money(minor),
      'status': 'CAPTURED',
    };

/// Venta de 3 unidades por $10.00 (ITBMS 7 %) pagada con efectivo y saldo.
Map<String, Object> mixedSale(
        {String status = 'PAID', int refundedMilli = 0, int refunded = 0}) =>
    {
      ...sale(status, receipt: '00000042', total: 1000, tenders: [
        tender('CASH', 500),
        tender('WALLET', 500),
      ]),
      'lines': [
        {
          'line_id': 'l1',
          'product_id': cafeId,
          'description': 'Café 250 g',
          'quantity_milli': '3000',
          'unit_price': money(333),
          'tax_rate_bps': 700,
          'line_total': money(1000),
          'refunded_milli': '$refundedMilli',
          'refunded': money(refunded),
        }
      ],
      'refunded': money(refunded),
    };

/// Pantalla alta: los ListView construyen solo lo visible.
void tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('R9 vista previa igual a la del servidor', () {
    test(
        'R9: una unidad de tres es proporcional half_up; la última toma el resto exacto',
        () {
      final s = SaleItem.fromJson(mixedSale());
      expect(refundPreview(s, {'l1': 1000}).totalMinor, 333);
      final after = SaleItem.fromJson(mixedSale(
          status: 'PARTIALLY_REFUNDED', refundedMilli: 2000, refunded: 667));
      expect(refundPreview(after, {'l1': 1000}).totalMinor, 333,
          reason: '1000 − 667: la suma de devoluciones nunca pasa del total');
    });

    test(
        'R9: el reintegro sale del último medio pagado hacia atrás, contando lo ya devuelto',
        () {
      final s = SaleItem.fromJson(mixedSale());
      expect(
          refundPreview(s, {'l1': 2000}).byRail, {'WALLET': 500, 'CASH': 167});
      final after = SaleItem.fromJson(mixedSale(
          status: 'PARTIALLY_REFUNDED', refundedMilli: 1000, refunded: 333));
      expect(refundPreview(after, {'l1': 1000}).byRail,
          {'WALLET': 167, 'CASH': 166},
          reason: 'el saldo ya reintegró 333; le quedan 167');
    });
  });

  group('S-POS-08 Devolución', () {
    testWidgets(
        'R9 e1–e6: elige una unidad, «Defectuoso» apaga el reingreso, confirma con step-up atado al monto',
        (tester) async {
      tall(tester);
      final calls = <http.Request>[];
      final api = fakeApi({
        'POST /v1/step-up/challenge': (_) => json({
              'challenge_id': 'ch-1',
              'operation': 'pos.sale.void',
              'amount_minor': '333',
              'currency': 'USD',
              'level': 2,
              'allowed_methods': ['PASSKEY', 'PIN'],
              'available_methods': ['PIN'],
            }),
        'POST /v1/step-up/verify': (_) => json({'token': 'tok-1'}),
        'POST /v1/pos/sales/$saleId/refund': (_) => json(mixedSale(
            status: 'PARTIALLY_REFUNDED', refundedMilli: 1000, refunded: 333)),
      }, calls: calls);
      SaleItem? result;
      await tester.pumpWidget(harness(Scaffold(
          body: Builder(
              builder: (context) => TextButton(
                  onPressed: () async {
                    result = await Navigator.of(context).push<SaleItem>(
                        MaterialPageRoute(
                            builder: (_) => PosRefundScreen(
                                api: api,
                                sale: SaleItem.fromJson(mixedSale()))));
                  },
                  child: const Text('abrir'))))));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();

      expect(find.text('Vendido 3 · ya devuelto 0'), findsOneWidget);
      await tester.tap(find.byTooltip('Devolver uno más de Café 250 g'));
      await tester.pumpAndSettle();
      expect(find.text(r'Por el mismo medio: Saldo PlentyPay $3.33'),
          findsOneWidget);
      // Sin motivo no se puede devolver.
      final submit = find.text(r'Devolver $3.33');
      expect(submit, findsOneWidget);
      await tester.tap(find.text('Defectuoso'));
      await tester.pumpAndSettle();
      final restock =
          tester.widget<SwitchListTile>(find.byType(SwitchListTile));
      expect(restock.value, isFalse,
          reason: 'e3: Defectuoso no regresa al inventario');

      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await settle(tester);
      expect(find.text('Confirma que eres tú'), findsOneWidget);
      await tester.enterText(find.byType(PinPad), '482915');
      await tester.pump(const Duration(milliseconds: 600));
      await settle(tester);

      final challenge =
          calls.firstWhere((r) => r.url.path == '/v1/step-up/challenge');
      expect(jsonDecode(challenge.body),
          containsPair('operation', 'pos.sale.void'));
      expect(jsonDecode(challenge.body)['amount_minor'].toString(), '333');
      final refund = calls
          .singleWhere((r) => r.url.path == '/v1/pos/sales/$saleId/refund');
      expect(jsonDecode(refund.body), {
        'lines': [
          {'line_id': 'l1', 'quantity_milli': '1000'}
        ],
        'reason': 'DEFECTIVE',
        'restock': false,
      });
      expect(
          refund.headers['X-Step-Up-Token'] ??
              refund.headers['x-step-up-token'],
          'tok-1');
      expect(
          refund.headers['Idempotency-Key'] ??
              refund.headers['idempotency-key'],
          isNotEmpty);
      await settle(tester);
      expect(result?.status, 'PARTIALLY_REFUNDED');
      expect(find.text(r'Devolución registrada: $3.33.'), findsOneWidget);
    });

    testWidgets(
        'R9 EXCEEDS_SOLD_QTY: muestra el mensaje traducido y no sale de la pantalla',
        (tester) async {
      tall(tester);
      final api = fakeApi({
        'POST /v1/step-up/challenge': (_) => json({
              'challenge_id': 'ch-1',
              'operation': 'pos.sale.void',
              'amount_minor': '1000',
              'currency': 'USD',
              'level': 2,
              'allowed_methods': ['PIN'],
              'available_methods': ['PIN'],
            }),
        'POST /v1/step-up/verify': (_) => json({'token': 'tok-1'}),
        'POST /v1/pos/sales/$saleId/refund': (_) =>
            gatewayError(422, 'EXCEEDS_SOLD_QTY'),
      });
      await tester.pumpWidget(harness(
          PosRefundScreen(api: api, sale: SaleItem.fromJson(mixedSale()))));
      await tester.pumpAndSettle();
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byTooltip('Devolver uno más de Café 250 g'));
        await tester.pumpAndSettle();
      }
      expect(
          tester
              .widget<IconButton>(find.widgetWithIcon(IconButton, Icons.add))
              .onPressed,
          isNull,
          reason: 'no se elige más de lo pendiente');
      await tester.tap(find.text('Cambio'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text(r'Devolver $10.00'));
      await tester.tap(find.text(r'Devolver $10.00'));
      await settle(tester);
      await tester.enterText(find.byType(PinPad), '482915');
      await tester.pump(const Duration(milliseconds: 600));
      await settle(tester);
      expect(
          find.text('No puedes devolver más de lo vendido.'), findsOneWidget);
    });
  });

  group('S-POS-05/07 con devoluciones', () {
    testWidgets(
        '«Devolver» solo con pos:refund y venta devolvible; lo devuelto se ve en el recibo',
        (tester) async {
      tall(tester);
      final partial = SaleItem.fromJson(mixedSale(
          status: 'PARTIALLY_REFUNDED', refundedMilli: 1000, refunded: 333));
      await tester.pumpWidget(harness(PosReceiptScreen(
          api: fakeApi({}),
          sale: partial,
          terminalLabel: 'Caja 1',
          canRefund: true)));
      await tester.pumpAndSettle();
      expect(find.text('Devolver'), findsOneWidget);
      expect(find.text(r'Café 250 g · Devuelto 1: $3.33'), findsOneWidget);
      expect(find.text('Devuelto'), findsOneWidget);

      await tester.pumpWidget(harness(PosReceiptScreen(
          api: fakeApi({}), sale: partial, terminalLabel: 'Caja 1')));
      await tester.pumpAndSettle();
      expect(find.text('Devolver'), findsNothing, reason: 'sin pos:refund');

      await tester.pumpWidget(harness(PosReceiptScreen(
          api: fakeApi({}), sale: partial, terminalLabel: '')));
      await tester.pumpAndSettle();
      expect(find.textContaining(RegExp(r' · $')), findsNothing,
          reason: 'sin nombre de caja no queda un separador colgando');

      final full = SaleItem.fromJson(
          mixedSale(status: 'REFUNDED', refundedMilli: 3000, refunded: 1000));
      await tester.pumpWidget(harness(PosReceiptScreen(
          api: fakeApi({}),
          sale: full,
          terminalLabel: 'Caja 1',
          canRefund: true)));
      await tester.pumpAndSettle();
      expect(find.text('Devolver'), findsNothing,
          reason: 'ya se devolvió todo');
      expect(full.hasReceipt, isTrue);
    });
  });
}
