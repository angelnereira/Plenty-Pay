import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_errors.dart';
import '../wallet/wallet_data.dart' show walletDateTime;
import 'pos_data.dart';
import 'pos_receipt_screen.dart';

/// Etiqueta y tono del estado de una venta (S-POS-07).
(String, StatusTone) saleStatusChip(AppLocalizations l10n, String status) =>
    switch (status) {
      'PAID' => (l10n.saleStatus_PAID, StatusTone.success),
      'AWAITING_PAYMENT' => (
          l10n.saleStatus_AWAITING_PAYMENT,
          StatusTone.warning
        ),
      'VOIDED' => (l10n.saleStatus_VOIDED, StatusTone.neutral),
      'PARTIALLY_REFUNDED' => (
          l10n.saleStatus_PARTIALLY_REFUNDED,
          StatusTone.warning
        ),
      'REFUNDED' => (l10n.saleStatus_REFUNDED, StatusTone.neutral),
      _ => (l10n.saleStatus_OPEN, StatusTone.info),
    };

/// S-POS-07 · `/pos/sales` · Ventas del turno. Número, hora, total y estado; toca → recibo.
/// Con `pos:refund`, el recibo ofrece "Devolver" (S-POS-08). Los filtros por rango, caja, cajero y
/// medio llegan después.
class PosSalesHistoryScreen extends StatefulWidget {
  const PosSalesHistoryScreen(
      {super.key,
      required this.api,
      required this.session,
      this.terminalLabel = ''});
  final ApiClient api;
  final SessionItem session;
  final String terminalLabel;

  @override
  State<PosSalesHistoryScreen> createState() => _PosSalesHistoryScreenState();
}

class _PosSalesHistoryScreenState extends State<PosSalesHistoryScreen> {
  late Future<List<SaleItem>> _future = _load();
  bool _canRefund = false;

  Future<List<SaleItem>> _load() async {
    final perms = await widget.api.permissions();
    _canRefund = perms.can('pos:refund');
    return (await loadSessionSales(widget.api, widget.session.id))
        .where((s) => s.status != 'OPEN')
        .toList();
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
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posSalesTitle)),
      body: FutureBuilder<List<SaleItem>>(
        future: _future,
        builder: (context, snap) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
            children: [
              AsyncView<List<SaleItem>>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? catalogErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                isEmpty: (l) => l.isEmpty,
                emptyView: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                  child: Text(l10n.posSalesEmpty, textAlign: TextAlign.center),
                ),
                builder: (context, sales) => Card(
                  margin: EdgeInsets.zero,
                  elevation: 0,
                  color: theme.colorScheme.surfaceContainerLow,
                  child: Column(children: [
                    for (final s in sales)
                      Builder(builder: (context) {
                        final (label, tone) = saleStatusChip(l10n, s.status);
                        return ListTile(
                          title: Text(s.receiptNumber.isEmpty
                              ? walletDateTime(s.createdAt, locale)
                              : l10n.posSaleNumber(s.receiptNumber)),
                          subtitle: Text(walletDateTime(s.createdAt, locale)),
                          trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                MoneyText(s.totalMinor,
                                    style: theme.textTheme.titleMedium),
                                StatusChip(label: label, tone: tone),
                              ]),
                          onTap: s.hasReceipt
                              ? () async {
                                  await Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                          builder: (_) => PosReceiptScreen(
                                              api: widget.api,
                                              sale: s,
                                              terminalLabel:
                                                  widget.terminalLabel,
                                              canRefund: _canRefund)));
                                  // Al volver, el estado de la venta pudo cambiar por una devolución.
                                  if (mounted) _reload();
                                }
                              : null,
                        );
                      }),
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
