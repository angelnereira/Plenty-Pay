import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/finance/finance_screen.dart';
import 'package:plentypay/features/finance/terminals_screen.dart';
import 'package:plentypay/features/home/home_screen.dart';
import 'package:plentypay/features/modules/module_registry.dart';
import 'package:plentypay/features/wallet/pay_confirm_screen.dart';
import 'package:plentypay/features/wallet/wallet_screen.dart';

import '../support/fake_gateway.dart';

/// gravital-experience-ui §15.3: texto al 200 %, compact y expanded, oscuro y claro, sin desbordes,
/// para la cadena de pagos (S-GEN-05, S-WAL-01, S-WAL-06, S-FIN-01, S-FIN-04).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final routes = <String, FakeRoute>{
    'GET /v1/me': (_) =>
        json({'user_id': 'u-1', 'role': 'CUSTOMER', 'tenant_id': ''}),
    'GET /v1/wallet/balance': (_) => json(balance(1234567, held: 2500)),
    'GET /v1/wallet/statement': (_) => json({
          'lines': [
            {
              'entry': {'side': 'ENTRY_SIDE_DEBIT', 'amount_minor': '2500'},
              'transaction_id': '01900000-0000-7000-8000-000000000001',
              'transaction_type': 'WALLET_PAYMENT',
              'description': '',
              'effective_at': '2026-10-19T13:40:00Z',
            },
          ],
        }),
    'GET /v1/pay-links/AbCdEfGhIjKlMnOpQrStUv': (_) => json({
          'label': 'Caja principal de la sucursal',
          'merchant_name': 'Ferretería y Materiales del Istmo S.A.'
        }),
    'GET /v1/payments': (_) => json({
          'payments': <Object>[],
          'page': {'next_page_token': ''}
        }),
    'GET /v1/terminals': (_) => json({
          'terminals': [
            {
              'terminal_id': 't-1',
              'public_code': 'AbCdEfGhIjKlMnOpQrStUv',
              'label': 'Caja 1',
              'active': true
            },
          ],
        }),
  };

  final screens = <String, Widget Function()>{
    'inicio': () => HomeScreen(
        api: fakeApi(routes),
        modules: moduleRegistry,
        onSelectModule: (_) {},
        onSignOut: () {}),
    'billetera': () => WalletScreen(api: fakeApi(routes)),
    'confirmar pago': () =>
        PayConfirmScreen(api: fakeApi(routes), code: 'AbCdEfGhIjKlMnOpQrStUv'),
    'finanzas': () => FinanceScreen(api: fakeApi(routes)),
    'puntos de cobro': () => TerminalsScreen(api: fakeApi(routes)),
  };

  for (final entry in screens.entries) {
    for (final size in const [Size(360, 800), Size(1280, 800)]) {
      for (final brightness in Brightness.values) {
        testWidgets(
            '${entry.key} al 200 % en ${size.width.toInt()} dp, ${brightness.name}, sin desbordes',
            (tester) async {
          await pumpAt(tester, entry.value(),
              brightness: brightness, size: size);
          expect(tester.takeException(), isNull);
        });
      }
    }
  }
}
