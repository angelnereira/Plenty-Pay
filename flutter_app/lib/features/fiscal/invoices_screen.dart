import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-FIN-07 · `/finance/invoices` · Facturas electrónicas y notas de crédito DGI.
///
/// Permisos: `fiscal:read`, `fiscal:note:issue`.
/// Muestra comprobantes fiscales electrónicos autorizados por el PAC/DGI con CUFE, descarga y emisión de notas.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final List<Map<String, dynamic>> _invoices = [
    {
      'id': 'FE-01-0000421',
      'cufe': 'FE010000421-155678234-2-2021-202610190842000001',
      'customer': 'CONSTRUCTORA DEL ISTMO S.A.',
      'ruc': '155689123-2-2022 DV 42',
      'date': '19 de octubre de 2026, 08:42 AM',
      'total_cents': 34500, // $345.00
      'tax_cents': 2257, // $22.57 (7%)
      'status': StatusChipTone.success,
      'status_label': 'Autorizada DGI',
      'can_credit_note': true,
    },
    {
      'id': 'FE-01-0000420',
      'cufe': 'FE010000420-155678234-2-2021-202610181730000002',
      'customer': 'CARLOS ALBERTO GONZÁLEZ MENDOZA',
      'ruc': '8-745-1289 DV 18',
      'date': '18 de octubre de 2026, 05:30 PM',
      'total_cents': 1850, // $18.50
      'tax_cents': 121,
      'status': StatusChipTone.success,
      'status_label': 'Autorizada DGI',
      'can_credit_note': true,
    },
    {
      'id': 'NC-01-0000012',
      'cufe': 'NC010000012-155678234-2-2021-202610171215000003',
      'customer': 'PANAMA PACIFIC LOGISTICS CORP',
      'ruc': '2456789-1-812345 DV 90',
      'date': '17 de octubre de 2026, 12:15 PM',
      'total_cents': -8200, // -$82.00
      'tax_cents': -536,
      'status': StatusChipTone.neutral,
      'status_label': 'Nota de crédito',
      'can_credit_note': false,
    },
  ];

  void _showInvoiceDetail(Map<String, dynamic> inv) {
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
                Text(inv['id'] as String, style: Theme.of(ctx).textTheme.titleLarge),
                StatusChip(
                  label: inv['status_label'] as String,
                  tone: inv['status'] as StatusChipTone,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(ctx).colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(4),
              ),
              child: SelectableText(
                'CUFE: ${inv['cufe']}',
                style: const TextStyle(fontFamily: 'monospace', fontSize: 10),
              ),
            ),
            const SizedBox(height: 16),
            Text('Receptor: ${inv['customer']}', style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('RUC / Cédula: ${inv['ruc']}'),
            Text('Fecha de emisión: ${inv['date']}'),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total factura electrónica:', style: TextStyle(fontWeight: FontWeight.bold)),
                MoneyText((inv['total_cents'] as int).abs(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Descargar PDF'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Descargando factura electrónica en formato PDF DGI...')),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.code),
                    label: const Text('XML firmado'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Descargando XML autorizado por el PAC...')),
                      );
                    },
                  ),
                ),
              ],
            ),
            if (inv['can_credit_note'] == true) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.assignment_return_outlined),
                label: const Text('Emitir nota de crédito DGI'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(ctx).colorScheme.error,
                  side: BorderSide(color: Theme.of(ctx).colorScheme.error),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _confirmCreditNote(inv);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _confirmCreditNote(Map<String, dynamic> inv) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Emitir nota de crédito'),
        content: Text('¿Deseas emitir una Nota de Crédito autorizada por el PAC para anular total o parcialmente ${inv['id']}?'),
        actions: [
          TextButton(
            child: const Text('Cancelar'),
            onPressed: () => Navigator.pop(ctx),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            child: const Text('Emitir nota de crédito'),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Nota de crédito generada y enviada a la DGI')),
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Facturas electrónicas (DGI)'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _invoices.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final inv = _invoices[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                onTap: () => _showInvoiceDetail(inv),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.receipt_long, color: theme.colorScheme.primary),
                              const SizedBox(width: 8),
                              Text(inv['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                            ],
                          ),
                          StatusChip(
                            label: inv['status_label'] as String,
                            tone: inv['status'] as StatusChipTone,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(inv['customer'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('RUC: ${inv['ruc']}', style: theme.textTheme.bodySmall),
                      Text('Fecha: ${inv['date']}', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total comprobante:', style: TextStyle(fontSize: 12)),
                          MoneyText(
                            (inv['total_cents'] as int).abs(),
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: (inv['total_cents'] as int) < 0 ? theme.colorScheme.error : null,
                            ),
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
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Emitir nueva factura electrónica',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Abriendo asistente de facturación DGI...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
