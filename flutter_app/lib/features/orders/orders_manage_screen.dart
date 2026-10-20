import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/sound/beep_sound.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import '../marketplace/market_data.dart';
import 'order_manage_detail_screen.dart';

/// Pestañas de la bandeja (S-ORD-01 e1). "En entrega" llega con logistics (F18).
enum InboxTab { toAccept, preparing, ready, history }

InboxTab tabOf(String status) => switch (status) {
      'AWAITING_ACCEPTANCE' => InboxTab.toAccept,
      'ACCEPTED' => InboxTab.preparing,
      'READY' => InboxTab.ready,
      _ => InboxTab.history,
    };

/// Tono de la cuenta regresiva: `warning` bajo 5 min y `error` bajo 2 min (S-ORD-01 e2).
StatusTone deadlineTone(Duration left) => left < const Duration(minutes: 2)
    ? StatusTone.error
    : left < const Duration(minutes: 5)
        ? StatusTone.warning
        : StatusTone.info;

/// S-ORD-01 · `/orders` · Bandeja de pedidos. `orders:read` · `GET /v1/merchant/orders`.
///
/// e1 pestañas con contador · e2 tarjeta (pedido, productos, total, retiro; cuenta regresiva en
/// "Por aceptar") · e3 aviso sonoro al entrar uno nuevo. Columnas lado a lado desde expanded.
/// Se relee cada [pollEvery]: el aviso en vivo por WebSocket llega con notifications (F20).
class OrdersManageScreen extends StatefulWidget {
  const OrdersManageScreen(
      {super.key,
      required this.api,
      this.pollEvery = const Duration(seconds: 15)});
  final ApiClient api;
  final Duration pollEvery;

  @override
  State<OrdersManageScreen> createState() => _OrdersManageScreenState();
}

class _OrdersManageScreenState extends State<OrdersManageScreen> {
  late Future<List<SubOrderItem>> _future = _load();
  Set<String>? _seen;
  Timer? _poll;
  Timer? _tick;

  Future<List<SubOrderItem>> _load() async {
    final subs = await loadMerchantOrders(widget.api);
    final waiting = {
      for (final s in subs)
        if (s.status == 'AWAITING_ACCEPTANCE') s.id
    };
    final seen = _seen;
    if (seen != null && waiting.difference(seen).isNotEmpty) {
      unawaited(BeepSound.playScanBeep());
    }
    _seen = waiting;
    return subs;
  }

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(widget.pollEvery, (_) {
      if (!mounted) return;
      setState(() {
        _future = _load();
      });
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _open(SubOrderItem s) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => OrderManageDetailScreen(api: widget.api, sub: s)));
    _reload();
  }

  String _tabLabel(AppLocalizations l10n, InboxTab t, int n) => switch (t) {
        InboxTab.toAccept => l10n.ordTabToAccept('$n'),
        InboxTab.preparing => l10n.ordTabPreparing('$n'),
        InboxTab.ready => l10n.ordTabReady('$n'),
        InboxTab.history => l10n.ordTabHistory,
      };

  Widget _column(BuildContext context, List<SubOrderItem> subs) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    if (subs.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
        child: Text(l10n.ordEmpty,
            textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
      );
    }
    return Column(children: [
      for (final s in subs) _InboxCard(sub: s, onTap: () => _open(s)),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final wc = WindowClass.of(context);
    return FutureBuilder<List<SubOrderItem>>(
      future: _future,
      builder: (context, snap) {
        final all = snap.data ?? const <SubOrderItem>[];
        List<SubOrderItem> of(InboxTab t) => [
              for (final s in all)
                if (tabOf(s.status) == t) s
            ];
        Widget body(Widget Function(BuildContext) child) =>
            AsyncView<List<SubOrderItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? marketErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (context, _) => child(context),
            );
        final padding = EdgeInsets.fromLTRB(wc.horizontalMargin,
            AppTokens.spacingSm, wc.horizontalMargin, AppTokens.spacingXl);
        if (wc.twoPanes) {
          return Scaffold(
            appBar: AppBar(title: Text(l10n.moduleOrders)),
            body: RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(padding: padding, children: [
                body((context) => Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final t in InboxTab.values)
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppTokens.spacingXs),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(_tabLabel(l10n, t, of(t).length),
                                      style: theme.textTheme.titleMedium),
                                  const SizedBox(height: AppTokens.spacingSm),
                                  _column(context, of(t)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    )),
              ]),
            ),
          );
        }
        return DefaultTabController(
          length: InboxTab.values.length,
          child: Scaffold(
            appBar: AppBar(
              title: Text(l10n.moduleOrders),
              bottom: TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: [
                  for (final t in InboxTab.values)
                    Tab(text: _tabLabel(l10n, t, of(t).length)),
                ],
              ),
            ),
            body: TabBarView(children: [
              for (final t in InboxTab.values)
                RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: ListView(
                      padding: padding,
                      children: [body((context) => _column(context, of(t)))]),
                ),
            ]),
          ),
        );
      },
    );
  }
}

class _InboxCard extends StatelessWidget {
  const _InboxCard({required this.sub, required this.onTap});
  final SubOrderItem sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final deadline = sub.deadline;
    final left = deadline?.difference(DateTime.now());
    return Card(
      margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.mktOrderNumber(orderNumber(sub.orderId)),
                  style: theme.textTheme.titleMedium),
              Text(
                  [
                    l10n.ordItems('${sub.itemCount}'),
                    MoneyText.format(sub.totalMinor),
                    l10n.ordPickupLabel,
                  ].join(' · '),
                  style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppTokens.spacingXs),
              if (sub.status == 'AWAITING_ACCEPTANCE' && left != null)
                StatusChip(label: countdown(left), tone: deadlineTone(left))
              else
                StatusChip(
                    label: subStatusLabel(l10n, sub.status),
                    tone: switch (sub.status) {
                      'COMPLETED' => StatusTone.success,
                      'REJECTED' || 'CANCELLED' => StatusTone.error,
                      _ => StatusTone.info,
                    }),
            ],
          ),
        ),
      ),
    );
  }
}
