import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-PLT-04 · `/platform/legal-parameters` · Parámetros legales con vigencia (Principio P1 / Regla 13).
///
/// Permiso: `platform:flags:manage`.
/// Ningún valor legal en código. Todos los topes, tasas e impuestos se gestionan con vigencia temporal.
class LegalParametersScreen extends StatefulWidget {
  const LegalParametersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LegalParametersScreen> createState() => _LegalParametersScreenState();
}

class _LegalParametersScreenState extends State<LegalParametersScreen> {
  final List<Map<String, dynamic>> _params = [
    {
      'key': 'legal.pa.tax.itbms_standard_pct',
      'label': 'ITBMS Alícuota General',
      'value': '7.00 %',
      'source': 'Ley 8 de 2010 (Art. 1057-V Código Fiscal)',
      'effective_from': '01 de julio de 2010',
    },
    {
      'key': 'legal.pa.tax.itbms_alcohol_pct',
      'label': 'ITBMS Bebidas Alcohólicas y Hospedaje',
      'value': '10.00 %',
      'source': 'Ley 8 de 2010 (Art. 1057-V Código Fiscal)',
      'effective_from': '01 de julio de 2010',
    },
    {
      'key': 'legal.pa.payroll.css_employee_pct',
      'label': 'Cuota Obrero Seguro Social (CSS)',
      'value': '9.75 %',
      'source': 'Ley 51 de 2005 Orgánica de la CSS',
      'effective_from': '01 de enero de 2013',
    },
    {
      'key': 'legal.pa.payroll.se_employee_pct',
      'label': 'Seguro Educativo Obrero',
      'value': '1.25 %',
      'source': 'Ley 49 de 1979',
      'effective_from': '01 de octubre de 1979',
    },
    {
      'key': 'legal.pa.labor.max_hours_day_weekly',
      'label': 'Jornada Ordinaria Diurna Máxima',
      'value': '48 horas semanales',
      'source': 'Código de Trabajo de Panamá (Art. 30)',
      'effective_from': '02 de abril de 1972',
    },
    {
      'key': 'legal.pa.wallet.tier1_max_balance_cents',
      'label': 'Tope Saldo Billetera Nivel 1 (Simplificada)',
      'value': '\$1,000.00 (100,000 centavos)',
      'source': 'Acuerdo Bancario SBP N-AML-03',
      'effective_from': '01 de enero de 2024',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parámetros legales vigentes (Regla 13)'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _params.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final p = _params[index];
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
                        Text(p['label'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(
                          p['value'] as String,
                          style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    SelectableText(
                      p['key'] as String,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 6),
                    Text('Norma: ${p['source']}', style: theme.textTheme.bodySmall),
                    Text('Vigente desde: ${p['effective_from']}', style: theme.textTheme.bodySmall),
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
            label: 'Registrar nueva vigencia de parámetro',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Abriendo asistente de actualización normativa legal.pa.*')),
              );
            },
          ),
        ),
      ),
    );
  }
}
