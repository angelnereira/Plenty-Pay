import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../account/identity_verify_screen.dart';

/// S-WAL-09 · `/account/limits` · Límites de mi cuenta.
///
/// Límites de billetera según nivel de verificación (N-AML-03).
class AccountLimitsScreen extends StatelessWidget {
  const AccountLimitsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Límites de mi cuenta')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.shield_outlined, color: theme.colorScheme.primary),
                        const SizedBox(width: 8),
                        Text('Nivel de cuenta: Estándar', style: theme.textTheme.titleMedium),
                        const Spacer(),
                        const StatusChip(label: 'Nivel 1', tone: StatusTone.info),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Cumplimiento con las normas de prevención de blanqueo de capitales de la Superintendencia de Bancos de Panamá (N-AML-03).',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text('Límites operativos actuales', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),

            _LimitTile(
              title: 'Saldo máximo en billetera',
              currentMinor: 500000, // $5,000.00
              limitMinor: 500000,
              icon: Icons.account_balance_wallet_outlined,
            ),
            const SizedBox(height: 8),
            _LimitTile(
              title: 'Entradas acumuladas este mes',
              currentMinor: 85000, // $850.00
              limitMinor: 1000000, // $10,000.00
              icon: Icons.trending_up,
            ),
            const SizedBox(height: 8),
            _LimitTile(
              title: 'Monto máximo por transacción',
              currentMinor: 100000, // $1,000.00
              limitMinor: 100000,
              icon: Icons.payments_outlined,
            ),
            const SizedBox(height: 24),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('¿Necesitas límites más altos?', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      'Completa la verificación de identidad avanzada (KYC) con tu cédula o pasaporte.',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    PPButton.primary(
                      label: 'Verificar identidad ahora',
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => IdentityVerifyScreen(api: api),
                      )),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LimitTile extends StatelessWidget {
  const _LimitTile({
    required this.title,
    required this.currentMinor,
    required this.limitMinor,
    required this.icon,
  });

  final String title;
  final int currentMinor;
  final int limitMinor;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final percent = (currentMinor / limitMinor).clamp(0.0, 1.0);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: theme.textTheme.titleSmall)),
                MoneyText(limitMinor, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(value: percent),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Uso actual: ${(percent * 100).toInt()}%', style: theme.textTheme.bodySmall),
                Row(
                  children: [
                    const Text('Disponible: ', style: TextStyle(fontSize: 12)),
                    MoneyText(limitMinor - currentMinor, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
