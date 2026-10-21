import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_data.dart';
import 'inventory_data.dart';
import 'purchase_receive_screen.dart';
import 'purchasing_data.dart';

/// Línea propuesta para una orden nueva (desde S-INV-08).
class PurchaseLineDraft {
  const PurchaseLineDraft({required this.productId, required this.quantityMilli});
  final String productId;
  final int quantityMilli;
}

/// S-INV-05 · `/inventory/purchases` · Órdenes de compra.
///
/// Lista con `StatusChip` y filtro por estado; "Nueva orden" con `inventory:purchase:manage`;
/// cada orden abre su detalle con las acciones que su estado permite.
class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen(
      {super.key, required this.api, required this.canManage, required this.canReceive});
  final ApiClient api;
  final bool canManage;
  final bool canReceive;

  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

const _statuses = ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  String _status = '';
  late Future<List<PurchaseOrderItem>> _future = _load();

  Future<List<PurchaseOrderItem>> _load() => loadPurchaseOrders(widget.api,
      status: _status.isEmpty ? '' : 'PURCHASE_ORDER_STATUS_$_status');

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _open(Widget screen) async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (changed == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.poTitle)),
      body: FutureBuilder<List<PurchaseOrderItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            if (widget.canManage) ...[
              PPButton.primary(
                  label: l10n.poNew,
                  onPressed: () => _open(PurchaseOrderEditorScreen(api: widget.api))),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            Wrap(spacing: AppTokens.spacingSm, runSpacing: AppTokens.spacingSm, children: [
              ChoiceChip(
                label: Text(l10n.poFilterAll),
                selected: _status.isEmpty,
                onSelected: (_) {
                  _status = '';
                  _reload();
                },
              ),
              for (final s in _statuses)
                ChoiceChip(
                  label: Text(poStatusLabel(l10n, s)),
                  selected: _status == s,
                  onSelected: (_) {
                    _status = s;
                    _reload();
                  },
                ),
            ]),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<PurchaseOrderItem>>(
              snapshot: snap,
              errorMessage: snap.hasError ? purchasingErrorMessage(l10n, snap.error!) : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              isEmpty: (list) => list.isEmpty,
              onRetry: _reload,
              emptyView: Text(l10n.poEmpty, style: theme.textTheme.bodyLarge),
              builder: (context, list) => Column(children: [
                for (final o in list)
                  Card(
                    margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
                    elevation: 0,
                    color: theme.colorScheme.surfaceContainerLow,
                    child: ListTile(
                      onTap: () => _open(PurchaseOrderDetailScreen(
                          api: widget.api,
                          order: o,
                          canManage: widget.canManage,
                          canReceive: widget.canReceive)),
                      title: Text(l10n.poNumber(o.shortId, o.supplierName)),
                      subtitle: Wrap(
                        spacing: AppTokens.spacingSm,
                        runSpacing: AppTokens.spacingXs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          StatusChip(label: poStatusLabel(l10n, o.status), tone: poStatusTone(o.status)),
                          if (o.createdAt != null) Text(purchaseDate(o.createdAt!, locale)),
                          MoneyText(o.totalMinor, style: theme.textTheme.titleMedium),
                        ],
                      ),
                    ),
                  ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Detalle de una orden: cabecera, líneas, total del servidor y acciones según el estado.
class PurchaseOrderDetailScreen extends StatefulWidget {
  const PurchaseOrderDetailScreen(
      {super.key,
      required this.api,
      required this.order,
      required this.canManage,
      required this.canReceive});
  final ApiClient api;
  final PurchaseOrderItem order;
  final bool canManage;
  final bool canReceive;

  @override
  State<PurchaseOrderDetailScreen> createState() => _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState extends State<PurchaseOrderDetailScreen> {
  late PurchaseOrderItem _order = widget.order;
  late final Future<Map<String, ProductItem>> _products = loadProductIndex(widget.api);
  bool _busy = false;
  bool _changed = false;
  String? _error;

  Future<void> _setStatus(String status) async {
    final l10n = AppLocalizations.of(context);
    if (status == 'CANCELLED') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l10n.poCancelTitle),
          content: Text(l10n.poCancelBody),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.poKeep)),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.poCancel)),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final j = await widget.api.setPurchaseOrderStatus(_order.id, 'PURCHASE_ORDER_STATUS_$status',
          idempotencyKey: newRequestId());
      if (!mounted) return;
      setState(() {
        _order = PurchaseOrderItem.fromJson(j);
        _changed = true;
      });
    } on Object catch (e) {
      if (mounted) setState(() => _error = purchasingErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _receive(Map<String, ProductItem> products) async {
    final updated = await Navigator.of(context).push<PurchaseOrderItem>(MaterialPageRoute(
        builder: (_) => PurchaseReceiveScreen(api: widget.api, order: _order, products: products)));
    if (updated != null && mounted) {
      setState(() {
        _order = updated;
        _changed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    final o = _order;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.poNumber(o.shortId, o.supplierName))),
        body: FutureBuilder<Map<String, ProductItem>>(
          future: _products,
          builder: (context, snap) {
            final products = snap.data ?? const <String, ProductItem>{};
            final receivable = widget.canReceive && o.receivable;
            final sendable = widget.canManage && o.status == 'DRAFT';
            return ListView(
              padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
              children: [
                Wrap(spacing: AppTokens.spacingSm, runSpacing: AppTokens.spacingXs, children: [
                  StatusChip(label: poStatusLabel(l10n, o.status), tone: poStatusTone(o.status)),
                ]),
                const SizedBox(height: AppTokens.spacingSm),
                if (o.createdAt != null) Text(l10n.poCreatedOn(purchaseDate(o.createdAt!, locale))),
                if (o.expectedAt != null) Text(l10n.poExpectedOn(purchaseDate(o.expectedAt!, locale))),
                const SizedBox(height: AppTokens.spacingMd),
                Card(
                  margin: EdgeInsets.zero,
                  elevation: 0,
                  color: theme.colorScheme.surfaceContainerLow,
                  child: Column(children: [
                    for (final l in o.lines)
                      ListTile(
                        title: Text(products[l.productId]?.name ?? l10n.invUnknownProduct),
                        subtitle: Text(l10n.poLineSummary(
                          formatQty(l.orderedMilli, products[l.productId]?.unitType ?? 'UNIT'),
                          formatQty(l.receivedMilli, products[l.productId]?.unitType ?? 'UNIT'),
                          MoneyText.format(l.unitCostMinor),
                        )),
                      ),
                  ]),
                ),
                const SizedBox(height: AppTokens.spacingMd),
                Row(children: [
                  Expanded(child: Text(l10n.poTotal, style: theme.textTheme.titleMedium)),
                  MoneyText(o.totalMinor, style: theme.textTheme.titleLarge),
                ]),
                if (_error != null) ...[
                  const SizedBox(height: AppTokens.spacingSm),
                  Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                ],
                const SizedBox(height: AppTokens.spacingLg),
                if (sendable)
                  PPButton.primary(label: l10n.poMarkSent, onPressed: _busy ? null : () => _setStatus('SENT'))
                else if (receivable)
                  PPButton.primary(
                      label: l10n.poReceive,
                      onPressed: _busy || snap.data == null ? null : () => _receive(products)),
                if (widget.canManage && o.cancellable) ...[
                  const SizedBox(height: AppTokens.spacingSm),
                  PPButton.text(label: l10n.poCancel, onPressed: _busy ? null : () => _setStatus('CANCELLED')),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _LineEditor {
  _LineEditor({this.productId, int quantityMilli = 0})
      : qty = TextEditingController(text: quantityMilli > 0 ? formatQty(quantityMilli, 'UNIT') : '');
  String? productId;
  final TextEditingController qty;
  final TextEditingController cost = TextEditingController();

  void dispose() {
    qty.dispose();
    cost.dispose();
  }
}

class _EditorRefs {
  const _EditorRefs(this.suppliers, this.warehouses, this.products);
  final List<SupplierItem> suppliers;
  final List<WarehouseItem> warehouses;
  final List<ProductItem> products;
}

/// Editor de S-INV-05: proveedor, bodega de destino, fecha esperada y líneas (producto,
/// cantidad, costo unitario). "Guardar borrador" crea la orden; el total lo calcula el servidor.
class PurchaseOrderEditorScreen extends StatefulWidget {
  const PurchaseOrderEditorScreen(
      {super.key, required this.api, this.supplierId = '', this.lines = const []});
  final ApiClient api;
  final String supplierId;
  final List<PurchaseLineDraft> lines;

  @override
  State<PurchaseOrderEditorScreen> createState() => _PurchaseOrderEditorScreenState();
}

class _PurchaseOrderEditorScreenState extends State<PurchaseOrderEditorScreen> {
  late final Future<_EditorRefs> _refs = _load();
  late String _supplier = widget.supplierId;
  String _warehouse = '';
  DateTime? _expected;
  late final List<_LineEditor> _lines = [
    for (final l in widget.lines) _LineEditor(productId: l.productId, quantityMilli: l.quantityMilli),
    if (widget.lines.isEmpty) _LineEditor(),
  ];
  final String _key = newRequestId();
  bool _saving = false;
  bool _submitted = false;
  String? _error;

  Future<_EditorRefs> _load() async {
    final suppliers = (await loadSuppliers(widget.api)).where((s) => s.active).toList();
    final warehouses = (await loadWarehouses(widget.api)).where((w) => w.active).toList();
    final products = (await loadProductIndex(widget.api)).values.where((p) => p.tracksInventory).toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    final def = warehouses.where((w) => w.isDefault);
    _warehouse = def.isNotEmpty ? def.first.id : (warehouses.isEmpty ? '' : warehouses.first.id);
    if (!suppliers.any((s) => s.id == _supplier)) _supplier = '';
    return _EditorRefs(suppliers, warehouses, products);
  }

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    super.dispose();
  }

  bool _lineValid(_LineEditor l) =>
      l.productId != null &&
      (parseQtyMilli(l.qty.text) ?? 0) > 0 &&
      MoneyText.parse(l.cost.text) != null;

  bool get _valid =>
      _supplier.isNotEmpty &&
      _warehouse.isNotEmpty &&
      _lines.isNotEmpty &&
      _lines.every(_lineValid) &&
      _lines.map((l) => l.productId).toSet().length == _lines.length;

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expected ?? now.add(const Duration(days: 7)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _expected = picked);
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitted = true;
      _error = null;
    });
    if (!_valid) return;
    setState(() => _saving = true);
    try {
      final order = <String, Object?>{
        'supplier_id': _supplier,
        'warehouse_id': _warehouse,
        if (_expected != null) 'expected_at': _expected!.toUtc().toIso8601String(),
        'lines': [
          for (final l in _lines)
            PurchaseLineItem(
              productId: l.productId!,
              orderedMilli: parseQtyMilli(l.qty.text)!,
              unitCostMinor: MoneyText.parse(l.cost.text)!,
            ).toJson(),
        ],
      };
      await widget.api.createPurchaseOrder(order, idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.poSaved)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      if (mounted) setState(() => _error = purchasingErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.poNew)),
      body: FutureBuilder<_EditorRefs>(
        future: _refs,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_EditorRefs>(
              snapshot: snap,
              errorMessage: snap.hasError ? purchasingErrorMessage(l10n, snap.error!) : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => Navigator.of(context).pop(),
              emptyView: const SizedBox.shrink(),
              builder: (context, refs) {
                if (refs.suppliers.isEmpty) {
                  return Text(l10n.poNeedsSupplier, style: theme.textTheme.bodyLarge);
                }
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  DropdownButtonFormField<String>(
                    initialValue: _supplier.isEmpty ? null : _supplier,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: l10n.poSupplier,
                      errorText: _submitted && _supplier.isEmpty ? l10n.fiscalFieldRequired : null,
                    ),
                    items: [
                      for (final s in refs.suppliers) DropdownMenuItem(value: s.id, child: Text(s.name)),
                    ],
                    onChanged: (v) => setState(() => _supplier = v ?? ''),
                  ),
                  const SizedBox(height: AppTokens.spacingSm),
                  DropdownButtonFormField<String>(
                    initialValue: _warehouse.isEmpty ? null : _warehouse,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l10n.poWarehouse),
                    items: [
                      for (final w in refs.warehouses) DropdownMenuItem(value: w.id, child: Text(w.name)),
                    ],
                    onChanged: (v) => setState(() => _warehouse = v ?? ''),
                  ),
                  const SizedBox(height: AppTokens.spacingSm),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_outlined),
                    title: Text(l10n.poExpected),
                    subtitle: Text(_expected == null ? l10n.poExpectedNone : purchaseDate(_expected!, locale)),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: AppTokens.spacingSm),
                  Semantics(header: true, child: Text(l10n.poLines, style: theme.textTheme.titleMedium)),
                  const SizedBox(height: AppTokens.spacingSm),
                  for (final (i, line) in _lines.indexed)
                    _LineCard(
                      key: ObjectKey(line),
                      line: line,
                      products: refs.products,
                      submitted: _submitted,
                      duplicate: line.productId != null &&
                          _lines.where((o) => o.productId == line.productId).length > 1,
                      onChanged: () => setState(() {}),
                      onRemove: _lines.length == 1
                          ? null
                          : () => setState(() => _lines.removeAt(i).dispose()),
                    ),
                  PPButton.text(
                    label: l10n.poAddLine,
                    onPressed: () => setState(() => _lines.add(_LineEditor())),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppTokens.spacingSm),
                    Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                  ],
                  const SizedBox(height: AppTokens.spacingLg),
                  PPButton.primary(label: l10n.poSaveDraft, onPressed: _saving ? null : _save),
                ]);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard(
      {super.key,
      required this.line,
      required this.products,
      required this.submitted,
      required this.duplicate,
      required this.onChanged,
      required this.onRemove});
  final _LineEditor line;
  final List<ProductItem> products;
  final bool submitted;
  final bool duplicate;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final known = products.any((p) => p.id == line.productId);
    return Card(
      margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          DropdownButtonFormField<String>(
            initialValue: known ? line.productId : null,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: l10n.poProduct,
              errorText: duplicate
                  ? l10n.poDuplicateProduct
                  : (submitted && line.productId == null ? l10n.fiscalFieldRequired : null),
            ),
            items: [for (final p in products) DropdownMenuItem(value: p.id, child: Text(p.name))],
            onChanged: (v) {
              line.productId = v;
              onChanged();
            },
          ),
          const SizedBox(height: AppTokens.spacingSm),
          PPTextField(
            controller: line.qty,
            labelText: l10n.poQuantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => onChanged(),
            error: submitted && (parseQtyMilli(line.qty.text) ?? 0) <= 0 ? l10n.fiscalFieldRequired : null,
          ),
          const SizedBox(height: AppTokens.spacingSm),
          PPTextField(
            controller: line.cost,
            labelText: l10n.poUnitCost,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => onChanged(),
            error: submitted && MoneyText.parse(line.cost.text) == null ? l10n.fiscalFieldRequired : null,
          ),
          if (onRemove != null)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: PPButton.text(label: l10n.poRemoveLine, onPressed: onRemove),
            ),
        ]),
      ),
    );
  }
}
