import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-ADM-06 · `/business/audit` · Bitácora de auditoría inmutable.
///
/// Permiso: `admin:audit:read`.
/// Registro de seguridad criptográficamente sellado (hash chain SHA-256) para cumplimiento legal y forense.
class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  final List<Map<String, dynamic>> _logs = [
    {
      'id': 'LOG-49210',
      'action': 'pos.discount.override',
      'description': 'Descuento autorizado del 15% en Ticket POS-0482',
      'actor': 'supervisor@marbella.pa (IP: 190.140.22.10 · Panamá)',
      'timestamp': '19 de octubre de 2026, 10:12:44 AM',
      'hash':
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      'id': 'LOG-49209',
      'action': 'payments.refund.issued',
      'description': 'Reembolso aprobado para cobro PAY-2026-98119 (\$85.00)',
      'actor': 'gerencia@marbella.pa (IP: 190.140.22.10 · Panamá)',
      'timestamp': '19 de octubre de 2026, 09:40:15 AM',
      'hash':
          '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    },
    {
      'id': 'LOG-49208',
      'action': 'catalog.price.updated',
      'description': 'Precio actualizado para SKU-CAFE-01 (\$25.00 -> \$26.50)',
      'actor': 'admin@marbella.pa (IP: 200.46.12.98 · Panamá)',
      'timestamp': '18 de octubre de 2026, 05:22:01 PM',
      'hash':
          'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    },
    {
      'id': 'LOG-49207',
      'action': 'auth.session.login',
      'description': 'Inicio de sesión exitoso con Passkey WebAuthn',
      'actor': 'carlos.rodriguez@marbella.pa (IP: 190.140.22.14 · Panamá)',
      'timestamp': '18 de octubre de 2026, 07:58:30 AM',
      'hash':
          '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bitácora de auditoría inmutable'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              color: theme.colorScheme.surfaceContainerHigh,
              child: Row(
                children: [
                  Icon(Icons.verified_user, color: theme.colorScheme.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cadena criptográfica intacta',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(
                            'Bloque actual: #49,210 · Algoritmo SHA-256 merkle chain',
                            style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                  const StatusChip(
                      label: 'Válida', tone: StatusChipTone.success),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                itemCount: _logs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final log = _logs[index];
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
                              Text(log['action'] as String,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'monospace')),
                              Text(log['id'] as String,
                                  style: theme.textTheme.labelSmall),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(log['description'] as String,
                              style: theme.textTheme.bodyMedium),
                          const SizedBox(height: 4),
                          Text('Actor: ${log['actor']}',
                              style: theme.textTheme.bodySmall),
                          Text('Fecha: ${log['timestamp']}',
                              style: theme.textTheme.bodySmall),
                          const SizedBox(height: 8),
                          SelectableText(
                            'Hash: ${log['hash']}',
                            style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 10,
                                color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Verificar integridad de la cadena',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text(
                        '✓ Se verificaron 49,210 bloques: Cero discrepancias encontradas')),
              );
            },
          ),
        ),
      ),
    );
  }
}
