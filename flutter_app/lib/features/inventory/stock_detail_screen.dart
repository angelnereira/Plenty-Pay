import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';
import '../catalog/listing_switch.dart';
import '../../core/format/dates.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/wallet_data.dart' show walletDateTime;
import 'inventory_data.dart';
import 'stock_adjust_screen.dart';

/// Lo que muestra el detalle.
class StockDetail {
  const StockDetail(
      {required this.warehouses,
      required this.levels,
      required this.movements,
      this.lots = const []});
  final List<WarehouseItem> warehouses;
  final List<StockItem> levels;
  final List<MovementItem> movements;

  /// F16.4: lotes con existencia (solo si el producto maneja lotes).
  final List<LotItem> lots;
}

/// Etiqueta de un tipo de movimiento (S-INV-02).
String movementLabel(AppLocalizations l10n, String type) => switch (type) {
      'RECEIPT' => l10n.mov_RECEIPT,
      'SALE' => l10n.mov_SALE,
      'ADJUSTMENT' => l10n.mov_ADJUSTMENT,
      'TRANSFER_OUT' => l10n.mov_TRANSFER_OUT,
      'TRANSFER_IN' => l10n.mov_TRANSFER_IN,
      'RETURN' => l10n.mov_RETURN,
      'WRITE_OFF' => l10n.mov_WRITE_OFF,
      _ => type,
    };

/// S-INV-02 · `/inventory/:variant` · Detalle de existencias: por bodega, lotes con su vencimiento
/// (vencidos en `error`, por vencer en 30 días en `warning`, F16.4), movimientos con fecha, tipo,
/// lote, cantidad con signo y motivo, e interruptor "Mostrar en el marketplace". La cobertura en
/// días llega con F16.6 en S-INV-08.
class StockDetailScreen extends StatefulWidget {
  const StockDetailScreen(
      {super.key, required this.api, required this.product});
  final ApiClient api;
  final ProductItem product;

