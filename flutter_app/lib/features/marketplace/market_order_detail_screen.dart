import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/pay_data.dart' show payErrorMessage;
import '../wallet/wallet_data.dart' show walletDateTime;
import 'market_data.dart';
import 'market_widgets.dart';

/// S-MKT-07 · `/market/orders/:id` · Detalle del pedido. `orders:read:self` · `GET /v1/orders/{id}`.
///
/// e1 número, fecha y total · e2 tarjeta por tienda con su estado (cuenta regresiva mientras espera
/// a la tienda) · e5 código de retiro · e6 productos · e8 "Cancelar" solo antes de "Aceptado" (C-05).
/// Rechazo: "{tienda} no pudo aceptar tu pedido. Te devolvimos {monto}." Se relee cada pocos
/// segundos mientras el pedido está en curso. Mapa, factura, devoluciones y reclamos (e4, e7, e9,
/// e10) llegan con logistics, fiscal-invoicing y el servicio de reclamos: sin servicio no se muestran.
class MarketOrderDetailScreen extends StatefulWidget {
  const MarketOrderDetailScreen(
      {super.key,
      required this.api,
      required this.orderId,
      this.failure,
      this.pollEvery = const Duration(seconds: 4)});
  final ApiClient api;
  final String orderId;

  /// Rechazo del cobro al confirmarlo (S-MKT-05), si lo hubo.
  final Object? failure;
  final Duration pollEvery;

  @override
  State<MarketOrderDetailScreen> createState() =>
      _MarketOrderDetailScreenState();
}

class _MarketOrderDetailScreenState extends State<MarketOrderDetailScreen> {
  late Future<OrderItem> _future = _load();
  Map<String, String> _names = const {};
  Timer? _poll;
  Timer? _tick;
  bool _cancelling = false;

  Future<OrderItem> _load() async {
    final o = OrderItem.fromJson(await widget.api.getOrder(widget.orderId));
    final missing =
        o.subs.map((s) => s.tenantId).where((t) => !_names.containsKey(t));
    if (missing.isNotEmpty) {
      _names = {..._names, ...await storeNames(widget.api, missing)};
    }
    _schedule(o);
    return o;
  }

  void _schedule(OrderItem o) {
    _poll?.cancel();
    if (o.inProgress) {
      _poll = Timer(widget.pollEvery, () {
        if (!mounted) return;
        setState(() {
          _future = _load();
        });
      });
    }
    final waiting = o.subs.any((s) => s.status == 'AWAITING_ACCEPTANCE');
    if (waiting && _tick == null) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    } else if (!waiting) {
      _tick?.cancel();
      _tick = null;
    }
  }

  @override
  void initState() {
    super.initState();
    final f = widget.failure;
    if (f != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(payErrorMessage(AppLocalizations.of(context), f))));
      });
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _cancel(OrderItem o) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.mktCancelOrder),
        content: Text(l10n.mktCancelConfirm),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(l10n.actionClose)),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.mktCancelOrder)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      final updated = OrderItem.fromJson(
          await widget.api.cancelOrder(o.id, idempotencyKey: 'cancel:${o.id}'));
      if (!mounted) return;
      _schedule(updated);
      setState(() {
        _future = Future.value(updated);
      });
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.cancel', e is ApiException ? e.reason : 'network');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Scaffold(
      appBar:
          AppBar(title: Text(l10n.mktOrderNumber(orderNumber(widget.orderId)))),
      body: FutureBuilder<OrderItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
          children: [
            AsyncView<OrderItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? marketErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, o) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Card(
                    margin: EdgeInsets.zero,
                    elevation: 0,
                    color: theme.colorScheme.surfaceContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(AppTokens.spacingMd),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (o.createdAt != null)
                            Text(walletDateTime(o.createdAt!, locale),
                                style: theme.textTheme.bodyMedium),
                          MoneyText(o.grandTotalMinor,
                              style: theme.textTheme.headlineMedium),
                          const SizedBox(height: AppTokens.spacingXs),
                          StatusChip(
                              label: orderStatusLabel(l10n, o.status),
                              tone: orderTone(o.status)),
                          if (o.status == 'PENDING_PAYMENT') ...[
                            const SizedBox(height: AppTokens.spacingSm),
                            Text(l10n.mktOrderPaying,
                                style: theme.textTheme.bodySmall),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppTokens.spacingMd),
                  for (final s in o.subs)
                    _SubCard(sub: s, store: _names[s.tenantId] ?? ''),
                  if (o.cancellable)
                    PPButton.secondary(
                      label: l10n.mktCancelOrder,
                      loading: _cancelling,
                      onPressed: () => _cancel(o),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubCard extends StatelessWidget {
  const _SubCard({required this.sub, required this.store});
  final SubOrderItem sub;
  final String store;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final name = store.isEmpty ? l10n.mktStoreFallback : store;
    final deadline = sub.deadline;
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
            const SizedBox(height: AppTokens.spacingXs),
            StatusChip(
                label: subStatusLabel(l10n, sub.status),
                tone: subTone(sub.status)),
            if (sub.status == 'AWAITING_ACCEPTANCE' && deadline != null) ...[
              const SizedBox(height: AppTokens.spacingXs),
              Text(
                  l10n.mktCountdown(
                      countdown(deadline.difference(DateTime.now()))),
                  style: theme.textTheme.bodySmall),
            ],
            // Rechazo o vencimiento del plazo de un sub-pedido pagado: su parte se reembolsa (R5).
            if (sub.status == 'REJECTED')
              Padding(
                padding: const EdgeInsets.only(top: AppTokens.spacingSm),
                child: Text(
                    l10n.mktRejectedRefund(
                        name, MoneyText.format(sub.totalMinor)),
                    style: theme.textTheme.bodyMedium),
              ),
            if (sub.pickupCode.isNotEmpty &&
                !sub.lost &&
                sub.status != 'COMPLETED')
              Padding(
                padding: const EdgeInsets.only(top: AppTokens.spacingSm),
                child: Card(
                  margin: EdgeInsets.zero,
                  elevation: 0,
                  color: theme.colorScheme.primaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(AppTokens.spacingMd),
                    child: Text(l10n.mktPickupCode(sub.pickupCode),
                        key: const Key('pickup-code'),
                        style: theme.textTheme.titleMedium?.copyWith(
                            color: theme.colorScheme.onPrimaryContainer)),
                  ),
                ),
              ),
            const Divider(),
            for (final l in sub.lines)
              Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingXs),
                child: Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  spacing: AppTokens.spacingSm,
                  children: [
                    Text('${formatQtyLabel(l.qtyMilli, 'UNIT')} × ${l.name}',
                        style: theme.textTheme.bodyMedium),
                    MoneyText(l.totalMinor, style: theme.textTheme.bodyMedium),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
