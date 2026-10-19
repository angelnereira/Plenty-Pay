import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-FIN-05 · `/finance/settlements` · Lotes de liquidación bancaria.
///
/// Permiso: `settlement:read`.
/// Muestra los lotes de fondos transferidos a la cuenta bancaria del comercio tras los cortes contables.
class SettlementsScreen extends StatefulWidget {
  const SettlementsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SettlementsScreen> createState() => _SettlementsScreenState();
}

class _SettlementsScreenState extends State<SettlementsScreen> {
  final List<Map<String, dynamic>> _settlements = [
    {
      'id': 'SETTL-2026-1019-01',
      'date': '19 de octubre de 2026',
      'gross_cents': 345000, // $3,450.00
      'fees_cents': 5175, // $51.75
      'net_cents': 339825, // $3,398.25
      'status': StatusChipTone.info,
      'status_label': 'En proceso ACH',
      'bank': 'Banco General (Cuenta Corriente **** 8912)',
      'ref': 'ACH-X-8910245',
    },
    {
      'id': 'SETTL-2026-1018-01',
      'date': '18 de octubre de 2026',
      'gross_cents': 512000, // $5,120.00
      'fees_cents': 7680, // $76.80
      'net_cents': 504320, // $5,043.20
      'status': StatusChipTone.success,
      'status_label': 'Depositado',
      'bank': 'Banco General (Cuenta Corriente **** 8912)',
      'ref': 'ACH-X-8902144',
    },
    {
      'id': 'SETTL-2026-1017-01',
      'date': '17 de octubre de 2026',
      'gross_cents': 298000, // $2,980.00
      'fees_cents': 4470, // $44.70
      'net_cents': 293530, // $2,935.30
      'status': StatusChipTone.success,
      'status_label': 'Depositado',
      'bank': 'Banco General (Cuenta Corriente **** 8912)',
      'ref': 'ACH-X-8899120',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lotes de liquidación'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _settlements.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final s = _settlements[index];
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
                        Text(s['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                        StatusChip(
                          label: s['status_label'] as String,
                          tone: s['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Fecha de corte: ${s['date']}', style: theme.textTheme.bodyMedium),
                    Text('Destino: ${s['bank']}', style: theme.textTheme.bodySmall),
                    Text('Ref ACH: ${s['ref']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Ventas brutas', style: theme.textTheme.labelSmall),
                            MoneyText(s['gross_cents'] as int, style: theme.textTheme.titleMedium),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Comisiones', style: theme.textTheme.labelSmall),
                            Text(
                              '- \$${((s['fees_cents'] as int) / 100).toStringAsFixed(2)}',
                              style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Neto recibido', style: theme.textTheme.labelSmall),
                            MoneyText(
                              s['net_cents'] as int,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.primary,
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
            label: 'Solicitar liquidación anticipada',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tu solicitud de adelanto de corte ha sido enviada a tesorería')),
              );
            },
          ),
        ),
      ),
    );
  }
}
