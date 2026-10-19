import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../auth/step_up_dialog.dart';
import 'pay_result_screen.dart';

/// S-WAL-06 · `/pay/:code` · Confirmar pago.
///
/// Muestra nombre verificado del comercio, RUC, desglose y solicita confirmación/step-up.
class PayConfirmScreen extends StatefulWidget {
  const PayConfirmScreen({
    super.key,
    required this.api,
    required this.code,
    this.merchantName = 'Café Panamá Centro',
    this.merchantRuc = '155689432-2-2022',
    this.amountMinor = 450, // B/.4.50
  });

  final ApiClient api;
  final String code;
  final String merchantName;
  final String merchantRuc;
  final int amountMinor;

  @override
  State<PayConfirmScreen> createState() => _PayConfirmScreenState();
}

class _PayConfirmScreenState extends State<PayConfirmScreen> {
  bool _processing = false;

  Future<void> _confirm() async {
    // Si el monto es mayor o igual a $50 (5000 centavos), pide confirmación fuerte
    if (widget.amountMinor >= 5000) {
      final ok = await StepUpDialog.confirm(
        context,
        title: 'Confirmar pago a ${widget.merchantName}',
        amountMinor: widget.amountMinor,
      );
      if (!ok) return;
    }

    setState(() => _processing = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => PayResultScreen(api: widget.api),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Confirmar pago')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: theme.colorScheme.primaryContainer,
                        child: Icon(Icons.storefront, color: theme.colorScheme.onPrimaryContainer, size: 28),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              widget.merchantName,
                              style: theme.textTheme.titleLarge,
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Icon(Icons.verified, size: 20, color: theme.colorScheme.primary),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('RUC: ${widget.merchantRuc}', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 8),
                      const StatusChip(label: 'Comercio verificado', tone: StatusTone.success),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              Center(
                child: Column(
                  children: [
                    Text('Total a pagar', style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 4),
                    MoneyText(
                      widget.amountMinor,
                      style: theme.textTheme.displayMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              Card(
                child: ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined),
                  title: const Text('Método de pago'),
                  subtitle: const Text('Saldo en Billetera PlentyPay'),
                  trailing: const Icon(Icons.check, color: Colors.green),
                ),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Confirmar y pagar',
                onPressed: _processing ? null : _confirm,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
