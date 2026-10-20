import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'pay_scan_screen.dart';
import 'receive_screen.dart';
import 'send_screen.dart';
import 'topup_screen.dart';
import 'tx_detail_screen.dart';
import 'wallet_data.dart';

/// S-WAL-01 · `/wallet` · Saldo y movimientos. Permiso `wallet:read`.
///
/// Saldo y retenido salen del ledger (`/v1/wallet/balance`) y los movimientos de los últimos
/// [walletStatementDays] días de `/v1/wallet/statement`. Nada se inventa: si el ledger no
/// responde, la pantalla lo dice y ofrece reintentar.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  late Future<WalletSnapshot> _future = loadWallet(widget.api);

  /// RefreshIndicator espera el resultado. El error se muestra en AsyncView y el cliente HTTP ya
  /// lo registró; aquí queda la miga para reconstruir la sesión.
  Future<void> _reload() {
    final next = loadWallet(widget.api);
    setState(() => _future = next);
    return next.then<void>((_) {},
        onError: (Object e) => widget.api.logger
            .breadcrumb('ui', 'wallet.refresh', e.runtimeType.toString()));
  }

  void _open(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen))
      .then((_) => _reload());

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.walletTitle)),
      body: FutureBuilder<WalletSnapshot>(
        future: _future,
        builder: (context, snap) => RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
            children: [
              AsyncView<WalletSnapshot>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? walletErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                emptyView: const SizedBox.shrink(),
                builder: (context, data) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    WalletBalanceCard(balance: data.balance),
                    const SizedBox(height: AppTokens.spacingMd),
                    _Actions(
                      onTopup: () => _open(TopupScreen(api: widget.api)),
                      onSend: () => _open(SendScreen(api: widget.api)),
                      onReceive: () => _open(ReceiveScreen(api: widget.api)),
                      onPay: () => _open(PayScanScreen(api: widget.api)),
                    ),
                    const SizedBox(height: AppTokens.spacingLg),
                    Text(l10n.walletMovements,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppTokens.spacingSm),
                    if (data.lines.isEmpty)
                      _EmptyMovements(
                          onTopup: () => _open(TopupScreen(api: widget.api)))
                    else
                      Card(
                        margin: EdgeInsets.zero,
                        elevation: 0,
                        color:
                            Theme.of(context).colorScheme.surfaceContainerLow,
                        child: Column(children: [
                          for (final line in data.lines)
                            MovementTile(
                              line: line,
                              onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                      builder: (_) =>
                                          TxDetailScreen(line: line))),
                            ),
                        ]),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// S-WAL-01 e1/e2 (y S-GEN-05 e4): saldo disponible con botón de ojo y retenido si > 0.
class WalletBalanceCard extends StatelessWidget {
  const WalletBalanceCard({super.key, required this.balance, this.footer});

  final WalletBalance balance;

  /// Acciones debajo del saldo (Inicio las agrega dentro de la misma tarjeta).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHigh,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: ValueListenableBuilder<bool>(
          valueListenable: hideWalletBalance,
          builder: (context, hidden, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                    child: Text(l10n.walletAvailable,
                        style: theme.textTheme.titleSmall)),
                IconButton(
                  tooltip:
                      hidden ? l10n.walletShowBalance : l10n.walletHideBalance,
                  icon: Icon(hidden
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined),
                  onPressed: () => hideWalletBalance.value = !hidden,
                ),
              ]),
              if (hidden)
                Semantics(
                  label: l10n.walletBalanceHidden,
                  excludeSemantics: true,
                  child: Text('••••••', style: theme.textTheme.headlineMedium),
                )
              else
                MoneyText(balance.availableMinor,
                    style: theme.textTheme.headlineMedium),
              if (balance.heldMinor > 0 && !hidden) ...[
                const SizedBox(height: AppTokens.spacingXs),
                Tooltip(
                  message: l10n.walletHeldExplain,
                  triggerMode: TooltipTriggerMode.tap,
                  child: Text(
                    l10n.walletHeld(MoneyText.format(balance.heldMinor)),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ),
              ],
              if (footer != null) ...[
                const SizedBox(height: AppTokens.spacingMd),
                footer!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions(
      {required this.onTopup,
      required this.onSend,
      required this.onReceive,
      required this.onPay});

  final VoidCallback onTopup;
  final VoidCallback onSend;
  final VoidCallback onReceive;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(children: [
      for (final (icon, label, onTap) in [
        (Icons.add, l10n.topupTitle, onTopup),
        (Icons.send_outlined, l10n.sendTitle, onSend),
        (Icons.qr_code_2, l10n.walletReceive, onReceive),
        (Icons.qr_code_scanner, l10n.walletPay, onPay),
      ])
        Expanded(
            child: WalletActionButton(icon: icon, label: label, onTap: onTap)),
    ]);
  }
}

/// Acción de la billetera: icono con etiqueta debajo (nunca un icono sin texto).
class WalletActionButton extends StatelessWidget {
  const WalletActionButton(
      {super.key,
      required this.icon,
      required this.label,
      required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(AppTokens.radiusMd),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            vertical: AppTokens.spacingSm, horizontal: AppTokens.spacingXs),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(
            backgroundColor: theme.colorScheme.secondaryContainer,
            foregroundColor: theme.colorScheme.onSecondaryContainer,
            child: Icon(icon),
          ),
          const SizedBox(height: AppTokens.spacingXs),
          Text(label,
              style: theme.textTheme.labelMedium,
              textAlign: TextAlign.center,
              maxLines: 2),
        ]),
      ),
    );
  }
}

/// S-WAL-01 e5: un movimiento con signo, tipo o concepto y fecha con mes en texto.
class MovementTile extends StatelessWidget {
  const MovementTile({super.key, required this.line, required this.onTap});

  final WalletLine line;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final income = line.amountMinor >= 0;
    final locale = Localizations.localeOf(context).toString();
    return ListTile(
      leading: Icon(income ? Icons.south_west : Icons.north_east,
          semanticLabel: transactionTypeLabel(l10n, line.transactionType)),
      title: Text(line.description.isNotEmpty
          ? line.description
          : transactionTypeLabel(l10n, line.transactionType)),
      subtitle: Text(walletDateTime(line.effectiveAt, locale),
          style: theme.textTheme.bodySmall),
      trailing: MoneyText(line.amountMinor, style: theme.textTheme.titleSmall),
      onTap: onTap,
    );
  }
}

class _EmptyMovements extends StatelessWidget {
  const _EmptyMovements({required this.onTopup});
  final VoidCallback onTopup;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppTokens.spacingLg),
      child: Column(children: [
        Text(l10n.walletEmpty, textAlign: TextAlign.center),
        const SizedBox(height: AppTokens.spacingMd),
        PPButton.secondary(label: l10n.topupTitle, onPressed: onTopup),
      ]),
    );
  }
}
