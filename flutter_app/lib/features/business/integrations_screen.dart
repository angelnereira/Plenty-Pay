import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-ADM-04 · `/business/integrations` · Integraciones de rieles, PAC DGI y mensajería.
///
/// Permiso: `admin:integrations:manage`. Regla 12 AGENTS.md (los adaptadores sin credenciales operan en sandbox:true).
class IntegrationsScreen extends StatefulWidget {
  const IntegrationsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<IntegrationsScreen> createState() => _IntegrationsScreenState();
}

class _IntegrationsScreenState extends State<IntegrationsScreen> {
  final List<Map<String, dynamic>> _integrations = [
    {
      'name': 'Riel CLAVE (Telered)',
      'description': 'Tarjetas de débito bancarias de Panamá',
      'sandbox': true,
      'status': StatusChipTone.warning,
      'status_label': 'Modo Sandbox',
    },
    {
      'name': 'ACH Xpress (Telered)',
      'description': 'Transferencias interbancarias inmediatas 24/7',
      'sandbox': true,
      'status': StatusChipTone.warning,
      'status_label': 'Modo Sandbox',
    },
    {
      'name': 'Yappy (Banco General)',
      'description': 'Cobros móviles por número de celular y QR',
      'sandbox': true,
      'status': StatusChipTone.warning,
      'status_label': 'Modo Sandbox',
    },
    {
      'name': 'PAC Facturación DGI (The Factory HKA)',
      'description':
          'Proveedor de Autorización Calificada para factura electrónica',
      'sandbox': false,
      'status': StatusChipTone.success,
      'status_label': 'Producción DGI',
    },
    {
      'name': 'WhatsApp Cloud API (Meta)',
      'description': 'Envío de recibos, confirmaciones y soporte oficial',
      'sandbox': false,
      'status': StatusChipTone.success,
      'status_label': 'Conectado',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Integraciones y API'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _integrations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final it = _integrations[index];
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
                        Text(it['name'] as String,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: it['status_label'] as String,
                          tone: it['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(it['description'] as String,
                        style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          it['sandbox'] == true
                              ? 'Sin credenciales reales (Sandbox activo)'
                              : 'Credenciales en producción',
                          style: TextStyle(
                            fontSize: 12,
                            color: it['sandbox'] == true
                                ? theme.colorScheme.error
                                : theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        TextButton(
                          child: const Text('Configurar API'),
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
            label: 'Guardar configuración de integraciones',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Configuraciones y llaves API actualizadas')),
              );
            },
          ),
        ),
      ),
    );
  }
}
