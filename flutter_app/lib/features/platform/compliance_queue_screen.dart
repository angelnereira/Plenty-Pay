import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PLT-07 · `/platform/compliance` · Cola de cumplimiento y reportes a la UAF.
///
/// Permisos: `platform:security:read`, `platform:reconcile`. Reglas: `N-AML-05` a `N-AML-10`.
/// Supervisión de alertas de prevención de blanqueo de capitales, operaciones sospechosas (ROS) y umbrales en efectivo.
class ComplianceQueueScreen extends StatefulWidget {
  const ComplianceQueueScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ComplianceQueueScreen> createState() => _ComplianceQueueScreenState();
}

class _ComplianceQueueScreenState extends State<ComplianceQueueScreen> {
  final List<Map<String, dynamic>> _alerts = [
    {
      'id': 'AML-ALERT-2026-092',
      'type': 'Operación fraccionada sospechosa (Pitufeo · N-AML-06)',
      'entity': 'Billetera **** 9128',
      'amount_cents': 980000, // $9,800 en 3 transacciones continuas
      'date': '19 de octubre de 2026',
      'status': StatusChipTone.error,
      'status_label': 'Requiere ROS UAF',
    },
    {
      'id': 'AML-ALERT-2026-091',
      'type': 'Transacción individual superior a \$10,000 (N-AML-04)',
      'entity': 'Distribuidora del Pacífico S.A.',
      'amount_cents': 1450000, // $14,500.00
      'date': '18 de octubre de 2026',
      'status': StatusChipTone.warning,
      'status_label': 'Declaración jurada adjunta',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cola de Cumplimiento AML / UAF'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _alerts.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final a = _alerts[index];
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
                        Text(a['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: a['status_label'] as String,
                          tone: a['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(a['type'] as String, style: TextStyle(fontWeight: FontWeight.w600, color: theme.colorScheme.error)),
                    Text('Entidad monitoreada: ${a['entity']}', style: theme.textTheme.bodyMedium),
                    Text('Detectado el: ${a['date']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Monto involucrado', style: theme.textTheme.labelSmall),
                            MoneyText(a['amount_cents'] as int, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                          ],
                        ),
                        OutlinedButton(
                          child: const Text('Investigar expediente'),
                          onPressed: () {},
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
            label: 'Generar reporte oficial UAF Panamá',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando paquete ROS firmado digitalmente para la UAF...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
