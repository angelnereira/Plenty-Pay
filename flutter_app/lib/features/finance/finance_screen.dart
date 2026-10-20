import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../wallet/wallet_data.dart' show walletErrorMessage;
import 'finance_data.dart';
import 'payments_list_screen.dart';
import 'terminals_screen.dart';

/// S-FIN-01 · `/finance` · Resumen. Permiso `payments:read`.
///
/// e1 periodo (Hoy · 7 días · Mes) y e2 totales de los cobros reales de payments-core. Las
/// tarjetas de liquidación (e3), facturas y folios (e4–e5), ITBMS (e6) y el gráfico (e7) llegan con
/// settlement (F12) y fiscal-invoicing (F13): no se muestran mientras esos servicios no existan.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

enum _Period { today, week, month }

class _FinanceScreenState extends State<FinanceScreen> {
  late Future<List<PaymentItem>> _future = loadPayments(widget.api);
  _Period _period = _Period.today;

  DateTime _since() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return switch (_period) {
      _Period.today => today,
      _Period.week => today.subtract(const Duration(days: 6)),
      _Period.month => DateTime(now.year, now.month),
    };
  }

  void _open(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen))
      .then((_) => setState(() => _future = loadPayments(widget.api)));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.financeTitle)),
      body: FutureBuilder<List<PaymentItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            SegmentedButton<_Period>(
              segments: [
                ButtonSegment(
                    value: _Period.today, label: Text(l10n.financeToday)),
                ButtonSegment(
                    value: _Period.week, label: Text(l10n.finance7Days)),
                ButtonSegment(
                    value: _Period.month, label: Text(l10n.financeMonth)),
              ],
              selected: {_period},
              onSelectionChanged: (s) => setState(() => _period = s.first),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<PaymentItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? walletErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() => _future = loadPayments(widget.api)),
              emptyView: const SizedBox.shrink(),
              builder: (context, payments) {
                final t = FinanceTotals.of(payments, _since());
                final cards = [
                  for (final (label, minor) in [
                    (l10n.financeCaptured, t.capturedMinor),
                    (l10n.financeFees, t.feesMinor),
                    (l10n.financeRefunds, t.refundedMinor),
                    (l10n.financeNet, t.netMinor),
                  ])
                    _TotalCard(
                        label: label,
                        minor: minor,
                        onTap: () =>
                            _open(PaymentsListScreen(api: widget.api))),
                ];
                // Dos por fila en compact; las cuatro en una fila desde medium (§8.2).
                final perRow =
                    WindowClass.of(context) == WindowClass.compact ? 2 : 4;
                return Column(children: [
                  for (var i = 0; i < cards.length; i += perRow)
                    Padding(
                      padding:
                          const EdgeInsets.only(bottom: AppTokens.spacingSm),
                      child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (var k = i;
                                k < i + perRow && k < cards.length;
                                k++) ...[
                              if (k > i)
                                const SizedBox(width: AppTokens.spacingSm),
                              Expanded(child: cards[k]),
                            ],
                          ]),
                    ),
                ]);
              },
            ),
            const SizedBox(height: AppTokens.spacingLg),
            Card(
              margin: EdgeInsets.zero,
              elevation: 0,
              color: theme.colorScheme.surfaceContainerLow,
              child: Column(children: [
                ListTile(
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(l10n.paymentsTitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _open(PaymentsListScreen(api: widget.api)),
                ),
                ListTile(
                  leading: const Icon(Icons.qr_code_2),
                  title: Text(l10n.terminalsTitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _open(TerminalsScreen(api: widget.api)),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalCard extends StatelessWidget {
  const _TotalCard(
      {required this.label, required this.minor, required this.onTap});
  final String label;
  final int minor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHigh,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppTokens.spacingXs),
            MoneyText(minor, style: theme.textTheme.titleLarge),
          ]),
        ),
      ),
    );
  }
}
