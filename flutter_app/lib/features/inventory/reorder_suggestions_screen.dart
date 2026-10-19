import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/status_chip.dart';
import 'purchase_orders_screen.dart';

/// S-INV-08 · `/inventory/suggestions` · Sugerencias automáticas de reorden.
class ReorderSuggestionsScreen extends StatelessWidget {
  const ReorderSuggestionsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final suggestions = [
      {
        'product': 'Vasos biodegradables 12oz',
        'currentStock': 80,
        'minStock': 200,
        'velocity': '45 ud/día',
        'suggestedQty': 500,
        'supplier': 'Empaques del Istmo S.A.',
        'urgency': 'Crítico (quedan 1.8 días)',
        'tone': StatusTone.error,
      },
      {
        'product': 'Leche Entera Grado A (Litro)',
        'currentStock': 24,
        'minStock': 50,
        'velocity': '18 ud/día',
        'suggestedQty': 100,
        'supplier': 'Molino Santa Rosa',
        'urgency': 'Próximo a quiebre',
        'tone': StatusTone.warning,
      },
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Sugerencias de reorden')),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: suggestions.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            final item = suggestions[i];
            return Card(
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
                            item['product'] as String,
                            style: theme.textTheme.titleMedium,
                          ),
                        ),
                        StatusChip(
                          label: item['urgency'] as String,
                          tone: item['tone'] as StatusTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Proveedor habitual: ${item['supplier']}'),
                    const SizedBox(height: 4),
                    Text('Velocidad de venta: ${item['velocity']} · Existencia actual: ${item['currentStock']} ud'),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Cantidad recomendada:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            Text('${item['suggestedQty']} unidades', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          ],
                        ),
                        FilledButton.tonal(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Orden de compra borrador generada para ${item['supplier']}.')),
                            );
                            Navigator.of(context).push(MaterialPageRoute<void>(
                              builder: (_) => PurchaseOrdersScreen(api: api),
                            ));
                          },
                          child: const Text('Crear orden de compra'),
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
    );
  }
}
