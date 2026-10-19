import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'account_limits_screen.dart';
import 'pay_scan_screen.dart';
import 'receive_screen.dart';
import 'send_screen.dart';
import 'topup_screen.dart';
import 'tx_detail_screen.dart';

/// S-WAL-01 · `/wallet` · Saldo y movimientos.
///
/// Saldo disponible y retenido, accesos directos y lista de transacciones recientes.
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.walletTitle),
        actions: [
          IconButton(
            tooltip: 'Límites de cuenta',
            icon: const Icon(Icons.speed_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => AccountLimitsScreen(api: api),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Tarjeta de balance
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Saldo disponible', style: theme.textTheme.titleSmall),
                        const StatusChip(label: 'Activa', tone: StatusTone.success),
                      ],
                    ),
                    const SizedBox(height: 8),
                    MoneyText(
                      14550, // B/.145.50
                      style: theme.textTheme.headlineLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text('Retenido en tránsito: ', style: theme.textTheme.bodySmall),
                        const MoneyText(0, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Accesos directos principales
            Row(
              children: [
                Expanded(
                  child: _WalletActionTile(
                    icon: Icons.add,
                    label: l10n.topupTitle,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => TopupScreen(api: api),
                    )),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _WalletActionTile(
                    icon: Icons.send,
                    label: l10n.sendTitle,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => SendScreen(api: api),
                    )),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _WalletActionTile(
                    icon: Icons.qr_code,
                    label: 'Recibir',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => ReceiveScreen(api: api),
                    )),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _WalletActionTile(
                    icon: Icons.qr_code_scanner,
                    label: l10n.payQrTitle,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => PayScanScreen(api: api),
                    )),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Movimientos recientes
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Movimientos recientes', style: theme.textTheme.titleMedium),
                TextButton(
                  onPressed: () {},
                  child: const Text('Ver todos'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            _TxTile(
              title: 'Compra en Café Panamá Centro',
              dateText: '19 oct 2026, 8:40 a. m.',
              amountMinor: -450,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => TxDetailScreen(
                  api: api,
                  txId: 'tx-1',
                  title: 'Compra en Café Panamá Centro',
                  amountMinor: -450,
                  dateText: '19 oct 2026, 8:40 a. m.',
                ),
              )),
            ),
            _TxTile(
              title: 'Recarga desde Yappy',
              dateText: '18 oct 2026, 3:15 p. m.',
              amountMinor: 5000,
              isIncome: true,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => TxDetailScreen(
                  api: api,
                  txId: 'tx-2',
                  title: 'Recarga desde Yappy',
                  amountMinor: 5000,
                  dateText: '18 oct 2026, 3:15 p. m.',
                ),
              )),
            ),
            _TxTile(
              title: 'Envío a María Rodríguez',
              dateText: '17 oct 2026, 11:20 a. m.',
              amountMinor: -2000,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => TxDetailScreen(
                  api: api,
                  txId: 'tx-3',
                  title: 'Envío a María Rodríguez',
                  amountMinor: -2000,
                  dateText: '17 oct 2026, 11:20 a. m.',
                ),
              )),
            ),
          ],
        ),
      ),
    );
  }
}

class _WalletActionTile extends StatelessWidget {
  const _WalletActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.surfaceContainer,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: theme.colorScheme.primary, size: 24),
              const SizedBox(height: 6),
              Text(
                label,
                style: theme.textTheme.labelMedium,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TxTile extends StatelessWidget {
  const _TxTile({
    required this.title,
    required this.dateText,
    required this.amountMinor,
    this.isIncome = false,
    required this.onTap,
  });

  final String title;
  final String dateText;
  final int amountMinor;
  final bool isIncome;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isIncome ? theme.colorScheme.primaryContainer : theme.colorScheme.surfaceContainerHighest,
          child: Icon(
            isIncome ? Icons.arrow_downward : Icons.arrow_upward,
            color: isIncome ? theme.colorScheme.onPrimaryContainer : theme.colorScheme.onSurfaceVariant,
            size: 18,
          ),
        ),
        title: Text(title, style: theme.textTheme.bodyMedium),
        subtitle: Text(dateText, style: theme.textTheme.bodySmall),
        trailing: MoneyText(
          amountMinor,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isIncome ? theme.colorScheme.primary : theme.colorScheme.error,
          ),
        ),
        onTap: onTap,
      ),
    );
  }
}
