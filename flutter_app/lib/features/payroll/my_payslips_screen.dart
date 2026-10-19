import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

/// S-PAY-08 · `/team/me` · Mis comprobantes de pago y recibos de nómina.
///
/// Permiso: `payroll:payslip:read:self`.
/// Autoservicio del colaborador para consultar salarios, deducciones legales de Panamá (CSS 9.75%, SE 1.25%) y descargar talonarios.
class MyPayslipsScreen extends StatefulWidget {
  const MyPayslipsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MyPayslipsScreen> createState() => _MyPayslipsScreenState();
}

class _MyPayslipsScreenState extends State<MyPayslipsScreen> {
  final List<Map<String, dynamic>> _payslips = [
    {
      'id': 'PAYSLIP-2026-10-1',
      'period': 'Primera Quincena de Octubre de 2026',
      'gross_cents': 37500, // $375.00 (quincenal)
      'css_cents': 3656, // $36.56 (9.75%)
      'se_cents': 469, // $4.69 (1.25%)
      'isr_cents': 0, // Exento primer tramo
      'net_cents': 33375, // $333.75
      'paid_date': '15 de octubre de 2026',
    },
    {
      'id': 'PAYSLIP-2026-09-2',
      'period': 'Segunda Quincena de Septiembre de 2026',
      'gross_cents': 37500,
      'css_cents': 3656,
      'se_cents': 469,
      'isr_cents': 0,
      'net_cents': 33375,
      'paid_date': '30 de septiembre de 2026',
    },
    {
      'id': 'PAYSLIP-2026-09-1',
      'period': 'Primera Quincena de Septiembre de 2026',
      'gross_cents': 37500,
      'css_cents': 3656,
      'se_cents': 469,
      'isr_cents': 0,
      'net_cents': 33375,
      'paid_date': '15 de septiembre de 2026',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis comprobantes de pago'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _payslips.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final p = _payslips[index];
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
                    Text(
                      p['period'] as String,
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text('Depositado el ${p['paid_date']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Salario devengado bruto:'),
                        MoneyText(p['gross_cents'] as int),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Seguro Social empleado (9.75%):'),
                        Text('- \$${((p['css_cents'] as int) / 100).toStringAsFixed(2)}', style: TextStyle(color: theme.colorScheme.error)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Seguro Educativo empleado (1.25%):'),
                        Text('- \$${((p['se_cents'] as int) / 100).toStringAsFixed(2)}', style: TextStyle(color: theme.colorScheme.error)),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Salario neto recibido:', style: TextStyle(fontWeight: FontWeight.bold)),
                        MoneyText(
                          p['net_cents'] as int,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                        label: const Text('Descargar PDF certificado'),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Descargando talonario quincenal en PDF...')),
                          );
                        },
                      ),
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
            label: 'Descargar último comprobante PDF',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Descargando comprobante de la 1ra quincena de octubre...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
