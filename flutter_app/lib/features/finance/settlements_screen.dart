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
import 'settlement_data.dart';

StatusTone _tone(String status) => switch (status) {
      'PAID' => StatusTone.success,
      'FAILED' => StatusTone.error,
      'PROCESSING' => StatusTone.info,
      _ => StatusTone.neutral,
    };

class _Loaded {
  const _Loaded(this.summary, this.batches, this.next);
  final PayoutSummaryItem summary;
  final List<SettlementBatchItem> batches;
  final String next;
}

/// S-FIN-05 · `/finance/settlements` · Liquidaciones. `settlement:read`.
///
/// Cabecera con lo que hay por liquidar y la próxima fecha (settlement GetPayoutSummary), «Liquidar
/// ahora» con `settlement:schedule:manage`, y los lotes reales con su estado. Sin datos inventados.
class SettlementsScreen extends StatefulWidget {
  const SettlementsScreen(
      {super.key, required this.api, this.canSettle = false});
  final ApiClient api;
  final bool canSettle;

  @override
  State<SettlementsScreen> createState() => _SettlementsScreenState();
}

class _SettlementsScreenState extends State<SettlementsScreen> {
  late Future<_Loaded> _future = _load();
  final List<SettlementBatchItem> _more = [];
  String _next = '';
  bool _settling = false;
  // Una clave por intento: un reintento del mismo toque no crea dos lotes (C-07).
  String _key = newRequestId();

  Future<_Loaded> _load() async {
    final results = await Future.wait(
        [widget.api.settlementSummary(), widget.api.listSettlementBatches()]);
    final page = results[1];
    final next = (page['page'] as Map<String, dynamic>?)?['next_page_token']
            as String? ??
        '';
    _more.clear();
    _next = next;
    return _Loaded(
      PayoutSummaryItem.fromJson(results[0]),
      [
        for (final b in (page['batches'] as List<dynamic>? ?? const []))
          SettlementBatchItem.fromJson(b as Map<String, dynamic>)
      ],
      next,
    );
  }

  Future<void> _loadMore() async {
    final page = await widget.api.listSettlementBatches(pageToken: _next);
    setState(() {
      _more.addAll([
        for (final b in (page['batches'] as List<dynamic>? ?? const []))
          SettlementBatchItem.fromJson(b as Map<String, dynamic>)
      ]);
      _next = (page['page'] as Map<String, dynamic>?)?['next_page_token']
              as String? ??
          '';
    });
  }

