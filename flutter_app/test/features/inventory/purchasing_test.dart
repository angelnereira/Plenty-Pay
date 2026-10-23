import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:plentypay/core/widgets/pp_text_field.dart';
import 'package:plentypay/features/inventory/inventory_screen.dart';
import 'package:plentypay/features/inventory/purchase_orders_screen.dart';
import 'package:plentypay/features/inventory/purchase_receive_screen.dart';
import 'package:plentypay/features/inventory/purchasing_data.dart';
import 'package:plentypay/features/inventory/reorder_suggestions_screen.dart';
import 'package:plentypay/features/inventory/suppliers_screen.dart';
import 'package:plentypay/features/catalog/catalog_data.dart';

import '../../support/commerce_fixtures.dart';
import '../../support/fake_gateway.dart';

const poId = '01a15fc9-1083-745b-aed2-163be0ceeb01';
const supplierId = '01a15fc9-1083-745b-aed2-163be0ceeb02';

Map<String, Object> money(int v) => {'amount_minor': '$v', 'currency': 'USD'};

Map<String, Object> supplier({bool active = true}) => {
      'supplier_id': supplierId,
      'name': 'Distribuidora del Istmo',
      'tax_id': '8-123-456',
      'check_digit': '12',
      'email': 'ventas@istmo.test',
      'lead_time_days': 5,
      'active': active,
    };

Map<String, Object> order({String status = 'PURCHASE_ORDER_STATUS_SENT', int received = 0}) => {
      'purchase_order_id': poId,
      'supplier_id': supplierId,
      'supplier_name': 'Distribuidora del Istmo',
      'warehouse_id': 'w-1',
      'status': status,
      'lines': [
        {'product_id': cafeId, 'ordered_milli': '10000', 'received_milli': '$received', 'unit_cost': money(925)},
      ],
      'total': money(9250),
      'created_at': '2026-10-21T15:00:00Z',
      'version': 1,
    };

final warehousesBody = {
  'warehouses': [
    {'warehouse_id': 'w-1', 'name': 'Bodega principal', 'active': true, 'is_default': true},
  ]
};

Map<String, dynamic> body(http.Request r) => jsonDecode(r.body) as Map<String, dynamic>;

