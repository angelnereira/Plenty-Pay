import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/catalog/catalog_screen.dart';
import 'package:plentypay/features/catalog/categories_screen.dart';
import 'package:plentypay/features/catalog/product_screen.dart';
import 'package:plentypay/features/inventory/inventory_screen.dart';
import 'package:plentypay/features/inventory/stock_adjust_screen.dart';
import 'package:plentypay/features/inventory/stock_transfer_screen.dart';
import 'package:plentypay/features/inventory/warehouses_screen.dart';
import 'package:plentypay/features/pos/pos_checkout_screen.dart';
import 'package:plentypay/features/pos/pos_close_session_screen.dart';
import 'package:plentypay/features/pos/pos_data.dart';
import 'package:plentypay/features/pos/pos_receipt_screen.dart';
import 'package:plentypay/features/pos/pos_screen.dart';

import '../support/commerce_fixtures.dart';
import '../support/fake_gateway.dart';

/// gravital-experience-ui §15.3: texto al 200 %, compact y expanded, oscuro y claro, sin desbordes,
/// para catálogo (S-CAT-01/02/04), inventario (S-INV-01/03/04/09) y caja (S-POS-02/03/05/10).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final routes = <String, FakeRoute>{
    'GET /v1/catalog/products': (_) => json(productsBody),
    'GET /v1/catalog/categories': (_) => json({
          'categories': [
            {'category_id': 'c1', 'name': 'Bebidas calientes y especialidades de la casa'},
            {'category_id': 'c2', 'name': 'Café molido', 'parent_id': 'c1'},
          ]
        }),
    'GET /v1/catalog/tax-rates': (_) => json({
          'rates': [
            {'kind': 'STANDARD', 'rate_bps': 700},
            {'kind': 'ALCOHOL', 'rate_bps': 1000},
          ]
        }),
    'GET /v1/inventory/warehouses': (_) => json({
          'warehouses': [
            {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
            {'warehouse_id': 'w-2', 'name': 'Sucursal Colón Zona Libre', 'active': true},
          ]
        }),
    'GET /v1/inventory/stock': (_) => json({
          'levels': [
            {'product_id': cafeId, 'warehouse_id': 'w-1', 'on_hand_milli': '1234000', 'available_milli': '1234000', 'reorder_point_milli': '5000'},
          ],
          'page': {'next_page_token': ''},
        }),
    'GET /v1/pos/sessions/current': (_) => json(session()),
    'GET /v1/terminals': (_) => json(terminalsBody),
    'GET /v1/pos/sessions/$sessionId': (_) => json(session()),
  };

  final paid = SaleItem.fromJson(sale('PAID', receipt: '00000042', tenders: [
    {
      'rail': 'PAYMENT_RAIL_CASH',
      'amount': {'amount_minor': '1850', 'currency': 'USD'},
      'cash_tendered': {'amount_minor': '2000', 'currency': 'USD'},
      'status': 'CAPTURED'
    }
  ]));

  final screens = <String, Widget Function()>{
    'productos': () => CatalogScreen(api: fakeApi(routes)),
    'editor de producto': () => ProductScreen(api: fakeApi(routes)),
    'categorías': () => CategoriesScreen(api: fakeApi(routes)),
    'existencias': () => InventoryScreen(api: fakeApi(routes)),
    'ajuste': () => StockAdjustScreen(api: fakeApi(routes)),
    'transferencia': () => StockTransferScreen(api: fakeApi(routes)),
    'bodegas': () => WarehousesScreen(api: fakeApi(routes)),
    'caja · venta': () => PosScreen(api: fakeApi(routes)),
    'caja · cobro': () => PosCheckoutScreen(api: fakeApi(routes), sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal'),
    'caja · recibo': () => PosReceiptScreen(api: fakeApi(routes), sale: paid, terminalLabel: 'Caja principal de la sucursal'),
    'caja · cierre': () => PosCloseSessionScreen(api: fakeApi(routes), sessionId: sessionId),
  };

  for (final entry in screens.entries) {
    for (final size in const [Size(360, 800), Size(1280, 800)]) {
      for (final brightness in Brightness.values) {
        testWidgets('${entry.key} al 200 % en ${size.width.toInt()} dp, ${brightness.name}, sin desbordes', (tester) async {
          await pumpAt(tester, entry.value(), brightness: brightness, size: size);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        });
      }
    }
  }
}
