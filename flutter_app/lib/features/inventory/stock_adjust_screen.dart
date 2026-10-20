import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';
import 'inventory_data.dart';

/// Motivos de S-INV-03 e3. Daño, vencimiento y pérdida que bajan existencia son una baja
/// (WRITE_OFF); el resto, un ajuste (ADJUSTMENT).
enum AdjustReason { count, damage, expired, loss, error, other }

String adjustReasonLabel(AppLocalizations l10n, AdjustReason r) => switch (r) {
      AdjustReason.count => l10n.invReason_COUNT,
      AdjustReason.damage => l10n.invReason_DAMAGE,
      AdjustReason.expired => l10n.invReason_EXPIRED,
      AdjustReason.loss => l10n.invReason_LOSS,
      AdjustReason.error => l10n.invReason_ERROR,
      AdjustReason.other => l10n.invReason_OTHER,
    };

/// Tipo de movimiento del ajuste según el motivo y el sentido.
String adjustMovementType(AdjustReason r, int deltaMilli) => deltaMilli < 0 &&
        (r == AdjustReason.damage ||
            r == AdjustReason.expired ||
            r == AdjustReason.loss)
    ? 'MOVEMENT_TYPE_WRITE_OFF'
    : 'MOVEMENT_TYPE_ADJUSTMENT';

class _AdjustRefs {
  const _AdjustRefs(this.warehouses, this.products);
  final List<WarehouseItem> warehouses;
  final List<ProductItem> products;
}

/// S-INV-03 · `/inventory/adjust` · Ajuste. `inventory:adjust`.
///
/// e1 bodega, e2 producto con "Sistema {n} · Contado · Diferencia" (se puede escanear), e3 motivo
/// obligatorio, e5 "Aplicar ajuste" con confirmación (C-05). Un ajuste no se edita ni se borra.
/// La evidencia adjunta (e4) llega con F16.2b.
class StockAdjustScreen extends StatefulWidget {
  const StockAdjustScreen({super.key, required this.api, this.product});
  final ApiClient api;
  final ProductItem? product;

  @override
  State<StockAdjustScreen> createState() => _StockAdjustScreenState();
}

class _StockAdjustScreenState extends State<StockAdjustScreen> {
  late final Future<_AdjustRefs> _refs = _load();
  String _warehouse = '';
  late ProductItem? _product = widget.product;
  int? _systemMilli;
  final _counted = TextEditingController();
  final _otherReason = TextEditingController();
  AdjustReason? _reason;
  String _key = newRequestId();
  bool _saving = false;
  bool _submitted = false;
  String? _error;

  Future<_AdjustRefs> _load() async {
    final warehouses = await loadWarehouses(widget.api);
    final products = await loadProductIndex(widget.api);
    final def = warehouses.where((w) => w.isDefault);
    _warehouse = def.isNotEmpty
        ? def.first.id
        : (warehouses.isEmpty ? '' : warehouses.first.id);
    final tracked = products.values.where((p) => p.tracksInventory).toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    if (_product != null) await _loadSystem();
    return _AdjustRefs(warehouses.where((w) => w.active).toList(), tracked);
  }

  Future<void> _loadSystem() async {
    final p = _product;
    if (p == null || _warehouse.isEmpty) return;
    final body = await widget.api.getStock(p.id, warehouseId: _warehouse);
    if (mounted) {
      setState(() => _systemMilli = StockItem.fromJson(body).onHandMilli);
    }
  }

  Future<void> _pick(ProductItem? p) async {
    setState(() {
      _product = p;
      _systemMilli = null;
      _error = null;
    });
    try {
      await _loadSystem();
    } on Object catch (e) {
      widget.api.logger.breadcrumb('ui', 'inventory.system_qty',
          e is ApiException ? e.reason : 'network');
      if (mounted) {
        setState(() =>
            _error = catalogErrorMessage(AppLocalizations.of(context), e));
      }
    }
  }

  Future<void> _scan(List<ProductItem> products) async {
    final l10n = AppLocalizations.of(context);
    final code = await BarcodeScannerDialog.scan(context,
        title: l10n.scanBarcode, subtitle: l10n.invProduct);
    if (code == null || !mounted) return;
    final match = products.where((p) => p.barcode == code.trim());
    if (match.isEmpty) {
      setState(() => _error = l10n.posNotFound);
      return;
    }
    await _pick(match.first);
  }

  @override
  void dispose() {
    _counted.dispose();
    _otherReason.dispose();
    super.dispose();
  }

  int? get _delta {
    final counted = parseQtyMilli(_counted.text);
    final system = _systemMilli;
    if (counted == null || system == null) return null;
    return counted - system;
  }

  String get _reasonText {
    final l10n = AppLocalizations.of(context);
    final r = _reason;
    if (r == null) return '';
    return r == AdjustReason.other
        ? _otherReason.text.trim()
        : adjustReasonLabel(l10n, r);
  }

