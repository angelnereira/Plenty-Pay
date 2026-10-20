import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-ADM-07 · `/business/privacy` · Privacidad del negocio y solicitudes ARCO (Ley 81 de Panamá).
///
/// Permiso: `admin:business:manage`. Reglas: `N-DAT-01`, `N-DAT-05`, `N-DAT-06`.
/// Permite gestionar los derechos de los titulares (clientes y empleados) en el plazo legal de 10 días hábiles.
class BusinessPrivacyScreen extends StatefulWidget {
  const BusinessPrivacyScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<BusinessPrivacyScreen> createState() => _BusinessPrivacyScreenState();
}

class _BusinessPrivacyScreenState extends State<BusinessPrivacyScreen> {
  final List<Map<String, dynamic>> _requests = [
    {
      'id': 'ARCO-2026-0012',
      'applicant': 'Carlos Alberto González (Cliente)',
      'type': 'Acceso y Portabilidad (N-DAT-07)',
      'date': '15 de octubre de 2026',
      'days_left': 6,
      'status': StatusChipTone.warning,
      'status_label': 'En trámite (6 días restantes)',
    },
    {
      'id': 'ARCO-2026-0011',
      'applicant': 'Jorge Luis Castillo (Ex-empleado)',
      'type': 'Cancelación / Supresión (N-DAT-08)',
      'date': '10 de octubre de 2026',
      'days_left': 1,
      'status': StatusChipTone.warning,
      'status_label': 'Vence mañana',
    },
    {
      'id': 'ARCO-2026-0009',
      'applicant': 'Ana María Valdés (Cliente)',
      'type': 'Rectificación de correo y teléfono',
      'date': '02 de octubre de 2026',
      'days_left': 0,
      'status': StatusChipTone.success,
      'status_label': 'Resuelta y entregada',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Privacidad y solicitudes Ley 81'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _requests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final req = _requests[index];
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
                        Text(req['id'] as String,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: req['status_label'] as String,
                          tone: req['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Solicitante: ${req['applicant']}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('Derecho ejercido: ${req['type']}',
                        style: theme.textTheme.bodyMedium),
                    Text('Ingresada: ${req['date']}',
                        style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Plazo legal: 10 días hábiles (ANTAI)',
                            style: theme.textTheme.labelSmall),
                        TextButton(
                          child: const Text('Tramitar respuesta'),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text(
                                      'Abriendo expediente para ${req['id']}...')),
                            );
                          },
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
            label: 'Atender solicitud de datos',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text(
                        'Generando paquete ZIP de datos personales certificado...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
