import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'wallet_data.dart';

/// S-WAL-08 · `/wallet/tx/:id` · Detalle de movimiento. Permiso `wallet:read`.
///
/// Muestra lo que el ledger sabe del asiento: monto con signo (e1), estado (e2: un asiento del
/// extracto siempre está completado) y la tabla e3 con tipo, fecha, referencia copiable y concepto.
/// Contraparte, método, desglose (e4), factura (e5) y recibo (e6) llegan con F11.9/F13 cuando el
/// pago traiga esos datos: no se muestran inventados.
class TxDetailScreen extends StatelessWidget {
  const TxDetailScreen({super.key, required this.line});

  final WalletLine line;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.txDetailTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
        children: [
          Center(
              child: MoneyText(line.amountMinor,
                  style: theme.textTheme.displaySmall)),
          const SizedBox(height: AppTokens.spacingSm),
          Center(
              child: StatusChip(
                  label: l10n.txStatusCompleted, tone: StatusTone.success)),
          const SizedBox(height: AppTokens.spacingLg),
          Card(
            margin: EdgeInsets.zero,
            elevation: 0,
            color: theme.colorScheme.surfaceContainerLow,
            child: Column(children: [
              ListTile(
                title: Text(l10n.txFieldType),
                subtitle:
                    Text(transactionTypeLabel(l10n, line.transactionType)),
              ),
              ListTile(
                title: Text(l10n.txFieldDate),
                subtitle: Text(walletDateTime(line.effectiveAt, locale)),
              ),
              ListTile(
                title: Text(l10n.txFieldReference),
                subtitle: Text(line.transactionId),
                trailing: IconButton(
                  tooltip: l10n.txCopyReference,
                  icon: const Icon(Icons.copy_outlined),
                  onPressed: () async {
                    await Clipboard.setData(
                        ClipboardData(text: line.transactionId));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(l10n.txReferenceCopied)));
                  },
                ),
              ),
              if (line.description.isNotEmpty)
                ListTile(
                  title: Text(l10n.txFieldConcept),
                  subtitle: Text(line.description),
                ),
            ]),
          ),
        ],
      ),
    );
  }
}
