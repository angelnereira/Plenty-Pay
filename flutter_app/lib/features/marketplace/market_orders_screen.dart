import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/wallet_data.dart' show walletDateTime;
import 'market_data.dart';
import 'market_order_detail_screen.dart';
import 'market_widgets.dart';

/// S-MKT-06 · `/market/orders` · Mis pedidos. `orders:read:self` · `GET /v1/orders`.
///
/// Número, fecha (mes en texto, N-STD-10), tiendas, total y estado; filtro "En curso / Anteriores".
class MarketOrdersScreen extends StatefulWidget {
  const MarketOrdersScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<MarketOrdersScreen> createState() => _MarketOrdersScreenState();
}

class _MarketOrdersScreenState extends State<MarketOrdersScreen> {
  late Future<List<OrderItem>> _future = loadMyOrders(widget.api);
  bool _inProgress = true;

  void _reload() => setState(() {
        _future = loadMyOrders(widget.api);
      });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.mktMyOrders)),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<OrderItem>>(
          future: _future,
          builder: (context, snap) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
            children: [
              SegmentedButton<bool>(
                segments: [
                  ButtonSegment(value: true, label: Text(l10n.mktInProgress)),
                  ButtonSegment(value: false, label: Text(l10n.mktPast)),
                ],
                selected: {_inProgress},
                onSelectionChanged: (s) =>
                    setState(() => _inProgress = s.first),
              ),
              const SizedBox(height: AppTokens.spacingMd),
              AsyncView<List<OrderItem>>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? marketErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                isEmpty: (list) =>
                    list.where((o) => o.inProgress == _inProgress).isEmpty,
                emptyView: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                  child: Text(l10n.mktOrdersEmpty,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyLarge),
                ),
                builder: (context, orders) => Card(
                  margin: EdgeInsets.zero,
                  elevation: 0,
                  color: theme.colorScheme.surfaceContainerLow,
                  child: Column(children: [
                    for (final o in orders)
                      if (o.inProgress == _inProgress)
                        ListTile(
                          title: Text(l10n.mktOrderNumber(orderNumber(o.id))),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text([
                                if (o.createdAt != null)
                                  walletDateTime(o.createdAt!, locale),
                                l10n.mktStores('${o.subs.length}'),
                              ].join(' · ')),
                              const SizedBox(height: AppTokens.spacingXs),
                              Wrap(
                                spacing: AppTokens.spacingSm,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  StatusChip(
                                      label: orderStatusLabel(l10n, o.status),
                                      tone: orderTone(o.status)),
                                  MoneyText(o.grandTotalMinor,
                                      style: theme.textTheme.titleSmall),
                                ],
                              ),
                            ],
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () async {
                            await Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                    builder: (_) => MarketOrderDetailScreen(
                                        api: widget.api, orderId: o.id)));
                            _reload();
                          },
                        ),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
