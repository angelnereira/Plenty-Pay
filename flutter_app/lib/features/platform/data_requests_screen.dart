import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PLT-09 · `/platform/data-requests` · Solicitudes sobre datos dirigidas a PlentyPay (Ley 81).
///
/// Permiso: `platform:support`. Regla: `N-DAT-05`.
/// Gestión centralizada de requerimientos de información, auditorías ANTAI y derechos ARCO a nivel plataforma.
class DataRequestsScreen extends StatefulWidget {
  const DataRequestsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DataRequestsScreen> createState() => _DataRequestsScreenState();
}

class _DataRequestsScreenState extends State<DataRequestsScreen> {
  final List<Map<String, dynamic>> _platformRequests = [
    {
      'id': 'PLT-ARCO-008',
      'applicant': 'Carlos Rodríguez (Usuario Final)',
      'type': 'Acceso a expediente integral de pagos',
      'date': '17 de octubre de 2026',
      'status': StatusChipTone.success,
      'status_label': 'Entregado',
    },
    {
      'id': 'PLT-REQ-003',
      'applicant': 'Requerimiento Judicial / ANTAI',
      'type': 'Informe de trazabilidad de consentimientos',
      'date': '14 de octubre de 2026',
      'status': StatusChipTone.info,
      'status_label': 'En preparación legal',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Solicitudes de datos plataforma (Ley 81)'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _platformRequests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final r = _platformRequests[index];
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
                        Text(r['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: r['status_label'] as String,
                          tone: r['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Solicitante: ${r['applicant']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('Tipo: ${r['type']}', style: theme.textTheme.bodyMedium),
                    Text('Fecha de recepción: ${r['date']}', style: theme.textTheme.bodySmall),
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
            label: 'Exportar reporte de cumplimiento ANTAI',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando informe certificado de cumplimiento Ley 81 para ANTAI...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
