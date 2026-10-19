import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/status_chip.dart';
import 'stock_adjust_screen.dart';
import 'stock_transfer_screen.dart';

/// S-INV-02 · `/inventory/:variant` · Detalle de existencias, lotes y movimientos.
class StockDetailScreen extends StatelessWidget {
  const StockDetailScreen({
    super.key,
    required this.api,
    this.name = 'Café Geisha Especial 250g',
    this.sku = 'CAF-GEI-001',
    this.totalStock = 45,
    this.reservedStock = 5,
    this.availableStock = 40,
    this.unit = 'ud',
  });

  final ApiClient api;
  final String name;
  final String sku;
  final int totalStock;
  final int reservedStock;
  final int availableStock;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          IconButton(
            tooltip: 'Ajustar stock',
            icon: const Icon(Icons.tune),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => StockAdjustScreen(api: api, productName: name),
            )),
          ),
          IconButton(
            tooltip: 'Transferir entre bodegas',
            icon: const Icon(Icons.swap_horiz),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => StockTransferScreen(api: api, productName: name),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('SKU: $sku', style: theme.textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _StockNumber(label: 'Total', count: totalStock, unit: unit),
                        _StockNumber(label: 'Reservado', count: reservedStock, unit: unit, color: Colors.orange),
                        _StockNumber(label: 'Disponible', count: availableStock, unit: unit, color: Colors.green),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            Text('Lotes y vencimientos (FEFO)', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: const Icon(Icons.inventory),
                title: const Text('Lote #L-2026-09 · 25 ud'),
                subtitle: const Text('Vence: 15 dic 2026 · Bodega Central'),
                trailing: const StatusChip(label: 'Óptimo', tone: StatusTone.success),
              ),
            ),
            Card(
              child: ListTile(
                leading: const Icon(Icons.inventory),
                title: const Text('Lote #L-2026-10 · 20 ud'),
                subtitle: const Text('Vence: 28 ene 2027 · Sucursal Calle 50'),
                trailing: const StatusChip(label: 'Óptimo', tone: StatusTone.success),
              ),
            ),
            const SizedBox(height: 20),

            Text('Movimientos recientes', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            const Card(
              child: ListTile(
                dense: true,
                leading: Icon(Icons.remove_circle_outline, color: Colors.red),
                title: Text('Venta POS #SALE-8921 (-1 ud)'),
                subtitle: Text('19 oct 2026, 10:45 a. m.'),
              ),
            ),
            const Card(
              child: ListTile(
                dense: true,
                leading: Icon(Icons.add_circle_outline, color: Colors.green),
                title: Text('Recepción de orden de compra OC-102 (+30 ud)'),
                subtitle: Text('15 oct 2026, 2:30 p. m.'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StockNumber extends StatelessWidget {
  const _StockNumber({required this.label, required this.count, required this.unit, this.color});

  final String label;
  final int count;
  final String unit;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$count $unit', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}
