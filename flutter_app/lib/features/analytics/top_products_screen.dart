import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-ANA-03 · `/insights/products` · Top productos y clasificación ABC (Pareto).
///
/// Permiso: `analytics:read`.
/// Clasificación de inventario en categorías A (80% valor), B (15% valor) y C (5% valor) con márgenes y unidades.
class TopProductsScreen extends StatefulWidget {
  const TopProductsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<TopProductsScreen> createState() => _TopProductsScreenState();
}

class _TopProductsScreenState extends State<TopProductsScreen> {
  String _selectedClass = 'all';

  final List<Map<String, dynamic>> _products = [
    {
      'sku': 'SKU-CAFE-01',
      'name': 'Café Geisha Especialidad 250g',
      'class': 'A',
      'sales_cents': 1850000, // $18,500.00
      'units': 740,
      'margin_pct': 42.5,
      'share_pct': 40.3,
    },
    {
      'sku': 'SKU-ACEITE-02',
      'name': 'Aceite de Oliva Extra Virgen 1L',
      'class': 'A',
      'sales_cents': 1240000, // $12,400.00
      'units': 992,
      'margin_pct': 28.0,
      'share_pct': 27.0,
    },
    {
      'sku': 'SKU-QUESO-04',
      'name': 'Queso Parmigiano Reggiano 24M',
      'class': 'B',
      'sales_cents': 480000, // $4,800.00
      'units': 320,
      'margin_pct': 35.0,
      'share_pct': 10.5,
    },
    {
      'sku': 'SKU-VINO-09',
      'name': 'Vino Tinto Reserva Malbec',
      'class': 'B',
      'sales_cents': 320000, // $3,200.00
      'units': 213,
      'margin_pct': 31.0,
      'share_pct': 7.0,
    },
    {
      'sku': 'SKU-SNACK-11',
      'name': 'Galletas Artesanales de Avena',
      'class': 'C',
      'sales_cents': 95000, // $950.00
      'units': 271,
      'margin_pct': 22.0,
      'share_pct': 2.1,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final filtered = _selectedClass == 'all'
        ? _products
        : _products.where((p) => p['class'] == _selectedClass).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Top productos y matriz ABC'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final c in const [
                    ('all', 'Todos'),
                    ('A', 'Clase A (80% Facturación)'),
                    ('B', 'Clase B (15% Facturación)'),
                    ('C', 'Clase C (5% Facturación)'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(c.$2),
                        selected: _selectedClass == c.$1,
                        onSelected: (_) => setState(() => _selectedClass = c.$1),
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
                  final cls = p['class'] as String;
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
                              Expanded(
                                child: Text(
                                  p['name'] as String,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                              ),
                              StatusChip(
                                label: 'Clase $cls',
                                tone: cls == 'A'
                                    ? StatusChipTone.success
                                    : cls == 'B'
                                        ? StatusChipTone.info
                                        : StatusChipTone.neutral,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('SKU: ${p['sku']}', style: theme.textTheme.bodySmall),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Ventas totales', style: theme.textTheme.labelSmall),
                                  MoneyText(p['sales_cents'] as int, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Unidades', style: theme.textTheme.labelSmall),
                                  Text('${p['units']} und', style: theme.textTheme.titleMedium),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('Margen bruto', style: theme.textTheme.labelSmall),
                                  Text('${p['margin_pct']}%', style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary)),
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
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Exportar análisis ABC (Excel)',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando reporte Pareto ABC...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
