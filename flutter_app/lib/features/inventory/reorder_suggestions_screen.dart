import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_data.dart';
import 'purchase_orders_screen.dart';
import 'purchasing_data.dart';

class _ReorderView {
  const _ReorderView(this.items, this.products);
  final List<ReorderItem> items;
  final Map<String, ProductItem> products;
}

/// S-INV-08 · `/inventory/suggestions` · Sugerencias de reorden. `inventory:read`.
///
/// Por producto: disponible, en camino, venta diaria promedio, días de cobertura, cantidad
/// sugerida, clase ABC y proveedor habitual (R6). Con `inventory:purchase:manage`, casillas y
/// «Crear orden de compra» con las líneas del primer proveedor elegido.
class ReorderSuggestionsScreen extends StatefulWidget {
  const ReorderSuggestionsScreen(
      {super.key, required this.api, required this.canManage});
  final ApiClient api;
  final bool canManage;

  @override
  State<ReorderSuggestionsScreen> createState() =>
      _ReorderSuggestionsScreenState();
}

class _ReorderSuggestionsScreenState extends State<ReorderSuggestionsScreen> {
  late Future<_ReorderView> _future = _load();
  final Set<String> _selected = {};

  static String _keyOf(ReorderItem r) => '${r.warehouseId}/${r.productId}';

  Future<_ReorderView> _load() async {
    final items = await loadReorderSuggestions(widget.api);
    final products = await loadProductIndex(widget.api);
    return _ReorderView(items, products);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _createOrder(List<ReorderItem> items) async {
    final chosen = items.where((r) => _selected.contains(_keyOf(r))).toList();
    if (chosen.isEmpty) return;
    final supplier = chosen.first.supplierId;
    final group = chosen.where((r) => r.supplierId == supplier).toList();
    final created = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => PurchaseOrderEditorScreen(
        api: widget.api,
        supplierId: supplier,
        lines: [
          for (final r in group)
            PurchaseLineDraft(
                productId: r.productId, quantityMilli: r.suggestedMilli),
        ],
      ),
    ));
    if (created == true && mounted) {
      setState(() => _selected.removeAll(group.map(_keyOf)));
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.reorderTitle)),
      body: FutureBuilder<_ReorderView>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_ReorderView>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? purchasingErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (v) => v.items.isEmpty,
              emptyView: Text(l10n.reorderEmpty, style: theme.textTheme.bodyLarge),
              builder: (context, v) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.reorderHint, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: AppTokens.spacingMd),
                    for (final r in v.items)
                      _SuggestionCard(
                        item: r,
                        product: v.products[r.productId],
                        selectable: widget.canManage,
                        selected: _selected.contains(_keyOf(r)),
                        onSelected: (s) => setState(() => s
                            ? _selected.add(_keyOf(r))
                            : _selected.remove(_keyOf(r))),
                      ),
                    if (widget.canManage) ...[
                      const SizedBox(height: AppTokens.spacingMd),
                      PPButton.primary(
                        label: l10n.reorderCreateOrder,
                        onPressed: _selected.isEmpty
                            ? null
                            : () => _createOrder(v.items),
                      ),
                    ],
                  ]),
            ),
          ],
        ),
      ),
    );
  }
}

StatusTone _coverTone(ReorderItem r) => r.availableMilli <= 0
    ? StatusTone.error
    : (r.dailyMilli > 0 && r.daysOfCover <= r.leadTimeDays
        ? StatusTone.warning
        : StatusTone.neutral);

class _SuggestionCard extends StatelessWidget {
  const _SuggestionCard(
      {required this.item,
      required this.product,
      required this.selectable,
      required this.selected,
      required this.onSelected});
  final ReorderItem item;
  final ProductItem? product;
  final bool selectable;
  final bool selected;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final unit = product?.unitType ?? 'UNIT';
    final r = item;
    final body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(product?.name ?? l10n.invUnknownProduct,
          style: theme.textTheme.titleMedium),
      const SizedBox(height: AppTokens.spacingXs),
      Wrap(
          spacing: AppTokens.spacingSm,
          runSpacing: AppTokens.spacingXs,
          children: [
            StatusChip(
                label: r.dailyMilli > 0
                    ? l10n.reorderCover(r.daysOfCover)
                    : l10n.reorderNoSales,
                tone: _coverTone(r)),
            if (r.abc.isNotEmpty)
              StatusChip(label: l10n.reorderAbc(r.abc), tone: StatusTone.info),
          ]),
      const SizedBox(height: AppTokens.spacingSm),
      Text(l10n.reorderStockLine(formatQty(r.availableMilli, unit),
          formatQty(r.inTransitMilli, unit), formatQty(r.dailyMilli, unit))),
      Text(r.supplierName.isEmpty
          ? l10n.reorderNoSupplier
          : l10n.reorderSupplier(r.supplierName)),
      const SizedBox(height: AppTokens.spacingSm),
      Text(l10n.reorderSuggested(formatQty(r.suggestedMilli, unit)),
          style: theme.textTheme.titleMedium),
    ]);
    return Card(
      margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: selectable
          ? CheckboxListTile(
              value: selected,
              onChanged: (v) => onSelected(v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: body,
            )
          : Padding(
              padding: const EdgeInsets.all(AppTokens.spacingMd), child: body),
    );
  }
}
