import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';
import 'inventory_data.dart';
import 'stock_adjust_screen.dart';
import 'stock_detail_screen.dart';
import 'stock_transfer_screen.dart';
import 'warehouses_screen.dart';

/// Lo que la pantalla de existencias necesita de una vez.
class InventoryView {
  const InventoryView(
      {required this.warehouses, required this.levels, required this.products});
  final List<WarehouseItem> warehouses;
  final List<StockItem> levels;
  final Map<String, ProductItem> products;
}

/// S-INV-01 · `/inventory` · Existencias. `inventory:read` · `GET /v1/inventory/stock`.
///
/// e1 tarjetas "por agotarse" y "agotados" (filtran), e2 bodega ("Todas" suma), e4 lista con
/// disponible (negativo en `error`), reservado y mínimo, e5 Ajustar · Transferir. "En camino",
/// días de cobertura y lotes por vencer llegan con las órdenes de compra y los lotes (F16.4–F16.6).
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

enum _Filter { all, low, out }

class _InventoryScreenState extends State<InventoryScreen> {
  String _warehouse = '';
  _Filter _filter = _Filter.all;
  late Future<InventoryView> _future = _load();

  Future<InventoryView> _load() async {
    final warehouses = await loadWarehouses(widget.api);
    final levels = await loadStock(widget.api, warehouseId: _warehouse);
    final products = await loadProductIndex(widget.api);
    return InventoryView(
        warehouses: warehouses,
        levels: _warehouse.isEmpty ? sumByProduct(levels) : levels,
        products: products);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _go(Widget screen) async {
    final changed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (changed == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.invTitle),
        actions: [
          IconButton(
            tooltip: l10n.invTransfer,
            icon: const Icon(Icons.swap_horiz),
            onPressed: () => _go(StockTransferScreen(api: widget.api)),
          ),
          IconButton(
            tooltip: l10n.invWarehouses,
            icon: const Icon(Icons.warehouse_outlined),
            onPressed: () => _go(WarehousesScreen(api: widget.api)),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _go(StockAdjustScreen(api: widget.api)),
        icon: const Icon(Icons.tune),
        label: Text(l10n.invAdjust),
      ),
      body: FutureBuilder<InventoryView>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 3),
          children: [
            AsyncView<InventoryView>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (context, v) {
                final low = v.levels.where((l) => l.isLow).length;
                final out = v.levels.where((l) => l.isOut).length;
                final rows = switch (_filter) {
                  _Filter.low => v.levels.where((l) => l.isLow),
                  _Filter.out => v.levels.where((l) => l.isOut),
                  _Filter.all => v.levels,
                }
                    .toList()
                  ..sort((a, b) => (v.products[a.productId]?.name ?? '')
                      .compareTo(v.products[b.productId]?.name ?? ''));
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                          spacing: AppTokens.spacingSm,
                          runSpacing: AppTokens.spacingSm,
                          children: [
                            FilterChip(
                              avatar: Icon(Icons.trending_down,
                                  color: theme.colorScheme.tertiary),
                              label: Text(l10n.invLowCard('$low')),
                              selected: _filter == _Filter.low,
                              onSelected: (s) => setState(() =>
                                  _filter = s ? _Filter.low : _Filter.all),
                            ),
                            FilterChip(
                              avatar: Icon(Icons.remove_shopping_cart_outlined,
                                  color: theme.colorScheme.error),
                              label: Text(l10n.invOutCard('$out')),
                              selected: _filter == _Filter.out,
                              onSelected: (s) => setState(() =>
                                  _filter = s ? _Filter.out : _Filter.all),
                            ),
                          ]),
                      const SizedBox(height: AppTokens.spacingSm),
                      DropdownButtonFormField<String>(
                        initialValue: _warehouse,
                        isExpanded: true,
                        decoration:
                            InputDecoration(labelText: l10n.invWarehouse),
                        items: [
                          DropdownMenuItem(
                              value: '', child: Text(l10n.invAllWarehouses)),
                          for (final w in v.warehouses)
                            DropdownMenuItem(value: w.id, child: Text(w.name)),
                        ],
                        onChanged: (id) {
                          _warehouse = id ?? '';
                          _reload();
                        },
                      ),
                      const SizedBox(height: AppTokens.spacingMd),
                      if (rows.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              vertical: AppTokens.spacingXl),
                          child:
                              Text(l10n.invEmpty, textAlign: TextAlign.center),
                        )
                      else
                        Card(
                          margin: EdgeInsets.zero,
                          elevation: 0,
                          color: theme.colorScheme.surfaceContainerLow,
                          child: Column(children: [
                            for (final l in rows)
                              _StockTile(
                                  api: widget.api,
                                  level: l,
                                  product: v.products[l.productId],
                                  onChanged: _reload),
                          ]),
                        ),
                    ]);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StockTile extends StatelessWidget {
  const _StockTile(
      {required this.api,
      required this.level,
      required this.product,
      required this.onChanged});
  final ApiClient api;
  final StockItem level;
  final ProductItem? product;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final unit = product?.unitType ?? 'UNIT';
    final negative = level.availableMilli < 0;
    return ListTile(
      title: Text(product?.name ?? l10n.invUnknownProduct),
      subtitle: Text([
        '${l10n.invAvailable}: ${formatQty(level.availableMilli, unit)}',
        '${l10n.invReserved}: ${formatQty(level.reservedMilli, unit)}',
        if (level.reorderPointMilli > 0)
          '${l10n.invMinimum}: ${formatQty(level.reorderPointMilli, unit)}',
      ].join(' · ')),
      trailing: Semantics(
        label: l10n.invAvailable,
        child: Text(formatQty(level.availableMilli, unit),
            style: theme.textTheme.titleMedium
                ?.copyWith(color: negative ? theme.colorScheme.error : null)),
      ),
      onTap: product == null
          ? null
          : () async {
              final changed = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                      builder: (_) =>
                          StockDetailScreen(api: api, product: product!)));
              if (changed == true) onChanged();
            },
    );
  }
}
