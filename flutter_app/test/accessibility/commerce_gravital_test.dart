import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/catalog/catalog_data.dart';
import 'package:plentypay/features/catalog/catalog_screen.dart';
import 'package:plentypay/features/catalog/categories_screen.dart';
import 'package:plentypay/features/catalog/product_screen.dart';
import 'package:plentypay/features/inventory/inventory_screen.dart';
import 'package:plentypay/features/inventory/purchase_orders_screen.dart';
import 'package:plentypay/features/inventory/purchase_receive_screen.dart';
import 'package:plentypay/features/inventory/purchasing_data.dart';
import 'package:plentypay/features/inventory/reorder_suggestions_screen.dart';
import 'package:plentypay/features/inventory/suppliers_screen.dart';
import 'package:plentypay/features/inventory/stock_detail_screen.dart';
import 'package:plentypay/features/inventory/stock_adjust_screen.dart';
import 'package:plentypay/features/inventory/stock_transfer_screen.dart';
import 'package:plentypay/features/inventory/warehouses_screen.dart';
import 'package:plentypay/features/pos/pos_checkout_screen.dart';
import 'package:plentypay/features/pos/pos_close_session_screen.dart';
import 'package:plentypay/features/pos/pos_data.dart';
import 'package:plentypay/features/pos/pos_parked_screen.dart';
import 'package:plentypay/features/pos/pos_receipt_screen.dart';
import 'package:plentypay/features/pos/pos_screen.dart';

import '../support/commerce_fixtures.dart';
import '../support/fake_gateway.dart';

/// gravital-experience-ui §15.3: texto al 200 %, compact y expanded, oscuro y claro, sin desbordes,
/// para catálogo (S-CAT-01/02/04), inventario (S-INV-01/03/04/05/06/07/08/09) y caja (S-POS-02/03/05/06/10).
final purchaseOrder = <String, Object>{
  'purchase_order_id': '01a15fc9-1083-745b-aed2-163be0ceeb01',
  'supplier_id': 's-1',
  'supplier_name': 'Distribuidora Mayorista del Istmo y Zona Libre',
  'warehouse_id': 'w-1',
  'status': 'PURCHASE_ORDER_STATUS_PARTIALLY_RECEIVED',
  'lines': [
    {'product_id': cafeId, 'ordered_milli': '1234000', 'received_milli': '1000', 'unit_cost': {'amount_minor': '123456789', 'currency': 'USD'}},
  ],
  'total': {'amount_minor': '123456789000', 'currency': 'USD'},
  'created_at': '2026-09-21T15:00:00Z',
  'expected_at': '2026-11-30T15:00:00Z',
};

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
    'GET /v1/inventory/movements': (_) => json({'movements': <Object>[]}),
    'GET /v1/me/permissions': (_) => json({
          'role': 'owner',
          'permissions': ['inventory:read', 'inventory:adjust', 'inventory:receive', 'inventory:purchase:manage'],
        }),
    'GET /v1/inventory/suppliers': (_) => json({
          'suppliers': [
            {'supplier_id': 's-1', 'name': 'Distribuidora Mayorista del Istmo y Zona Libre', 'tax_id': '155700001-2-2026', 'check_digit': '45', 'lead_time_days': 12, 'active': false},
          ]
        }),
    'GET /v1/inventory/purchase-orders': (_) => json({'orders': [purchaseOrder]}),
    'GET /v1/inventory/reorder-suggestions': (_) => json({
          'suggestions': [
            {'product_id': cafeId, 'warehouse_id': 'w-1', 'suggested_quantity_milli': '1234000', 'available_milli': '-3000', 'in_transit_milli': '120000', 'avg_daily_demand_milli': '45500', 'days_of_cover': 0, 'abc_class': 'A', 'supplier_id': 's-1', 'supplier_name': 'Distribuidora Mayorista del Istmo y Zona Libre', 'lead_time_days': 12},
          ]
        }),
    'GET /v1/catalog/storefront': (_) => json({...storefrontBody(storeA, 'Panadería y Repostería Artesanal Sol'), 'published': false}),
    'GET /v1/pos/sessions/current': (_) => json(session()),
    'GET /v1/terminals': (_) => json(terminalsBody),
    'GET /v1/pos/sessions/$sessionId': (_) => json(session()),
    'GET /v1/pos/sales': (_) => json({
          'sales': [
            {...sale('PARKED'), 'park_label': 'Cliente de la fila dos que fue a buscar la leche deslactosada', 'parked_at': '2026-09-30T23:59:00Z'},
          ]
        }),
  };

  final po = PurchaseOrderItem.fromJson(purchaseOrder);
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
    'editor de producto publicado': () => ProductScreen(api: fakeApi(routes), product: ProductItem.fromJson({...product(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850), 'listed_in_marketplace': true})),
    'detalle de existencias': () => StockDetailScreen(api: fakeApi(routes), product: ProductItem.fromJson({...product(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850), 'listed_in_marketplace': true})),
    'existencias': () => InventoryScreen(api: fakeApi(routes)),
    'ajuste': () => StockAdjustScreen(api: fakeApi(routes)),
    'transferencia': () => StockTransferScreen(api: fakeApi(routes)),
    'bodegas': () => WarehousesScreen(api: fakeApi(routes)),
    'proveedores': () => SuppliersScreen(api: fakeApi(routes)),
    'órdenes de compra': () => PurchaseOrdersScreen(api: fakeApi(routes), canManage: true, canReceive: true),
    'detalle de orden': () => PurchaseOrderDetailScreen(api: fakeApi(routes), order: po, canManage: true, canReceive: true),
    'nueva orden': () => PurchaseOrderEditorScreen(api: fakeApi(routes), supplierId: 's-1', lines: const [PurchaseLineDraft(productId: cafeId, quantityMilli: 1234000)]),
    'recepción': () => PurchaseReceiveScreen(api: fakeApi(routes), order: po, products: {cafeId: ProductItem.fromJson(product(cafeId, 'Café de altura de Boquete tostado medio 250 g', 1850))}),
    'sugerencias de reorden': () => ReorderSuggestionsScreen(api: fakeApi(routes), canManage: true),
    'caja · venta': () => PosScreen(api: fakeApi(routes)),
    'caja · cobro': () => PosCheckoutScreen(api: fakeApi(routes), sale: SaleItem.fromJson(sale('OPEN')), terminalLabel: 'Caja principal'),
    'caja · recibo': () => PosReceiptScreen(api: fakeApi(routes), sale: paid, terminalLabel: 'Caja principal de la sucursal'),
    'caja · cierre': () => PosCloseSessionScreen(api: fakeApi(routes), sessionId: sessionId),
    'caja · estacionadas': () => PosParkedScreen(api: fakeApi(routes), sessionId: sessionId, canResume: false),
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