  Future<void> _apply() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    final delta = _delta;
    if (_product == null || delta == null || _reasonText.isEmpty) return;
    if (delta == 0) {
      setState(() => _error = l10n.invNoDifference);
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.invAdjustConfirmTitle),
        content: Text(l10n.invAdjustConfirmBody),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.invApplyAdjust)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.adjustStock(
        productId: _product!.id,
        warehouseId: _warehouse,
        deltaMilli: delta,
        type: adjustMovementType(_reason!, delta),
        reason: _reasonText,
        idempotencyKey: _key,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.invAdjustDone)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'inventory.adjust', e is ApiException ? e.reason : 'network');
      if (e is ApiException) _key = newRequestId();
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    const gap = SizedBox(height: AppTokens.spacingMd);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.invAdjustTitle)),
      body: FutureBuilder<_AdjustRefs>(
        future: _refs,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_AdjustRefs>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => Navigator.of(context).pushReplacement(
                  MaterialPageRoute<bool>(
                      builder: (_) => StockAdjustScreen(
                          api: widget.api, product: widget.product))),
              emptyView: const SizedBox.shrink(),
              builder: (context, refs) {
                final unit = _product?.unitType ?? 'UNIT';
                final delta = _delta;
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue:
                            refs.warehouses.any((w) => w.id == _warehouse)
                                ? _warehouse
                                : null,
                        isExpanded: true,
                        decoration:
                            InputDecoration(labelText: l10n.invWarehouse),
                        items: [
                          for (final w in refs.warehouses)
                            DropdownMenuItem(value: w.id, child: Text(w.name))
                        ],
                        onChanged: (id) {
                          _warehouse = id ?? '';
                          _pick(_product);
                        },
                      ),
                      gap,
                      Row(children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue:
                                refs.products.any((p) => p.id == _product?.id)
                                    ? _product!.id
                                    : null,
                            isExpanded: true,
                            decoration: InputDecoration(
                                labelText: l10n.invProduct,
                                errorText: _submitted && _product == null
                                    ? l10n.invSelectProduct
                                    : null),
                            items: [
                              for (final p in refs.products)
                                DropdownMenuItem(
                                    value: p.id, child: Text(p.name))
                            ],
                            onChanged: (id) => _pick(
                                refs.products.firstWhere((p) => p.id == id)),
                          ),
                        ),
                        IconButton(
                          tooltip: l10n.scanBarcode,
                          icon: const Icon(Icons.qr_code_scanner),
                          onPressed: () => _scan(refs.products),
                        ),
                      ]),
                      if (_product != null && _systemMilli != null) ...[
                        gap,
                        Text(l10n.invSystemQty(formatQty(_systemMilli!, unit)),
                            style: theme.textTheme.titleMedium),
                        gap,
                        TextField(
                          controller: _counted,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: l10n.invCounted,
                            errorText: _submitted &&
                                    parseQtyMilli(_counted.text) == null
                                ? l10n.invQtyError
                                : null,
                          ),
                        ),
                        if (delta != null) ...[
                          const SizedBox(height: AppTokens.spacingSm),
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              l10n.invDifferenceQty(
                                  '${delta > 0 ? '+' : ''}${formatQty(delta, unit)}'),
                              style: theme.textTheme.titleMedium?.copyWith(
                                  color: delta < 0
                                      ? theme.colorScheme.error
                                      : theme.colorScheme.primary),
                            ),
                          ),
                        ],
                      ],
                      gap,
                      DropdownButtonFormField<AdjustReason>(
                        initialValue: _reason,
                        isExpanded: true,
                        decoration: InputDecoration(
                            labelText: l10n.invReason,
                            errorText: _submitted && _reason == null
                                ? l10n.error_MOVEMENT_REASON_REQUIRED
                                : null),
                        items: [
                          for (final r in AdjustReason.values)
                            DropdownMenuItem(
                                value: r,
                                child: Text(adjustReasonLabel(l10n, r))),
                        ],
                        onChanged: (r) => setState(() => _reason = r),
                      ),
                      if (_reason == AdjustReason.other) ...[
                        const SizedBox(height: AppTokens.spacingSm),
                        TextField(
                          controller: _otherReason,
                          maxLength: 300,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: l10n.invReasonOtherHint,
                            errorText:
                                _submitted && _otherReason.text.trim().isEmpty
                                    ? l10n.error_MOVEMENT_REASON_REQUIRED
                                    : null,
                          ),
                        ),
                      ],
                      if (_error != null) ...[
                        gap,
                        Semantics(
                            liveRegion: true,
                            child: Text(_error!,
                                style:
                                    TextStyle(color: theme.colorScheme.error))),
                      ],
                      const SizedBox(height: AppTokens.spacingLg),
                      PPButton.primary(
                          label: l10n.invApplyAdjust,
                          loading: _saving,
                          onPressed: _apply),
                    ]);
              },
            ),
          ],
        ),
      ),
    );
  }
}
