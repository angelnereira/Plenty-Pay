import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'receipt.dart';

/// S-WAL-08 · `/wallet/tx/:id` · Detalle de movimiento.
///
/// Recibo digital, desglose, fecha con mes en texto (N-STD-10) y recibo compartible.
class TxDetailScreen extends StatelessWidget {
  const TxDetailScreen({
    super.key,
    required this.api,
    required this.txId,
    this.title = 'Compra en Farmacia Metro',
    this.amountMinor = -1250,
    this.dateText = '19 oct 2026, 8:30 a. m.',
    this.rail = 'Billetera PlentyPay',
    this.reference = 'OP-984210',
    this.statusTone = StatusTone.success,
    this.statusLabel = 'Completado',
  });

  final ApiClient api;
  final String txId;
  final String title;
  final int amountMinor;
  final String dateText;
  final String rail;
  final String reference;
  final StatusTone statusTone;
  final String statusLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isNegative = amountMinor < 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de movimiento'),
        actions: [
          IconButton(
            tooltip: 'Ver recibo',
            icon: const Icon(Icons.receipt_outlined),
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => Scaffold(
                  appBar: AppBar(title: const Text('Recibo digital')),
                  body: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: ReceiptView(
                        data: ReceiptData(
                          merchantName: title,
                          merchantTaxId: '155689432-2-2022',
                          paidAt: DateTime.now(),
                          operationCode: reference,
                          paymentMethodLabel: rail,
                          currencySymbol: r'$',
                          lines: [
                            ReceiptLine(label: title, minor: amountMinor.abs()),
                          ],
                          totalMinor: amountMinor.abs(),
                        ),
                      ),
                    ),
                  ),
                ),
              ));
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Card(
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  child: Column(
                    children: [
                      StatusChip(label: statusLabel, tone: statusTone),
                      const SizedBox(height: 12),
                      MoneyText(
                        amountMinor,
                        style: theme.textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: isNegative ? theme.colorScheme.error : theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
                      const SizedBox(height: 4),
                      Text(dateText, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.tag),
                      title: const Text('Código de operación'),
                      subtitle: Text(reference),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.account_balance_wallet_outlined),
                      title: const Text('Método / Riel'),
                      subtitle: Text(rail),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.calendar_today_outlined),
                      title: const Text('Fecha y hora'),
                      subtitle: Text(dateText),
                    ),
                  ],
                ),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Compartir comprobante',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Comprobante copiado al portapapeles.')),
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
