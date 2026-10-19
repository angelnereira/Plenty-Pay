import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

/// S-ANA-07 · `/insights/forecast` · Pronóstico de ventas e intervalos de confianza.
///
/// Permiso: `analytics:read`.
/// Predicción de demanda con intervalos percentiles P10, P50 y P90 considerando festividades de Panamá.
class ForecastScreen extends StatefulWidget {
  const ForecastScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ForecastScreen> createState() => _ForecastScreenState();
}

class _ForecastScreenState extends State<ForecastScreen> {
  final List<Map<String, dynamic>> _periods = [
    {
      'period': 'Semana 43 (20 – 26 de octubre de 2026)',
      'p10_cents': 1120000, // $11,200 (pesimista)
      'p50_cents': 1350000, // $13,500 (esperado)
      'p90_cents': 1580000, // $15,800 (optimista)
      'factor': 'Tendencia de fin de mes',
    },
    {
      'period': 'Semana 44 (27 de octubre – 2 de noviembre de 2026)',
      'p10_cents': 1400000,
      'p50_cents': 1680000,
      'p90_cents': 1950000,
      'factor': 'Víspera de Fiestas Patrias de Panamá (3 – 5 de noviembre)',
    },
    {
      'period': 'Semana 45 (3 – 9 de noviembre de 2026)',
      'p10_cents': 1800000,
      'p50_cents': 2250000,
      'p90_cents': 2700000,
      'factor': 'Fiestas Patrias: alto consumo en alimentos y bebidas',
    },
    {
      'period': 'Semana 48 (24 – 30 de noviembre de 2026)',
      'p10_cents': 2500000,
      'p50_cents': 3100000,
      'p90_cents': 3800000,
      'factor': 'Black Friday & Cyber Week Panamá',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pronóstico y demanda predictiva'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _periods.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final p = _periods[index];
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
                    Text(p['period'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.event, size: 16, color: theme.colorScheme.secondary),
                        const SizedBox(width: 4),
                        Expanded(child: Text(p['factor'] as String, style: theme.textTheme.bodySmall)),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('P10 (Bajo)', style: theme.textTheme.labelSmall),
                            MoneyText(p['p10_cents'] as int, style: theme.textTheme.bodyMedium),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text('P50 (Esperado)', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary)),
                            MoneyText(
                              p['p50_cents'] as int,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('P90 (Alto)', style: theme.textTheme.labelSmall),
                            MoneyText(p['p90_cents'] as int, style: theme.textTheme.bodyMedium),
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
            label: 'Recalcular modelo predictivo',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Re-entrenando modelo estacional con series de tiempo...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
