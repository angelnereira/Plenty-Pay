import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

/// S-FIN-10 · `/finance/tax-report` · Informe mensual de ITBMS (DGI).
///
/// Permiso: `fiscal:read`. Regla normativa: `N-FIS-11`.
/// Resumen fiscal por alícuotas (7%, 10%, 15%, Exento) para la declaración mensual de ITBMS.
class TaxReportScreen extends StatefulWidget {
  const TaxReportScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<TaxReportScreen> createState() => _TaxReportScreenState();
}

class _TaxReportScreenState extends State<TaxReportScreen> {
  String _selectedMonth = 'octubre_2026';

  final Map<String, dynamic> _reportData = {
    'period': 'Octubre de 2026',
    'total_sales_cents': 4589000, // $45,890.00
    'base_7_cents': 3820000, // $38,200.00
    'tax_7_cents': 267400, // $2,674.00
    'base_10_cents': 250000, // $2,500.00
    'tax_10_cents': 25000, // $250.00
    'base_15_cents': 0,
    'tax_15_cents': 0,
    'base_exempt_cents': 519000, // $5,190.00
    'total_tax_cents': 292400, // $2,924.00
    'withholdings_cents': 146200, // Retención 50% ITBMS tarjetas: $1,462.00
    'payable_cents': 146200, // $1,462.00
    'invoices_count': 412,
    'credit_notes_count': 3,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Informe mensual ITBMS (N-FIS-11)'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Period selector
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  side: BorderSide(color: theme.colorScheme.outlineVariant),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Período fiscal:', style: TextStyle(fontWeight: FontWeight.bold)),
                      DropdownButton<String>(
                        value: _selectedMonth,
                        underline: const SizedBox.shrink(),
                        items: const [
                          DropdownMenuItem(value: 'octubre_2026', child: Text('Octubre de 2026')),
                          DropdownMenuItem(value: 'septiembre_2026', child: Text('Septiembre de 2026')),
                          DropdownMenuItem(value: 'agosto_2026', child: Text('Agosto de 2026')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedMonth = val);
                        },
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Summary Banner
              Container(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                ),
                child: Column(
                  children: [
                    Text(
                      'Total ITBMS causado del período',
                      style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(height: 4),
                    MoneyText(
                      _reportData['total_tax_cents'] as int,
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_reportData['invoices_count']} facturas electrónicas · ${_reportData['credit_notes_count']} notas de crédito',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onPrimaryContainer),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Breakdown by Tax Bracket
              Card(
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
                      Text('Desglose por alícuota fiscal (DGI)', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 12),
                      _buildTaxRow('Base tarifa general (7%)', _reportData['base_7_cents'] as int, _reportData['tax_7_cents'] as int),
                      const Divider(),
                      _buildTaxRow('Base alcohol / hospedaje (10%)', _reportData['base_10_cents'] as int, _reportData['tax_10_cents'] as int),
                      const Divider(),
                      _buildTaxRow('Base tabaco y derivados (15%)', _reportData['base_15_cents'] as int, _reportData['tax_15_cents'] as int),
                      const Divider(),
                      _buildTaxRow('Ventas exentas (0% alimentos/salud)', _reportData['base_exempt_cents'] as int, 0),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Retentions & Net Payable
              Card(
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
                      Text('Liquidación preliminar con DGI', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('ITBMS causado bruto:'),
                          MoneyText(_reportData['total_tax_cents'] as int),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Retención 50% por adquirentes:'),
                          Text(
                            '- \$${((_reportData['withholdings_cents'] as int) / 100).toStringAsFixed(2)}',
                            style: TextStyle(color: theme.colorScheme.error),
                          ),
                        ],
                      ),
                      const Divider(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Saldo neto estimado a pagar:', style: TextStyle(fontWeight: FontWeight.bold)),
                          MoneyText(
                            _reportData['payable_cents'] as int,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Generar reporte oficial DGI (PDF / Excel)',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando archivo certificado para declaración DGI...')),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildTaxRow(String label, int baseCents, int taxCents) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('Base: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  MoneyText(baseCents, style: const TextStyle(fontSize: 12)),
                ],
              ),
              Row(
                children: [
                  const Text('Impuesto: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  MoneyText(taxCents, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
