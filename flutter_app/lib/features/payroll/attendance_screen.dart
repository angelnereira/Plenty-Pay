import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PAY-05 · `/team/attendance` · Control de asistencia, marcas y horas extraordinarias.
///
/// Permiso: `payroll:attendance:read`.
/// Supervisa marcaciones de entrada/salida, incidencias pendientes (`needs_review`) y recargos legales (N-LAB-03).
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final List<Map<String, dynamic>> _records = [
    {
      'employee': 'Carlos Rodríguez',
      'date': '19 de octubre de 2026',
      'check_in': '07:58 AM',
      'check_out': '04:05 PM',
      'overtime_hours': 0.0,
      'status': StatusChipTone.success,
      'status_label': 'Completo',
      'needs_review': false,
    },
    {
      'employee': 'Jorge Luis Castillo',
      'date': '19 de octubre de 2026',
      'check_in': '06:55 AM',
      'check_out': '05:30 PM',
      'overtime_hours': 2.5,
      'overtime_rate': '+25% Extraordinaria diurna (N-LAB-03)',
      'status': StatusChipTone.warning,
      'status_label': 'Revisar horas extra',
      'needs_review': true,
    },
    {
      'employee': 'María Esther Santos',
      'date': '19 de octubre de 2026',
      'check_in': '10:55 AM',
      'check_out': 'En curso...',
      'overtime_hours': 0.0,
      'status': StatusChipTone.info,
      'status_label': 'En turno',
      'needs_review': false,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistencia y marcajes'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _records.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final r = _records[index];
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
                        Text(r['employee'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: r['status_label'] as String,
                          tone: r['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(r['date'] as String, style: theme.textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              const Icon(Icons.login, size: 16, color: Colors.green),
                              const SizedBox(width: 4),
                              Text('Entrada: ${r['check_in']}'),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Row(
                            children: [
                              const Icon(Icons.logout, size: 16, color: Colors.orange),
                              const SizedBox(width: 4),
                              Text('Salida: ${r['check_out']}'),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (r['needs_review'] == true) ...[
                      const Divider(height: 20),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline, size: 16, color: theme.colorScheme.error),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${r['overtime_hours']}h extra · ${r['overtime_rate']}',
                                style: TextStyle(fontSize: 12, color: theme.colorScheme.error, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
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
            label: 'Aprobar marcajes del período',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Marcajes consolidados y enviados a la corrida de nómina')),
              );
            },
          ),
        ),
      ),
    );
  }
}