  Future<void> _settle() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _settling = true);
    try {
      final b = SettlementBatchItem.fromJson(
          await widget.api.createSettlementBatch(idempotencyKey: _key));
      _key = newRequestId();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(b.status == 'PAID'
                ? l10n.settleNowPaid(MoneyText.format(b.netMinor))
                : l10n.settleNowProcessing(MoneyText.format(b.netMinor)))));
      setState(() {
        _future = _load();
      });
    } on ApiException catch (e) {
      // Rechazos esperables (nada que liquidar, mínimo…): se explica y se permite reintentar.
      _key = newRequestId();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
            SnackBar(content: Text(settlementErrorMessage(l10n, e))));
    } on Object catch (e) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
            SnackBar(content: Text(settlementErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  void _open(SettlementBatchItem b) =>
      Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) =>
              SettlementBatchScreen(api: widget.api, batchId: b.id)));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settlementsTitle)),
      body: FutureBuilder<_Loaded>(
        future: _future,
        builder: (context, snap) => RefreshIndicator(
          onRefresh: () async => setState(() {
            _future = _load();
          }),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
            children: [
              AsyncView<_Loaded>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? settlementErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: () => setState(() {
                  _future = _load();
                }),
                emptyView: const SizedBox.shrink(),
                builder: (context, data) {
                  final s = data.summary;
                  final batches = [...data.batches, ..._more];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Card(
                        margin: EdgeInsets.zero,
                        elevation: 0,
                        color: theme.colorScheme.surfaceContainerHigh,
                        child: Padding(
                          padding: const EdgeInsets.all(AppTokens.spacingMd),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l10n.settlementPending,
                                  style: theme.textTheme.labelLarge),
                              MoneyText(s.pendingMinor,
                                  style: theme.textTheme.headlineMedium),
                              if (s.processingMinor > 0)
                                Text(l10n.settlementProcessing(
                                    MoneyText.format(s.processingMinor))),
                              const SizedBox(height: AppTokens.spacingXs),
                              Text(
                                s.nextPayoutAt == null
                                    ? l10n.settlementManual
                                    : l10n.settlementNext(settlementDateTime(
                                        s.nextPayoutAt!, locale)),
                                style: theme.textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (widget.canSettle) ...[
                        const SizedBox(height: AppTokens.spacingMd),
                        PPButton.primary(
                            label: l10n.settleNow,
                            onPressed: _settling ? null : _settle),
                      ],
                      const SizedBox(height: AppTokens.spacingLg),
                      if (batches.isEmpty)
                        Text(l10n.settlementsEmpty,
                            style: theme.textTheme.bodyLarge)
                      else
                        for (final b in batches)
                          Card(
                            margin: const EdgeInsets.only(
                                bottom: AppTokens.spacingSm),
                            elevation: 0,
                            color: theme.colorScheme.surfaceContainerLow,
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: () => _open(b),
                              child: Padding(
                                padding:
                                    const EdgeInsets.all(AppTokens.spacingMd),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      Expanded(
                                          child: Text(
                                              l10n.settlementBatchNumber(
                                                  b.shortId),
                                              style:
                                                  theme.textTheme.titleMedium)),
                                      MoneyText(b.netMinor,
                                          style: theme.textTheme.titleMedium),
                                    ]),
                                    const SizedBox(height: AppTokens.spacingXs),
                                    Text([
                                      if (b.createdAt != null)
                                        settlementDate(b.createdAt!, locale),
                                      destinationLabel(
                                          l10n, b.destinationKind, b.last4),
                                    ].join(' · ')),
                                    const SizedBox(height: AppTokens.spacingXs),
                                    Wrap(
                                        spacing: AppTokens.spacingXs,
                                        runSpacing: AppTokens.spacingXs,
                                        children: [
                                          StatusChip(
                                              label: batchStatusLabel(
                                                  l10n, b.status),
                                              tone: _tone(b.status)),
                                          if (b.sandbox)
                                            StatusChip(
                                                label: l10n.settlementSandbox,
                                                tone: StatusTone.warning),
                                        ]),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      if (_next.isNotEmpty)
                        PPButton.text(
                            label: l10n.catLoadMore, onPressed: _loadMore),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Detalle de un lote: partidas, reembolsos, total, destino y referencia bancaria.
class SettlementBatchScreen extends StatefulWidget {
  const SettlementBatchScreen(
      {super.key, required this.api, required this.batchId});
  final ApiClient api;
  final String batchId;

  @override
  State<SettlementBatchScreen> createState() => _SettlementBatchScreenState();
}

class _SettlementBatchScreenState extends State<SettlementBatchScreen> {
  late Future<SettlementBatchItem> _future = _load();

  Future<SettlementBatchItem> _load() async => SettlementBatchItem.fromJson(
      await widget.api.getSettlementBatch(widget.batchId));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settlementsTitle)),
      body: FutureBuilder<SettlementBatchItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<SettlementBatchItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? settlementErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, b) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(l10n.settlementBatchNumber(b.shortId),
                            style: theme.textTheme.titleLarge),
                      ),
                    ),
                    StatusChip(
                        label: batchStatusLabel(l10n, b.status),
                        tone: _tone(b.status)),
                  ]),
                  if (b.sandbox) ...[
                    const SizedBox(height: AppTokens.spacingSm),
                    Text(l10n.settlementSandboxNotice,
                        style: theme.textTheme.bodyMedium),
                  ],
                  const SizedBox(height: AppTokens.spacingMd),
                  for (final (label, minor) in [
                    (l10n.settlementGross, b.grossMinor),
                    (l10n.settlementRefunds, -b.refundsMinor),
                  ])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(label),
                      trailing: MoneyText(minor),
                    ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settlementNet,
                        style: theme.textTheme.titleMedium),
                    trailing: MoneyText(b.netMinor,
                        style: theme.textTheme.titleMedium),
                  ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settlementDestination),
                    subtitle: Text(
                        destinationLabel(l10n, b.destinationKind, b.last4)),
                  ),
                  if (b.externalRef.isNotEmpty)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l10n.settlementBankRef),
                      subtitle: SelectableText(b.externalRef),
                    ),
                  if (b.paidAt != null)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l10n.settlementPaidAt),
                      subtitle: Text(settlementDateTime(b.paidAt!, locale)),
                    ),
                  if (b.status == 'FAILED') ...[
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.error_outline,
                          color: theme.colorScheme.error),
                      title: Text(b.failureReason),
                      subtitle: Text(l10n.settlementFailedHint),
                    ),
                  ],
                  const SizedBox(height: AppTokens.spacingMd),
                  Text(l10n.settlementItems(b.items.length),
                      style: theme.textTheme.titleSmall),
                  for (final i in b.items)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(i.isRefund
                          ? Icons.undo_outlined
                          : Icons.point_of_sale_outlined),
                      title: Text(i.isRefund
                          ? l10n.settlementItemRefund
                          : l10n.settlementItemPayment),
                      subtitle: i.occurredAt == null
                          ? null
                          : Text(settlementDateTime(i.occurredAt!, locale)),
                      trailing: MoneyText(
                          i.isRefund ? -i.amountMinor : i.amountMinor),
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
