import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'checkout_screen.dart';
import 'market_data.dart';
import 'market_widgets.dart';

class _CartView {
  const _CartView(this.lines, this.quote);
  final List<CartLine> lines;

  /// Cotización vigente (nombres de tienda, existencias, totales del servidor); null si falló.
  final OrderQuote? quote;
}

/// S-MKT-04 · `/market/cart` · Carrito. `orders:create:self` · `/v1/cart`, `/v1/orders/quote`.
///
/// e1 grupos por tienda (cada uno es un sub-pedido) · e2 línea con cantidad ± (0 elimina, con
/// "Deshacer" 4 s) · e3 "Agotado" según la cotización · e4 subtotal por tienda · e5 total de
/// productos y "El envío se calcula en el siguiente paso" · e6 "Continuar" (deshabilitado con
/// líneas agotadas).
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  late Future<_CartView> _future = _load();
  bool _busy = false;

  Future<_CartView> _load() async {
    final lines = cartLines(await widget.api.getCart());
    if (lines.isEmpty) return _CartView(lines, null);
    OrderQuote? quote;
    try {
      quote = OrderQuote.fromJson(await widget.api.quoteOrder());
    } on ApiException catch (e) {
      // Sin cotización el carrito se muestra con los precios guardados y no deja continuar.
      widget.api.logger.breadcrumb('ui', 'market.cart_quote', e.reason);
    }
    return _CartView(lines, quote);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _setQty(CartLine line, int qty) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await widget.api
          .setCartItem(line.productId, qty, idempotencyKey: newRequestId());
      if (qty == 0) {
        messenger.showSnackBar(SnackBar(
          duration: const Duration(seconds: 4),
          content: Text(l10n.mktRemoved(line.name)),
          action: SnackBarAction(
              label: l10n.mktUndo,
              onPressed: () => _setQty(line, line.qtyMilli)),
        ));
      }
      if (mounted) _reload();
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.cart_set', e is ApiException ? e.reason : 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _continue() async {
    // Al volver (del pedido creado o de un cambio de precio) el carrito se relee: lo cobrado
    // ya salió de él.
    await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => CheckoutScreen(api: widget.api)));
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return FutureBuilder<_CartView>(
      future: _future,
      builder: (context, snap) {
        final view = snap.data;
        final canContinue = view != null &&
            view.lines.isNotEmpty &&
            view.quote != null &&
            view.quote!.allInStock &&
            !_busy;
        return Scaffold(
          appBar: AppBar(title: Text(l10n.mktCart)),
          bottomNavigationBar: view == null || view.lines.isEmpty
              ? null
              : SafeArea(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingSm,
                        margin, AppTokens.spacingSm),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Text(
                          l10n.mktItemsTotal(MoneyText.format(view
                                  .quote?.itemsMinor ??
                              view.lines
                                  .fold<int>(0, (a, l) => a + l.totalMinor))),
                          style: theme.textTheme.titleMedium),
                      Text(l10n.mktShippingNext,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall),
                      const SizedBox(height: AppTokens.spacingSm),
                      PPButton.primary(
                          label: l10n.mktContinue,
                          onPressed: canContinue ? _continue : null),
                    ]),
                  ),
                ),
          body: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
            children: [
              AsyncView<_CartView>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? marketErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                isEmpty: (v) => v.lines.isEmpty,
                emptyView: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                  child: Column(children: [
                    Text(l10n.mktCartEmpty,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyLarge),
                    const SizedBox(height: AppTokens.spacingSm),
                    PPButton.text(
                        label: l10n.mktExplore,
                        onPressed: () => Navigator.of(context).pop()),
                  ]),
                ),
                builder: (context, v) => Column(children: [
                  for (final tenant in {for (final l in v.lines) l.tenantId})
                    _StoreGroup(
                      lines: [
                        for (final l in v.lines)
                          if (l.tenantId == tenant) l
                      ],
                      quote: v.quote?.merchants
                          .where((m) => m.tenantId == tenant)
                          .firstOrNull,
                      busy: _busy,
                      onQty: _setQty,
                    ),
                ]),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StoreGroup extends StatelessWidget {
  const _StoreGroup(
      {required this.lines,
      required this.quote,
      required this.busy,
      required this.onQty});
  final List<CartLine> lines;
  final MerchantQuoteItem? quote;
  final bool busy;
  final void Function(CartLine, int) onQty;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final q = quote;
    final name =
        q != null && q.name.isNotEmpty ? q.name : l10n.mktStoreFallback;
    final subtotal =
        q?.itemsMinor ?? lines.fold<int>(0, (a, l) => a + l.totalMinor);
    return Card(
      margin: const EdgeInsets.only(bottom: AppTokens.spacingMd),
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: theme.textTheme.titleMedium),
            for (final l in lines) ...[
              const Divider(),
              Text(l.name, style: theme.textTheme.bodyLarge),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppTokens.spacingSm,
                children: [
                  QtyStepper(
                    qtyMilli: l.qtyMilli,
                    stepMilli: l.qtyMilli % 1000 == 0 ? 1000 : 250,
                    label: l10n.mktQuantity,
                    // El carrito no guarda la unidad: la cantidad se muestra sin ella.
                    unitType: 'UNIT',
                    onChanged: busy ? null : (qty) => onQty(l, qty),
                  ),
                  MoneyText(l.totalMinor, style: theme.textTheme.titleSmall),
                  if (q != null && q.unavailable.contains(l.productId))
                    StatusChip(label: l10n.mktSoldOut, tone: StatusTone.error),
                ],
              ),
            ],
            const Divider(),
            Text(l10n.mktSubtotal(MoneyText.format(subtotal)),
                style: theme.textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}
