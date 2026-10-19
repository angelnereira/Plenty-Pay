import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PLT-02 · `/platform/users` · Mesa de revisión de identidad y KYC.
///
/// Permiso: `platform:users:manage`. Reglas: `N-AML-02`, `N-AML-08`.
/// Mesa de cumplimiento para validar documentos de identidad (cédula/pasaporte) y cotejo contra listas PEP/UAF.
class UsersReviewScreen extends StatefulWidget {
  const UsersReviewScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<UsersReviewScreen> createState() => _UsersReviewScreenState();
}

class _UsersReviewScreenState extends State<UsersReviewScreen> {
  final List<Map<String, dynamic>> _kycCases = [
    {
      'id': 'KYC-2026-8812',
      'name': 'Carlos Mendoza Ramos',
      'document': 'Cédula 8-712-4921',
      'requested_tier': 'Nivel 2 (Hasta \$5,000 / mes)',
      'pep_match': false,
      'date': '19 de octubre de 2026',
      'status': StatusChipTone.warning,
      'status_label': 'Por revisar',
    },
    {
      'id': 'KYC-2026-8811',
      'name': 'Elena Chen Wu',
      'document': 'Pasaporte E-891244',
      'requested_tier': 'Nivel 3 (Ilimitado / Negocios)',
      'pep_match': false,
      'date': '19 de octubre de 2026',
      'status': StatusChipTone.warning,
      'status_label': 'Por revisar',
    },
    {
      'id': 'KYC-2026-8809',
      'name': 'Roberto De La Rosa',
      'document': 'Cédula 4-112-998',
      'requested_tier': 'Nivel 2',
      'pep_match': true,
      'pep_label': 'Coincidencia PEP (N-AML-05)',
      'date': '18 de octubre de 2026',
      'status': StatusChipTone.error,
      'status_label': 'Alerta PEP',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Revisión KYC y Verificación (N-AML-02)'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _kycCases.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final c = _kycCases[index];
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
                        Text(c['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: c['status_label'] as String,
                          tone: c['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Documento: ${c['document']}', style: theme.textTheme.bodyMedium),
                    Text('Solicita: ${c['requested_tier']}', style: theme.textTheme.bodySmall),
                    Text('Ingresado el: ${c['date']}', style: theme.textTheme.bodySmall),
                    if (c['pep_match'] == true) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.warning, size: 16, color: theme.colorScheme.onErrorContainer),
                            const SizedBox(width: 8),
                            Text(
                              c['pep_label'] as String,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.onErrorContainer,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton(
                          child: const Text('Rechazar'),
                          onPressed: () {},
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          child: const Text('Ver fotos y prueba de vida'),
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
            label: 'Aprobar expediente KYC seleccionado',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Nivel de billetera aprobado y registrado en el ledger')),
              );
            },
          ),
        ),
      ),
    );
  }
}
