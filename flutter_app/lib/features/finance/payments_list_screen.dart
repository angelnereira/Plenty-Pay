import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/wallet_data.dart' show walletDateTime, walletErrorMessage;
import 'finance_data.dart';

/// S-FIN-02 · `/finance/payments` · Cobros. Permiso `payments:read`.
///
/// Lista real de `/v1/payments`: fecha, referencia, bruto, neto y estado. Los filtros, la
/// exportación (C-20) y el detalle con reembolso (S-FIN-03) llegan con F11.6.
class PaymentsListScreen extends StatefulWidget {
  const PaymentsListScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<PaymentsListScreen> createState() => _PaymentsListScreenState();
}

class _PaymentsListScreenState extends State<PaymentsListScreen> {
  late Future<List<PaymentItem>> _future = loadPayments(widget.api);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.paymentsTitle)),
      body: FutureBuilder<List<PaymentItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            AsyncView<List<PaymentItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? walletErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = loadPayments(widget.api);
              }),
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingLg),
                child: Text(l10n.paymentsEmpty, textAlign: TextAlign.center),
              ),
              builder: (context, payments) => Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Column(children: [
                  for (final p in payments)
                    Builder(builder: (context) {
                      final (label, tone) = paymentStatusChip(l10n, p.status);
                      return ListTile(
                        title: Row(children: [
                          Expanded(
                              child: MoneyText(p.amountMinor,
                                  style: theme.textTheme.titleSmall)),
                          StatusChip(label: label, tone: tone),
                        ]),
                        subtitle: Text(
                          '${walletDateTime(p.createdAt, locale)} · ${p.id.substring(0, 8).toUpperCase()}'
                          '${p.status == 'CAPTURED' ? '\n${l10n.paymentsNet(MoneyText.format(p.netMinor))}' : ''}',
                        ),
                        isThreeLine: p.status == 'CAPTURED',
                      );
                    }),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
