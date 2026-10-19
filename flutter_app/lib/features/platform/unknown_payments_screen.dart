import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PLT-05 · `/platform/payments/unknown` · Mesa de resolución de cobros en estado UNKNOWN.
///
/// Permiso: `platform:reconcile`.
/// Resuelve transacciones de rieles externos (ACH Xpress, Yappy, CLAVE) sin confirmación final tras > 24 horas.
class UnknownPaymentsScreen extends StatefulWidget {
  const UnknownPaymentsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<UnknownPaymentsScreen> createState() => _UnknownPaymentsScreenState();
}

class _UnknownPaymentsScreenState extends State<UnknownPaymentsScreen> {
  final List<Map<String, dynamic>> _unknownList = [
    {
      'intent_id': 'INT-2026-99014',
      'rail': 'ACH Xpress',
      'rail_ref': 'ACH-PEND-88412',
      'amount_cents': 24000, // $240.00
      'payer': 'Constructora Panamá S.A.',
      'merchant': 'Comercial Marbella',
      'age': '28 horas en UNKNOWN',
      'status': StatusChipTone.warning,
      'status_label': 'Requiere conciliación',
    },
    {
      'intent_id': 'INT-2026-99010',
      'rail': 'Yappy',
      'rail_ref': 'YAP-98124982',
      'amount_cents': 4500, // $45.00
      'payer': '+507 6899-1234',
      'merchant': 'Supermercado Gourmet',
      'age': '31 horas en UNKNOWN',
      'status': StatusChipTone.warning,
      'status_label': 'Requiere conciliación',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pagos UNKNOWN > 24h'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _unknownList.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final item = _unknownList[index];
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
                        Text(item['intent_id'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: item['status_label'] as String,
                          tone: item['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Riel: ${item['rail']} · Ref: ${item['rail_ref']}', style: theme.textTheme.bodyMedium),
                    Text('Comercio: ${item['merchant']} · Pagador: ${item['payer']}', style: theme.textTheme.bodySmall),
                    Text(item['age'] as String, style: TextStyle(fontSize: 12, color: theme.colorScheme.error, fontWeight: FontWeight.bold)),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        MoneyText(item['amount_cents'] as int, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                        Row(
                          children: [
                            OutlinedButton(
                              child: const Text('Expirar y reverso'),
                              onPressed: () {},
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              child: const Text('Forzar éxito con boleta'),
                              onPressed: () {},
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
            label: 'Resolver pagos con extracto bancario',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cargando extracto oficial del banco para conciliación automática...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
