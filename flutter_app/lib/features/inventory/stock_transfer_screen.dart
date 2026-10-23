import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/format/barcode.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/hid_scanner_listener.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';
import 'inventory_data.dart';

class _TransferRefs {
  const _TransferRefs(this.warehouses, this.products);
  final List<WarehouseItem> warehouses;
  final List<ProductItem> products;
}

/// S-INV-04 · `/inventory/transfer` · Transferencia. `inventory:adjust`.
///
/// Origen, destino distinto, producto y cantidad ≤ disponible en origen: la salida y la entrada se
/// registran juntas en el servidor (o ninguna). El estado "En tránsito → Recibida" con confirmación
/// de la bodega destino y los lotes llegan con F16.4b. F16.11: el producto se puede escanear con la
/// cámara o con un lector (C-27).
class StockTransferScreen extends StatefulWidget {
  const StockTransferScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<StockTransferScreen> createState() => _StockTransferScreenState();
}

class _StockTransferScreenState extends State<StockTransferScreen> {
  late final Future<_TransferRefs> _refs = _load();
  String? _from;
  String? _to;
  ProductItem? _product;
  int? _availableMilli;
  final _qty = TextEditingController();
  String _key = newRequestId();

  /// F16.11: productos que se pueden escanear y antirrebote de lecturas.
  List<ProductItem> _scannable = const [];
  final _debounce = ScanDebouncer();
  bool _saving = false;
  bool _submitted = false;
  String? _error;

  Future<_TransferRefs> _load() async {
    final warehouses =
        (await loadWarehouses(widget.api)).where((w) => w.active).toList();
    final products = (await loadProductIndex(widget.api))
        .values
        .where((p) => p.tracksInventory)
        .toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    _scannable = products;
    return _TransferRefs(warehouses, products);
  }

  Future<void> _scan() async {
    final l10n = AppLocalizations.of(context);
    final code = await BarcodeScannerDialog.scan(context,
        logger: widget.api.logger,
        title: l10n.scanBarcode,
        subtitle: l10n.invProduct);
    if (code == null || !mounted) return;
    _onCode(code);
  }

  /// C-27: el código elige el producto; desconocido solo avisa.
  void _onCode(String code) {
    if (!_debounce.accept(code)) return;
    final match = productByCode(_scannable, code);
    if (match == null) {
      widget.api.logger
          .breadcrumb('ui', 'scan_unknown_code', 'len=${code.trim().length}');
      setState(() => _error = AppLocalizations.of(context).posNotFound);
      return;
    }
    setState(() {
      _product = match;
      _availableMilli = null;
      _error = null;
    });
    _refreshAvailable();
  }

  Future<void> _refreshAvailable() async {
    final p = _product;
    final from = _from;
    if (p == null || from == null) return;
    try {
      final body = await widget.api.getStock(p.id, warehouseId: from);
      if (mounted) {
        setState(
            () => _availableMilli = StockItem.fromJson(body).availableMilli);
      }
    } on Object catch (e) {
      widget.api.logger.breadcrumb('ui', 'inventory.available',
          e is ApiException ? e.reason : 'network');
      if (mounted) {
        setState(() =>
            _error = catalogErrorMessage(AppLocalizations.of(context), e));
      }
    }
  }

  @override
  void dispose() {
    _qty.dispose();
    super.dispose();
  }

  Future<void> _transfer() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    final qty = parseQtyMilli(_qty.text);
    if (_from == null ||
        _to == null ||
        _product == null ||
        qty == null ||
        qty <= 0) {
      return;
    }
    if (_from == _to) {
      setState(() => _error = l10n.error_SAME_WAREHOUSE);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.transferStock(
          productId: _product!.id,
          fromWarehouseId: _from!,
          toWarehouseId: _to!,
          quantityMilli: qty,
          idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.invTransferDone)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'inventory.transfer', e is ApiException ? e.reason : 'network');
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
      appBar: AppBar(title: Text(l10n.invTransferTitle)),
      body: HidScannerListener(
        onScan: _onCode,
        child: FutureBuilder<_TransferRefs>(
          future: _refs,
          builder: (context, snap) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
            children: [
              AsyncView<_TransferRefs>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? catalogErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute<bool>(
                        builder: (_) => StockTransferScreen(api: widget.api))),
                emptyView: const SizedBox.shrink(),
                builder: (context, refs) {
                  if (refs.warehouses.length < 2) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: AppTokens.spacingXl),
                      child: Text(l10n.invNeedTwoWarehouses,
                          textAlign: TextAlign.center),
                    );
                  }
                  final qty = parseQtyMilli(_qty.text);
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        DropdownButtonFormField<String>(
                          initialValue: _from,
                          isExpanded: true,
                          decoration: InputDecoration(labelText: l10n.invFrom),
                          items: [
                            for (final w in refs.warehouses)
                              DropdownMenuItem(value: w.id, child: Text(w.name))
                          ],
                          onChanged: (id) {
                            setState(() => _from = id);
                            _refreshAvailable();
                          },
                        ),
                        gap,
                        DropdownButtonFormField<String>(
                          initialValue: _to,
                          isExpanded: true,
                          decoration: InputDecoration(
                              labelText: l10n.invTo,
                              errorText: _to != null && _to == _from
                                  ? l10n.error_SAME_WAREHOUSE
                                  : null),
                          items: [
                            for (final w in refs.warehouses)
                              DropdownMenuItem(value: w.id, child: Text(w.name))
                          ],
                          onChanged: (id) => setState(() => _to = id),
                        ),
                        gap,
                        Row(children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              // La clave refleja una selección hecha por escaneo.
                              key: ValueKey('transfer-product-${_product?.id}'),
                              initialValue: _product?.id,
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
                              onChanged: (id) {
                                setState(() => _product = refs.products
                                    .firstWhere((p) => p.id == id));
                                _refreshAvailable();
                              },
                            ),
                          ),
                          IconButton(
                            tooltip: l10n.scanBarcode,
                            icon: const Icon(Icons.qr_code_scanner),
                            onPressed: _scan,
                          ),
                        ]),
                        if (_availableMilli != null && _product != null) ...[
                          const SizedBox(height: AppTokens.spacingSm),
                          Text(
                              '${l10n.invAvailable}: ${formatQty(_availableMilli!, _product!.unitType)}',
                              style: theme.textTheme.bodyLarge),
                        ],
                        gap,
                        TextField(
                          controller: _qty,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: l10n.invQuantity,
                            errorText: _submitted && (qty == null || qty <= 0)
                                ? l10n.invQtyError
                                : (qty != null &&
                                        _availableMilli != null &&
                                        qty > _availableMilli!)
                                    ? l10n.error_OUT_OF_STOCK
                                    : null,
                          ),
                        ),
                        if (_error != null) ...[
                          gap,
                          Semantics(
                              liveRegion: true,
                              child: Text(_error!,
                                  style: TextStyle(
                                      color: theme.colorScheme.error))),
                        ],
                        const SizedBox(height: AppTokens.spacingLg),
                        PPButton.primary(
                            label: l10n.invTransfer,
                            loading: _saving,
                            onPressed: _transfer),
                      ]);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