Finder inputOf(String label) =>
    find.descendant(of: find.widgetWithText(PPTextField, label), matching: find.byType(TextField));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('S-INV-01 e5: el menú de compras aparece según permiso', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/warehouses': (_) => json(warehousesBody),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/stock': (_) => json({'levels': <Object>[]}),
      'GET /v1/inventory/lots': (_) => json({'lots': <Object>[]}),
      'GET /v1/me/permissions': (_) => json({
            'role': 'cashier',
            'enabled_modules': ['inventory'],
            'permissions': ['inventory:read', 'inventory:receive'],
          }),
    });
    await tester.pumpWidget(harness(InventoryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Compras'));
    await tester.pumpAndSettle();
    expect(find.text('Órdenes de compra'), findsOneWidget);
    expect(find.text('Sugerencias de reorden'), findsOneWidget);
    expect(find.text('Proveedores'), findsNothing, reason: 'sin inventory:purchase:manage');
  });

  testWidgets('S-INV-07: lista real y alta con clave de idempotencia; INVALID_SUPPLIER se explica',
      (tester) async {
    final calls = <http.Request>[];
    var fail = true;
    final api = fakeApi({
      'GET /v1/inventory/suppliers': (_) => json({
            'suppliers': [supplier()]
          }),
      'PUT /v1/inventory/suppliers': (_) {
        if (fail) {
          fail = false;
          return gatewayError(400, 'INVALID_SUPPLIER');
        }
        return json(supplier());
      },
    }, calls: calls);
    await tester.pumpWidget(harness(SuppliersScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Distribuidora del Istmo'), findsOneWidget);
    expect(find.text('RUC 8-123-456 DV 12 · Entrega en 5 días'), findsOneWidget);

    await tester.tap(find.text('Agregar proveedor'));
    await tester.pumpAndSettle();
    await tester.enterText(inputOf('Razón social'), 'Molino Santa Rosa');
    await tester.enterText(inputOf('Teléfono (opcional)'), 'abc');
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Revisa los datos del proveedor'), findsOneWidget);

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    final puts = calls.where((r) => r.method == 'PUT').toList();
    expect(puts, hasLength(2));
    expect(puts[0].headers['Idempotency-Key'], isNotEmpty);
    expect(puts[0].headers['Idempotency-Key'], puts[1].headers['Idempotency-Key'],
        reason: 'el reintento reusa la clave');
    final s = body(puts[1])['supplier'] as Map;
    expect(s['name'], 'Molino Santa Rosa');
    expect(s.containsKey('supplier_id'), isFalse);
    expect(s['lead_time_days'], 7);
    expect(body(puts[1]).containsKey('idempotency_key'), isFalse);
  });

  testWidgets('S-INV-05: lista con estado, total del servidor y fecha con el mes en texto', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/purchase-orders': (_) => json({
            'orders': [order()]
          }),
    });
    await tester.pumpWidget(harness(PurchaseOrdersScreen(api: api, canManage: false, canReceive: true)));
    await tester.pumpAndSettle();
    expect(find.text('Orden 01A15FC9 · Distribuidora del Istmo'), findsOneWidget);
    expect(find.text('Enviada'), findsWidgets);
    expect(find.text(r'$92.50'), findsOneWidget);
    expect(find.text('21 de octubre de 2026'), findsOneWidget);
    expect(find.text('Nueva orden'), findsNothing, reason: 'sin inventory:purchase:manage');
  });

  testWidgets('S-INV-05: crear borrador manda líneas en milésimas y centavos', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/suppliers': (_) => json({
            'suppliers': [supplier()]
          }),
      'GET /v1/inventory/warehouses': (_) => json(warehousesBody),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'POST /v1/inventory/purchase-orders': (_) => json(order(status: 'PURCHASE_ORDER_STATUS_DRAFT')),
    }, calls: calls);
    await tester.pumpWidget(harness(PurchaseOrderEditorScreen(
        api: api,
        supplierId: supplierId,
        lines: const [PurchaseLineDraft(productId: cafeId, quantityMilli: 12500)])));
    await tester.pumpAndSettle();
    expect(find.text('Distribuidora del Istmo'), findsOneWidget);
    expect(find.text('Café 250 g'), findsOneWidget);

    // Sin costo no guarda.
    await tester.ensureVisible(find.text('Guardar borrador'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar borrador'));
    await tester.pumpAndSettle();
    expect(calls.where((r) => r.method == 'POST'), isEmpty);
    expect(find.text('Este campo es obligatorio.'), findsOneWidget);

    await tester.enterText(inputOf('Costo unitario'), '9.25');
    await tester.ensureVisible(find.text('Guardar borrador'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar borrador'));
    await tester.pumpAndSettle();
    final post = calls.singleWhere((r) => r.method == 'POST');
    final o = body(post)['order'] as Map;
    expect(o['supplier_id'], supplierId);
    expect(o['warehouse_id'], 'w-1');
    final line = (o['lines'] as List).single as Map;
    expect(line['ordered_milli'], '12500');
    expect(line['unit_cost'], {'amount_minor': '925', 'currency': 'USD'});
    expect(post.headers['Idempotency-Key'], isNotEmpty);
  });

  testWidgets('S-INV-05: borrador se marca como enviada; cancelar pide confirmación', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/catalog/products': (_) => json(productsBody),
      'POST /v1/inventory/purchase-orders/$poId/status': (req) =>
          json(order(status: body(req)['status'] as String)),
    }, calls: calls);
    await tester.pumpWidget(harness(PurchaseOrderDetailScreen(
        api: api,
        order: PurchaseOrderItem.fromJson(order(status: 'PURCHASE_ORDER_STATUS_DRAFT')),
        canManage: true,
        canReceive: true)));
    await tester.pumpAndSettle();
    expect(find.text('Pedido 10 · Recibido 0 · Costo \$9.25'), findsOneWidget);
    await tester.tap(find.text('Marcar como enviada'));
    await tester.pumpAndSettle();
    expect(body(calls.last)['status'], 'PURCHASE_ORDER_STATUS_SENT');
    expect(find.text('Recibir'), findsOneWidget, reason: 'enviada → se puede recibir');

    await tester.tap(find.text('Cancelar orden'));
    await tester.pumpAndSettle();
    expect(find.text('¿Cancelar la orden?'), findsOneWidget);
    await tester.tap(find.text('Mantener la orden'));
    await tester.pumpAndSettle();
    expect(calls.where((r) => r.url.path.endsWith('/status')), hasLength(1));
  });

  testWidgets('S-INV-06: propone lo pendiente, bloquea el exceso y registra con factura', (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'POST /v1/inventory/purchase-orders/$poId/receive': (_) =>
          json(order(status: 'PURCHASE_ORDER_STATUS_PARTIALLY_RECEIVED', received: 4000)),
    }, calls: calls);
    final products = {cafeId: ProductItem.fromJson(product(cafeId, 'Café 250 g', 1850))};
    PurchaseOrderItem? result;
    await tester.pumpWidget(harness(Builder(
      builder: (context) => TextButton(
        onPressed: () async {
          result = await Navigator.of(context).push<PurchaseOrderItem>(MaterialPageRoute(
              builder: (_) => PurchaseReceiveScreen(
                  api: api, order: PurchaseOrderItem.fromJson(order(received: 2000)), products: products)));
        },
        child: const Text('abrir'),
      ),
    )));
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    expect(find.text('Orden 01A15FC9 · Distribuidora del Istmo'), findsOneWidget);
    expect(find.text('Pedido 10 · Recibido antes 2'), findsOneWidget);
    expect(find.widgetWithText(TextField, '8'), findsOneWidget, reason: 'propone lo pendiente');

    await tester.enterText(inputOf('Recibido ahora'), '9');
    await tester.pumpAndSettle();
    expect(find.text('Estás recibiendo más de lo pedido.'), findsOneWidget);

    await tester.enterText(inputOf('Recibido ahora'), '2');
    await tester.enterText(inputOf('Factura del proveedor (opcional)'), 'F-0091');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar recepción'));
    await tester.pumpAndSettle();
    final post = calls.single;
    expect(body(post)['lines'], [
      {'product_id': cafeId, 'received_milli': '2000'}
    ]);
    expect(body(post)['supplier_invoice'], 'F-0091');
    expect(result?.status, 'PARTIALLY_RECEIVED');
  });

  testWidgets('S-INV-08: sugerencias reales; seleccionar abre la orden con el proveedor habitual',
      (tester) async {
    final calls = <http.Request>[];
    final api = fakeApi({
      'GET /v1/inventory/reorder-suggestions': (_) => json({
            'suggestions': [
              {
                'product_id': cafeId,
                'warehouse_id': 'w-1',
                'suggested_quantity_milli': '24000',
                'available_milli': '3000',
                'in_transit_milli': '0',
                'avg_daily_demand_milli': '2500',
                'days_of_cover': 1,
                'abc_class': 'A',
                'supplier_id': supplierId,
                'supplier_name': 'Distribuidora del Istmo',
                'lead_time_days': 5,
              }
            ]
          }),
      'GET /v1/catalog/products': (_) => json(productsBody),
      'GET /v1/inventory/suppliers': (_) => json({
            'suppliers': [supplier()]
          }),
      'GET /v1/inventory/warehouses': (_) => json(warehousesBody),
    }, calls: calls);
    await tester.pumpWidget(harness(ReorderSuggestionsScreen(api: api, canManage: true)));
    await tester.pumpAndSettle();
    expect(find.text('Café 250 g'), findsOneWidget);
    expect(find.text('Cubre 1 día'), findsOneWidget);
    expect(find.text('Clase A'), findsOneWidget);
    expect(find.text('Disponible 3 · En camino 0 · Venta diaria 2.5'), findsOneWidget);
    expect(find.text('Sugerido: 24'), findsOneWidget);
    expect(find.text('Proveedor habitual: Distribuidora del Istmo'), findsOneWidget);

    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Crear orden de compra'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Crear orden de compra'));
    await tester.pumpAndSettle();
    expect(find.text('Nueva orden'), findsOneWidget);
    expect(find.text('Distribuidora del Istmo'), findsOneWidget);
    expect(find.widgetWithText(TextField, '24'), findsOneWidget);
  });

  testWidgets('S-INV-08: sin inventory:purchase:manage no hay casillas ni botón', (tester) async {
    final api = fakeApi({
      'GET /v1/inventory/reorder-suggestions': (_) => json({'suggestions': <Object>[]}),
      'GET /v1/catalog/products': (_) => json(productsBody),
    });
    await tester.pumpWidget(harness(ReorderSuggestionsScreen(api: api, canManage: false)));
    await tester.pumpAndSettle();
    expect(find.textContaining('No hay productos por reponer'), findsOneWidget);
    expect(find.text('Crear orden de compra'), findsNothing);
  });
}
