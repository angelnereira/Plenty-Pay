import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../auth/step_up_dialog.dart';
import '../wallet/pay_data.dart' show stepUpPaymentCreate;
import 'market_data.dart';
import 'market_order_detail_screen.dart';

/// S-MKT-05 · `/market/checkout` · Pagar el pedido. `orders:create:self` · `POST /v1/orders/quote`,
/// `POST /v1/orders`, `POST /v1/payments/intents/{id}/confirm` · 🔒 desde el umbral · N-CON-01, N-PAG-06.
///
/// e1 retiro en tienda (la entrega a domicilio llega con logistics, F18) · e4 saldo PlentyPay ·
/// e5 resumen por tienda · e6 productos, comisión, ITBMS incluido y **Total a pagar** · e7 plazo
/// de aceptación · e8 "Pagar {total}". Flujo: cotiza al abrir; `PRICE_CHANGED` muestra el total
/// nuevo sin cobrar; sin existencias vuelve al carrito; el step-up se pide solo si el servidor
/// responde `STEP_UP_REQUIRED` y se reintenta con LA MISMA clave (orders retoma el mismo pedido).
/// Datos fiscales con RUC (e3) llegan con F13.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  late Future<OrderQuote> _future = _quote();
  bool _paying = false;

  /// Una clave por cotización: el reintento (red o step-up) retoma el mismo pedido; una
  /// cotización nueva es otro intento (grpc-conventions §3).
  String _key = newRequestId();

  Future<OrderQuote> _quote() async {
    final q = OrderQuote.fromJson(await widget.api.quoteOrder());
    _key = newRequestId();
    return q;
  }

  Future<Map<String, dynamic>> _checkout(OrderQuote q) async {
    try {
      return await widget.api.checkoutOrder(q.id, idempotencyKey: _key);
    } on ApiException catch (e) {
      if (e.reason != 'STEP_UP_REQUIRED' || !mounted) rethrow;
      final l10n = AppLocalizations.of(context);
      final token = await StepUpDialog.obtainToken(context,
          api: widget.api,
          operation: stepUpPaymentCreate,
          amountMinor: q.grandTotalMinor,
          currency: 'USD',
          title: l10n.mktCheckoutTitle);
      if (token == null) throw const _Abandoned();
      return widget.api
          .checkoutOrder(q.id, idempotencyKey: _key, stepUpToken: token);
    }
  }

  Future<void> _pay(OrderQuote q) async {
    final l10n = AppLocalizations.of(context);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _paying = true);
    try {
      final order = OrderItem.fromJson(await _checkout(q));
      Object? failure;
      if (order.paymentIntentId.isNotEmpty) {
        try {
          await widget.api.confirmPaymentIntent(order.paymentIntentId,
              idempotencyKey: 'confirm:${order.paymentIntentId}');
        } on ApiException catch (e) {
          // Rechazo definitivo (p. ej. saldo insuficiente): orders cancela el pedido y libera las
          // existencias al recibir el fallo del cobro; el detalle lo muestra.
          widget.api.logger.breadcrumb('ui', 'market.confirm', e.reason);
          failure = e;
        }
      }
      if (!mounted) return;
      await nav.pushReplacement(MaterialPageRoute<void>(
          builder: (_) => MarketOrderDetailScreen(
              api: widget.api, orderId: order.id, failure: failure)));
    } on _Abandoned {
      return;
    } on ApiException catch (e) {
      widget.api.logger.breadcrumb('ui', 'market.checkout', e.reason);
      if (!mounted) return;
      switch (e.reason) {
        case 'PRICE_CHANGED':
          await _priceChanged(q);
        case 'OUT_OF_STOCK' || 'LISTING_UNAVAILABLE' || 'EMPTY_CART':
          messenger.showSnackBar(
              SnackBar(content: Text(marketErrorMessage(l10n, e))));
          nav.pop(false);
        default:
          messenger.showSnackBar(
              SnackBar(content: Text(marketErrorMessage(l10n, e))));
      }
    } on Object catch (e) {
      widget.api.logger.breadcrumb('ui', 'market.checkout', 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  /// "El total cambió de {x} a {y}." con "Aceptar nuevo total" y "Revisar carrito", sin cobrar.
  Future<void> _priceChanged(OrderQuote before) async {
    final l10n = AppLocalizations.of(context);
    final nav = Navigator.of(context);
    final OrderQuote after;
    try {
      after = await _quote();
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.requote', e is ApiException ? e.reason : 'network');
      nav.pop(false);
      return;
    }
    if (!mounted) return;
    final accept = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.mktPriceChangedTitle),
        content: Text(l10n.mktPriceChangedFromTo(
            MoneyText.format(before.grandTotalMinor),
            MoneyText.format(after.grandTotalMinor))),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(l10n.mktReviewCart)),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.mktAcceptNewTotal)),
        ],
      ),
    );
    if (!mounted) return;
    if (accept == true) {
      setState(() {
        _future = Future.value(after);
      });
    } else {
      nav.pop(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return FutureBuilder<OrderQuote>(
      future: _future,
      builder: (context, snap) {
        final q = snap.data;
        return Scaffold(
          appBar: AppBar(title: Text(l10n.mktCheckoutTitle)),
          bottomNavigationBar: q == null
              ? null
              : SafeArea(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingSm,
                        margin, AppTokens.spacingSm),
                    child: PPButton.primary(
                      label: l10n.mktPay(MoneyText.format(q.grandTotalMinor)),
                      loading: _paying,
                      onPressed: q.allInStock ? () => _pay(q) : null,
                    ),
                  ),
                ),
          body: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
            children: [
              AsyncView<OrderQuote>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? marketErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: () => setState(() {
                  _future = _quote();
                }),
                isEmpty: (q) => q.merchants.isEmpty,
                emptyView: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                  child: Text(l10n.mktCartEmpty,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyLarge),
                ),
                builder: (context, q) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Section(children: [
                      ListTile(
                        leading:
                            const Icon(Icons.store_mall_directory_outlined),
                        title: Text(l10n.mktPickup),
                        subtitle: Text(l10n.mktDeliverySoon),
                        trailing: const Icon(Icons.check),
                      ),
                    ]),
                    _Section(title: l10n.mktPayMethod, children: [
                      ListTile(
                        leading:
                            const Icon(Icons.account_balance_wallet_outlined),
                        title: Text(l10n.posMethodWallet),
                        trailing: const Icon(Icons.check),
                      ),
                    ]),
                    _Section(children: [
                      for (final m in q.merchants)
                        ListTile(
                          title: Text(
                              m.name.isEmpty ? l10n.mktStoreFallback : m.name),
                          subtitle: Text(
                              l10n.mktProducts(MoneyText.format(m.itemsMinor))),
                        ),
                    ]),
                    _Section(children: [
                      _Row(l10n.mktProducts(MoneyText.format(q.itemsMinor))),
                      if (q.customerFeesMinor > 0)
                        _Row(
                            '${l10n.payBreakdownFee} ${MoneyText.format(q.customerFeesMinor)}'),
                      _Row(l10n
                          .mktTaxIncludedAmount(MoneyText.format(q.taxMinor))),
                      Padding(
                        padding: const EdgeInsets.all(AppTokens.spacingMd),
                        child: Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          spacing: AppTokens.spacingSm,
                          children: [
                            Text(l10n.mktTotalToPay,
                                style: theme.textTheme.titleMedium),
                            MoneyText(q.grandTotalMinor,
                                style: theme.textTheme.headlineSmall),
                          ],
                        ),
                      ),
                    ]),
                    Text(l10n.mktAcceptNotice,
                        style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Abandoned implements Exception {
  const _Abandoned();
}

class _Section extends StatelessWidget {
  const _Section({this.title, required this.children});
  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.spacingMd),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppTokens.spacingXs),
            child: Text(title!, style: theme.textTheme.titleSmall),
          ),
        Card(
          margin: EdgeInsets.zero,
          elevation: 0,
          color: theme.colorScheme.surfaceContainerLow,
          child: Column(children: children),
        ),
      ]),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppTokens.spacingMd, AppTokens.spacingSm, AppTokens.spacingMd, 0),
        child: Align(
            alignment: Alignment.centerLeft,
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
      );
}
