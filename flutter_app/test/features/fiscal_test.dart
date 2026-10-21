import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/features/finance/finance_screen.dart';
import 'package:plentypay/features/finance/taxpayers_screen.dart';
import 'package:plentypay/features/fiscal/fiscal_data.dart';
import 'package:plentypay/features/fiscal/fiscal_profile_screen.dart';
import 'package:plentypay/features/fiscal/invoices_screen.dart';

import '../support/fake_gateway.dart';

const tenantId = '01900000-0000-7000-8000-0000000000a1';
const invoiceId = '01900000-0000-7000-8000-0000000000f1';

Map<String, Object> profile({String env = 'DEMO'}) => {
      'tenant_id': tenantId,
      'environment': env,
      'checkout_preference': 'CHECKOUT_PREFERENCE_ALWAYS_FISCAL',
      'branch_code': '0000',
      'point_of_sale_code': '001',
      'pac_provider': 'simulator',
    };

Map<String, Object> money(int v) => {'amount_minor': '$v', 'currency': 'USD'};

Map<String, Object> invoice(
        {String status = 'INVOICE_STATUS_ACCEPTED',
        String cufe = 'DEMO-abc123'}) =>
    {
      'invoice_id': invoiceId,
      'tenant_id': tenantId,
      'document_type': 'DOCUMENT_TYPE_FISCAL_INVOICE',
      'status': status,
      'folio_number': '001-7',
      'cufe': status == 'INVOICE_STATUS_ACCEPTED' ? cufe : '',
      'qr_url': status == 'INVOICE_STATUS_ACCEPTED'
          ? 'PLENTYPAY DOCUMENTO DE PRUEBA SIN VALIDEZ FISCAL $cufe'
          : '',
      'subtotal': money(6175),
      'tax': money(432),
      'total': money(6607),
      'lines': [
        {
          'description': 'Café 250 g',
          'quantity_milli': '2000',
          'unit_price': money(1850),
          'tax_rate_bps': 700
        },
      ],
      'issued_at': '2026-10-21T15:00:00Z',
    };