  @override
  State<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends State<StockDetailScreen> {
  late Future<StockDetail> _future = _load();
  bool _changed = false;

  Future<StockDetail> _load() async {
    final warehouses = await loadWarehouses(widget.api);
    final levels = await loadStock(widget.api);
    final movements =
        await loadMovements(widget.api, productId: widget.product.id);
    final lots = widget.product.tracksLots
        ? await loadLots(widget.api, widget.product.id)
        : const <LotItem>[];
    return StockDetail(
      warehouses: warehouses,
      levels: levels.where((l) => l.productId == widget.product.id).toList(),
      movements: movements,
      lots: lots,
    );
  }

  void _reload() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final margin = WindowClass.of(context).horizontalMargin;
    final unit = widget.product.unitType;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.product.name)),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            final done = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                    builder: (_) => StockAdjustScreen(
                        api: widget.api, product: widget.product)));
            if (done == true) {
              _changed = true;
              _reload();
            }
          },
          icon: const Icon(Icons.tune),
          label: Text(l10n.invAdjust),
        ),
        body: FutureBuilder<StockDetail>(
          future: _future,
          builder: (context, snap) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 3),
            children: [
              ListingSwitch(api: widget.api, product: widget.product),
              const SizedBox(height: AppTokens.spacingSm),
              AsyncView<StockDetail>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? catalogErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                emptyView: const SizedBox.shrink(),
                builder: (context, d) {
                  final names = {for (final w in d.warehouses) w.id: w.name};
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Semantics(
                            header: true,
                            child: Text(l10n.invByWarehouse,
                                style: theme.textTheme.titleMedium)),
                        const SizedBox(height: AppTokens.spacingSm),
                        Card(
                          margin: EdgeInsets.zero,
                          elevation: 0,
                          color: theme.colorScheme.surfaceContainerLow,
                          child: Column(children: [
                            if (d.levels.isEmpty)
                              ListTile(title: Text(l10n.invNoMovements)),
                            for (final l in d.levels)
                              ListTile(
                                title: Text(
                                    names[l.warehouseId] ?? l10n.invWarehouse),
                                subtitle: Text(
                                    '${l10n.invReserved}: ${formatQty(l.reservedMilli, unit)}'),
                                trailing: Text(
                                    formatQty(l.availableMilli, unit),
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(
                                            color: l.availableMilli < 0
                                                ? theme.colorScheme.error
                                                : null)),
                              ),
                          ]),
                        ),
                        if (widget.product.tracksLots) ...[
                          const SizedBox(height: AppTokens.spacingLg),
                          Semantics(
                              header: true,
                              child: Text(l10n.invLots,
                                  style: theme.textTheme.titleMedium)),
                          const SizedBox(height: AppTokens.spacingSm),
                          Card(
                            margin: EdgeInsets.zero,
                            elevation: 0,
                            color: theme.colorScheme.surfaceContainerLow,
                            child: Column(children: [
                              if (d.lots.isEmpty)
                                ListTile(title: Text(l10n.invNoLots)),
                              for (final lot in d.lots)
                                _LotTile(
                                    lot: lot,
                                    unit: unit,
                                    warehouse: names[lot.warehouseId] ?? ''),
                            ]),
                          ),
                        ],
                        const SizedBox(height: AppTokens.spacingLg),
                        Semantics(
                            header: true,
                            child: Text(l10n.invMovements,
                                style: theme.textTheme.titleMedium)),
                        const SizedBox(height: AppTokens.spacingSm),
                        Card(
                          margin: EdgeInsets.zero,
                          elevation: 0,
                          color: theme.colorScheme.surfaceContainerLow,
                          child: Column(children: [
                            if (d.movements.isEmpty)
                              ListTile(title: Text(l10n.invNoMovements)),
                            for (final m in d.movements)
                              ListTile(
                                title: Text(movementLabel(l10n, m.type)),
                                subtitle: Text([
                                  walletDateTime(m.occurredAt, locale),
                                  names[m.warehouseId] ?? '',
                                  if (m.lotCode.isNotEmpty)
                                    l10n.invLotLabel(m.lotCode),
                                  if (m.reason.isNotEmpty) m.reason,
                                ].where((s) => s.isNotEmpty).join(' · ')),
                                trailing: Text(
                                  '${m.deltaMilli > 0 ? '+' : ''}${formatQty(m.deltaMilli, unit)}',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                      color: m.deltaMilli < 0
                                          ? theme.colorScheme.error
                                          : theme.colorScheme.primary),
                                ),
                              ),
                          ]),
                        ),
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

/// Un lote: código, bodega y vencimiento con el mes en texto; vencido en `error`, por vencer en
/// 30 días en `warning` (S-INV-02). El estado también va en texto, no solo en color.
class _LotTile extends StatelessWidget {
  const _LotTile(
      {required this.lot, required this.unit, required this.warehouse});
  final LotItem lot;
  final String unit;
  final String warehouse;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final soon = lot.expiresWithin(30, DateTime.now());
    final tone =
        lot.expired ? StatusTone.error : (soon ? StatusTone.warning : null);
    return ListTile(
      title: Text(l10n.invLotLabel(lot.code)),
      subtitle: Wrap(
        spacing: AppTokens.spacingSm,
        runSpacing: AppTokens.spacingXs,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text([
            if (warehouse.isNotEmpty) warehouse,
            lot.expiresOn == null
                ? l10n.invLotNoExpiry
                : l10n.invLotExpires(longDate(lot.expiresOn!, locale)),
          ].join(' · ')),
          if (tone != null)
            StatusChip(
                label:
                    lot.expired ? l10n.invLotExpired : l10n.invLotExpiringSoon,
                tone: tone),
        ],
      ),
      trailing: Text(formatQty(lot.onHandMilli, unit),
          style: theme.textTheme.titleMedium),
    );
  }
}
