import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-FIN-02 / S-FIN-03 · `/finance/payments` · Lista y detalle de cobros.
///
/// Permisos: `payments:read`, `payments:refund`.
/// Muestra transacciones recibidas por los diferentes rieles (CLAVE, ACH Xpress, Tarjetas, Yappy)
/// con desglose de comisiones y opción de reverso/reembolso.
class PaymentsListScreen extends StatefulWidget {
  const PaymentsListScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PaymentsListScreen> createState() => _PaymentsListScreenState();
}

class _PaymentsListScreenState extends State<PaymentsListScreen> {
  String _selectedRail = 'all';

  final List<Map<String, dynamic>> _payments = [
    {
      'id': 'PAY-2026-98124',
      'rail': 'CLAVE',
      'rail_icon': Icons.credit_card,
      'amount_cents': 4550, // $45.50
      'fee_cents': 91, // $0.91 (2%)
      'net_cents': 4459, // $44.59
      'payer': 'Carlos Mendoza (Tarjeta Clave **** 3821)',
      'created_at': '19 de octubre de 2026, 10:14 AM',
      'status': StatusChipTone.success,
      'status_label': 'Completado',
      'refundable': true,
    },
    {
      'id': 'PAY-2026-98123',
      'rail': 'ACH Xpress',
      'rail_icon': Icons.account_balance,
      'amount_cents': 12000, // $120.00
      'fee_cents': 150, // $1.50
      'net_cents': 11850,
      'payer': 'Distribuidora del Pacífico S.A.',
      'created_at': '19 de octubre de 2026, 09:45 AM',
      'status': StatusChipTone.success,
      'status_label': 'Completado',
      'refundable': true,
    },
    {
      'id': 'PAY-2026-98122',
      'rail': 'Yappy',
      'rail_icon': Icons.phone_android,
      'amount_cents': 1875, // $18.75
      'fee_cents': 38,
      'net_cents': 1837,
      'payer': '+507 6211-9988',
      'created_at': '19 de octubre de 2026, 08:30 AM',
      'status': StatusChipTone.success,
      'status_label': 'Completado',
      'refundable': true,
    },
    {
      'id': 'PAY-2026-98119',
      'rail': 'Visa / Mastercard',
      'rail_icon': Icons.payment,
      'amount_cents': 8500, // $85.00
      'fee_cents': 234, // $2.34
      'net_cents': 8266,
      'payer': 'Elena Chen (Visa **** 1984)',
      'created_at': '18 de octubre de 2026, 06:12 PM',
      'status': StatusChipTone.neutral,
      'status_label': 'Reembolsado',
      'refundable': false,
    },
  ];

  void _showDetailModal(Map<String, dynamic> pay) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Detalle de cobro', style: Theme.of(ctx).textTheme.titleLarge),
                StatusChip(
                  label: pay['status_label'] as String,
                  tone: pay['status'] as StatusChipTone,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Center(
              child: MoneyText(
                pay['amount_cents'] as int,
                style: Theme.of(ctx).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),
            const Divider(),
            _buildDetailRow('ID de transacción', pay['id'] as String),
            _buildDetailRow('Riel de pago', pay['rail'] as String),
            _buildDetailRow('Pagador', pay['payer'] as String),
            _buildDetailRow('Fecha y hora', pay['created_at'] as String),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Monto bruto:'),
                MoneyText(pay['amount_cents'] as int),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Comisión PlentyPay / Riel:'),
                Text('- \$${((pay['fee_cents'] as int) / 100).toStringAsFixed(2)}', style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Monto neto liquidable:', style: TextStyle(fontWeight: FontWeight.bold)),
                MoneyText(pay['net_cents'] as int, style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 24),
            if (pay['refundable'] == true) ...[
              OutlinedButton.icon(
                icon: const Icon(Icons.replay),
                label: const Text('Reembolsar pago'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(ctx).colorScheme.error,
                  side: BorderSide(color: Theme.of(ctx).colorScheme.error),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _confirmRefund(pay);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _confirmRefund(Map<String, dynamic> pay) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmar reembolso'),
        content: Text('¿Deseas reembolsar ${pay['id']} por valor de \$${((pay['amount_cents'] as int) / 100).toStringAsFixed(2)}? Esta acción es irreversible.'),
        actions: [
          TextButton(
            child: const Text('Cancelar'),
            onPressed: () => Navigator.pop(ctx),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Confirmar reembolso'),
            onPressed: () {
              setState(() {
                pay['refundable'] = false;
                pay['status'] = StatusChipTone.neutral;
                pay['status_label'] = 'Reembolsado';
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Reembolso procesado exitosamente')),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final filtered = _selectedRail == 'all'
        ? _payments
        : _payments.where((p) => p['rail'] == _selectedRail).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cobros y transacciones'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final r in const [
                    ('all', 'Todos'),
                    ('CLAVE', 'CLAVE'),
                    ('ACH Xpress', 'ACH Xpress'),
                    ('Yappy', 'Yappy'),
                    ('Visa / Mastercard', 'Tarjetas'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(r.$2),
                        selected: _selectedRail == r.$1,
                        onSelected: (_) => setState(() => _selectedRail = r.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final p = filtered[index];
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                      side: BorderSide(color: theme.colorScheme.outlineVariant),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                      onTap: () => _showDetailModal(p),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: theme.colorScheme.primaryContainer,
                              child: Icon(p['rail_icon'] as IconData, color: theme.colorScheme.onPrimaryContainer),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p['payer'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                                  Text(p['created_at'] as String, style: theme.textTheme.bodySmall),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Text(p['rail'] as String, style: theme.textTheme.labelSmall),
                                      const SizedBox(width: 8),
                                      StatusChip(
                                        label: p['status_label'] as String,
                                        tone: p['status'] as StatusChipTone,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                MoneyText(
                                  p['amount_cents'] as int,
                                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'Neto: \$${((p['net_cents'] as int) / 100).toStringAsFixed(2)}',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ],
                        ),
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
            label: 'Exportar informe de cobros',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando reporte en CSV...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
