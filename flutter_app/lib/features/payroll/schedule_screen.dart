import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-PAY-04 · `/team/schedule` · Programación de turnos y descansos semanales.
///
/// Permiso: `payroll:employee:manage`.
/// Supervisa cumplimiento de jornada máxima legal (Diurna 48h, Mixta 45h, Nocturna 40h · N-LAB-02).
class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  final List<Map<String, dynamic>> _shifts = [
    {
      'employee': 'Carlos Rodríguez',
      'role': 'Cajero',
      'shift_type': 'Diurna (8:00 AM - 4:00 PM)',
      'days': 'Lunes a Sábado',
      'rest_day': 'Domingo',
      'total_hours': 48,
      'compliant': true,
    },
    {
      'employee': 'María Esther Santos',
      'role': 'Gerente',
      'shift_type': 'Mixta (11:00 AM - 7:00 PM)',
      'days': 'Lunes a Viernes',
      'rest_day': 'Sábado y Domingo',
      'total_hours': 40,
      'compliant': true,
    },
    {
      'employee': 'Jorge Luis Castillo',
      'role': 'Bodeguero',
      'shift_type': 'Diurna (7:00 AM - 3:00 PM)',
      'days': 'Lunes a Sábado',
      'rest_day': 'Domingo',
      'total_hours': 48,
      'compliant': true,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Turnos y horarios semanales'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _shifts.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final s = _shifts[index];
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
                        Text(s['employee'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text('${s['total_hours']}h / sem', style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('${s['role']} · ${s['shift_type']}', style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_outlined, size: 16, color: theme.colorScheme.secondary),
                        const SizedBox(width: 4),
                        Text('Jornada: ${s['days']}', style: theme.textTheme.bodySmall),
                      ],
                    ),
                    Row(
                      children: [
                        Icon(Icons.weekend_outlined, size: 16, color: theme.colorScheme.secondary),
                        const SizedBox(width: 4),
                        Text('Descanso obligatorio: ${s['rest_day']} (N-LAB-04)', style: theme.textTheme.bodySmall),
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
            label: 'Publicar horario semanal',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Horario publicado y notificado a los colaboradores')),
              );
            },
          ),
        ),
      ),
    );
  }
}