Map<String, dynamic> body(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-FIN-07: sin perfil fiscal, enlaza al perfil (PROFILE_MISSING)',
      (tester) async {
    final api = fakeApi({
      'GET /v1/fiscal/profile': (_) => gatewayError(409, 'PROFILE_MISSING')
    });
    await tester.pumpWidget(harness(InvoicesScreen(api: api, canIssue: true)));
    await tester.pumpAndSettle();
    expect(
        find.text('Completa tu perfil fiscal para facturar.'), findsOneWidget);
    expect(find.text('Perfil fiscal'), findsOneWidget);
    expect(find.text('Nueva factura'), findsNothing);
  });

  testWidgets(
      'S-FIN-07 / R9: en pruebas muestra la franja y los documentos reales',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/fiscal/profile': (_) => json(profile()),
      'GET /v1/fiscal/invoices': (_) => json({
            'invoices': [invoice()],
            'page': {'next_page_token': ''}
          }),
    }, calls: calls);
    await tester.pumpWidget(harness(InvoicesScreen(api: api)));
    await tester.pumpAndSettle();
    expect(
        find.text('Modo de prueba: los documentos no tienen validez fiscal.'),
        findsOneWidget);
    expect(find.text('Factura 001-7'), findsOneWidget);
    expect(find.text(r'$66.07'), findsOneWidget);
    expect(find.text('Autorizada'), findsOneWidget);
    expect(find.text('Nueva factura'), findsNothing,
        reason: 'sin fiscal:issue no se ofrece emitir (C-12)');
    await tester.tap(find.text('Todos los estados').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rechazada').last);
    await tester.pumpAndSettle();
    expect(calls.last.url.queryParameters['status'], 'INVOICE_STATUS_REJECTED');
  });

  testWidgets(
      'S-FIN-07 e2/e7: autorizada muestra CUFE y permite notas; en cola dice que se está autorizando',
      (tester) async {
    final api =
        fakeApi({'GET /v1/fiscal/invoices/$invoiceId': (_) => json(invoice())});
    await tester.pumpWidget(harness(
        InvoiceDetailScreen(api: api, invoiceId: invoiceId, canNote: true)));
    await tester.pumpAndSettle();
    expect(find.text('DEMO-abc123'), findsOneWidget);
    expect(find.text('Emitir nota de crédito'), findsOneWidget);
    expect(find.text('Comprobante en proceso de autorización.'), findsNothing);

    final queued = fakeApi({
      'GET /v1/fiscal/invoices/$invoiceId': (_) =>
          json(invoice(status: 'INVOICE_STATUS_QUEUED'))
    });
    await tester.pumpWidget(harness(InvoiceDetailScreen(
        key: const ValueKey('en-cola'),
        api: queued,
        invoiceId: invoiceId,
        canNote: true)));
    await tester.pumpAndSettle();
    expect(find.text('Comprobante en proceso de autorización.'), findsOneWidget,
        reason: 'N-FIS-05: antes de autorizada no se presenta como factura');
    expect(find.text('Emitir nota de crédito'), findsNothing);
  });

  testWidgets(
      'S-FIN-07: nueva factura calcula la vista previa y la emite con su clave',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/catalog/tax-rates': (_) => json({
            'rates': [
              {'kind': 'STANDARD', 'rate_bps': 700},
            ]
          }),
      'POST /v1/fiscal/invoices': (_) =>
          json(invoice(status: 'INVOICE_STATUS_QUEUED')),
    }, calls: calls);
    await tester.pumpWidget(harness(Builder(
        builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => NewInvoiceScreen(api: api))),
            child: const Text('abrir')))));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Café 250 g');
    await tester.enterText(fields.at(1), '2');
    await tester.enterText(fields.at(2), '18.50');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Exento').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('7 %').last);
    await tester.pumpAndSettle();
    expect(find.text(r'$39.59'), findsOneWidget, reason: '37.00 + ITBMS 2.59');
    await tester.ensureVisible(find.text('Emitir factura'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Emitir factura'));
    await tester.pumpAndSettle();
    final post = calls.firstWhere((r) => r.method == 'POST');
    final b = body(post);
    expect(b['lines'], [
      {
        'description': 'Café 250 g',
        'quantity_milli': '2000',
        'unit_price': {'amount_minor': '1850', 'currency': 'USD'},
        'tax_rate_bps': 700,
      }
    ]);
    expect(b['payment_methods'], ['CASH']);
    expect(b.containsKey('customer'), isFalse,
        reason: 'sin cliente = consumidor final');
    expect(post.headers['Idempotency-Key'] ?? post.headers['idempotency-key'],
        isNotEmpty);
    expect(find.text('abrir'), findsOneWidget,
        reason: 'vuelve a la lista tras emitir');
  });

  testWidgets('S-FIN-08: el DV se exige con RUC y el cliente se guarda',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/fiscal/taxpayers': (_) => json({
            'taxpayers': [],
            'page': {'next_page_token': ''}
          }),
      'PUT /v1/fiscal/taxpayers': (r) => json({
            'taxpayer_id': 't1',
            ...(body(r)['taxpayer'] as Map<String, dynamic>)
                .cast<String, Object>(),
          }),
    }, calls: calls);
    await tester.pumpWidget(harness(TaxpayersScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Aún no tienes clientes fiscales.'), findsOneWidget);
    await tester.tap(find.text('Agregar cliente'));
    await tester.pumpAndSettle();
    final sheet = find.byType(TextField);
    await tester.enterText(sheet.at(1), '2588017-1-831938');
    await tester.enterText(sheet.at(3), 'Distribuidora, S.A.');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('Revisa el RUC y el DV: el DV son 2 dígitos.'),
        findsOneWidget);
    expect(calls.where((r) => r.method == 'PUT'), isEmpty);
    await tester.enterText(find.byType(TextField).at(2), '20');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final put = calls.firstWhere((r) => r.method == 'PUT');
    expect((body(put)['taxpayer'] as Map)['check_digit'], '20');
    expect((body(put)['taxpayer'] as Map)['tax_id_type'], 'RUC_JURIDICO');
  });

  testWidgets(
      'S-FIN-09: el emisor sale del negocio y Producción está deshabilitada (Q-11)',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/me': (_) => json({
            'valid': true,
            'user_id': 'u',
            'tenant_id': tenantId,
            'role': 'BUSINESS_OWNER'
          }),
      'GET /v1/business/$tenantId': (_) => json({
            'tenant_id': tenantId,
            'legal_name': 'Café La Esquina, S.A.',
            'tax_id': '2588017-1-831938',
            'dv': '20'
          }),
      'GET /v1/fiscal/profile': (_) => gatewayError(409, 'PROFILE_MISSING'),
      'PUT /v1/fiscal/profile': (_) => json(profile()),
    }, calls: calls);
    await tester.pumpWidget(harness(FiscalProfileScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Café La Esquina, S.A.'), findsOneWidget);
    expect(find.text('RUC 2588017-1-831938 · DV 20'), findsOneWidget);
    expect(find.text('Simulador (pruebas)'), findsOneWidget);
    expect(find.text('Disponible cuando se contrate el PAC.'), findsOneWidget);
    expect(find.textContaining('36,000'), findsNothing,
        reason: 'AGENTS.md §2.13: ningún tope legal en el código');
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final put = calls.firstWhere((r) => r.method == 'PUT');
    expect((body(put)['profile'] as Map)['environment'], 'DEMO');
    expect((body(put)['profile'] as Map)['pac_provider'], 'simulator');
  });

  testWidgets(
      'S-FIN-01 e8: los accesos fiscales aparecen solo con su permiso (C-12)',
      (tester) async {
    final api = fakeApi({
      'GET /v1/payments': (_) => json({
            'payments': [],
            'page': {'next_page_token': ''}
          }),
      'GET /v1/me/permissions': (_) => json({
            'role': 'BUSINESS_STAFF',
            'enabled_modules': ['finance'],
            'permissions': ['fiscal:read']
          }),
      'GET /v1/fiscal/profile': (_) => json(profile()),
      'GET /v1/fiscal/folios': (_) => json({'remaining': '-1'}),
    });
    await tester.pumpWidget(harness(FinanceScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Documentos fiscales'), findsOneWidget);
    expect(find.text('Clientes fiscales'), findsNothing);
    expect(find.text('Perfil fiscal'), findsNothing);
    await tester.pump(const Duration(
        seconds: 1)); // los folios llegan después de los permisos
    await tester.pumpAndSettle();
    expect(find.text('Sin límite de folios'), findsOneWidget);
  });

  test('R1: la vista previa usa el mismo redondeo que el servidor', () {
    final t = previewTotals(const [
      InvoiceLineItem(
          description: 'a',
          quantityMilli: 3000,
          unitPriceMinor: 1850,
          discountMinor: 0,
          taxRateBps: 700),
      InvoiceLineItem(
          description: 'b',
          quantityMilli: 1500,
          unitPriceMinor: 333,
          discountMinor: 0,
          taxRateBps: 0),
    ]);
    expect(t, (subtotal: 6050, tax: 389, total: 6439));
  });

  for (final (name, screen) in [
    (
      'S-FIN-07 detalle',
      (ApiClient api) =>
          InvoiceDetailScreen(api: api, invoiceId: invoiceId, canNote: true)
    ),
    ('S-FIN-09', (ApiClient api) => FiscalProfileScreen(api: api)),
  ]) {
    testWidgets(
        'gravital §15.3: $name al 200 % en 360 dp, oscuro, sin desbordes',
        (tester) async {
      final api = fakeApi({
        'GET /v1/fiscal/invoices/$invoiceId': (_) => json(invoice()),
        'GET /v1/me': (_) =>
            json({'valid': true, 'user_id': 'u', 'tenant_id': tenantId}),
        'GET /v1/business/$tenantId': (_) => json({
              'tenant_id': tenantId,
              'legal_name': 'Café La Esquina, S.A.',
              'tax_id': '2588017-1-831938',
              'dv': '20'
            }),
        'GET /v1/fiscal/profile': (_) => json(profile()),
        'GET /v1/fiscal/folios': (_) => json({'remaining': '-1'}),
      });
      await pumpAt(tester, screen(api));
      expect(tester.takeException(), isNull);
    });
  }
}
