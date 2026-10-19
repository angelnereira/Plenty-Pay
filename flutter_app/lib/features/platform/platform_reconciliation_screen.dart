import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PLT-06 · `/platform/reconciliation` · Conciliación de rieles, extractos y cuenta SUSPENSE.
///
/// Permiso: `platform:reconcile`.
/// Valida el cuadre contable diario entre los libros internos del ledger y los extractos bancarios de Telered y bancos.
class PlatformReconciliationScreen extends StatefulWidget {
  const PlatformReconciliationScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PlatformReconciliationScreen> createState() => _PlatformReconciliationScreenState();
}

class _PlatformReconciliationScreenState extends State<PlatformReconciliationScreen> {
  final List<Map<String, dynamic>> _reconciliations = [
    {
      'rail': 'CLAVE / Telered',
      'date': '19 de octubre de 2026',
      'ledger_cents': 1845000, // $18,450.00
      'bank_cents': 1845000,
      'difference_cents': 0,
      'status': StatusChipTone.success,
      'status_label': 'Cuadrado 100%',
    },
    {
      'rail': 'ACH Xpress / Telered',
      'date': '19 de octubre de 2026',
      'ledger_cents': 1220000, // $12,200.00
      'bank_cents': 1220000,
      'difference_cents': 0,
      'status': StatusChipTone.success,
      'status_label': 'Cuadrado 100%',
    },
    {
      'rail': 'Yappy / Banco General',
      'date': '18 de octubre de 2026',
      'ledger_cents': 840000,
      'bank_cents': 835500,
      'difference_cents': 4500, // $45.00 en SUSPENSE
      'status': StatusChipTone.warning,
      'status_label': 'En investigación (\$45.00)',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Conciliación de Plataforma'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _reconciliations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final r = _reconciliations[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(r['rail'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: r['status_label'] as String,
                          tone: r['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Fecha de corte: ${r['date']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Libro Ledger', style: theme.textTheme.labelSmall),
                            MoneyText(r['ledger_cents'] as int, style: theme.textTheme.titleMedium),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text('Extracto Banco', style: theme.textTheme.labelSmall),
                            MoneyText(r['bank_cents'] as int, style: theme.textTheme.titleMedium),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Diferencia (SUSPENSE)', style: theme.textTheme.labelSmall),
                            MoneyText(
                              r['difference_cents'] as int,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: (r['difference_cents'] as int) > 0 ? theme.colorScheme.error : theme.colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Ejecutar conciliación de rieles',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Procesando archivos de liquidación y cotejo de ledger...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
