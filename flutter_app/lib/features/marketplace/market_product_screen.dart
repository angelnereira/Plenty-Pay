import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'cart_screen.dart';

/// S-MKT-03 · `/market/p/:id` · Ficha de producto en Marketplace.
///
/// Precio final total, garantía de ley (N-CON-02), datos del vendedor y políticas de devolución.
class MarketProductScreen extends StatefulWidget {
  const MarketProductScreen({
    super.key,
    required this.api,
    required this.productId,
    this.name = 'Café Geisha Especial 250g',
    this.storeName = 'Café Unido',
    this.priceMinor = 1850,
  });

  final ApiClient api;
  final String productId;
  final String name;
  final String storeName;
  final int priceMinor;

  @override
  State<MarketProductScreen> createState() => _MarketProductScreenState();
}

class _MarketProductScreenState extends State<MarketProductScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totalMinor = widget.priceMinor * _quantity;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.name),
        actions: [
          IconButton(
            tooltip: 'Carrito',
            icon: const Icon(Icons.shopping_cart_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => CartScreen(api: widget.api),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Imagen de cabecera
                  Container(
                    height: 180,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Icon(Icons.inventory_2_outlined, size: 64, color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ),
                  const SizedBox(height: 16),

                  Text(widget.name, style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text('Vendido por ', style: theme.textTheme.bodySmall),
                      Text(widget.storeName, style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary)),
                      const SizedBox(width: 4),
                      Icon(Icons.verified, size: 14, color: theme.colorScheme.primary),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      MoneyText(
                        widget.priceMinor,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const StatusChip(label: 'ITBMS incluido', tone: StatusTone.neutral),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Garantía y políticas legales (N-CON-02, N-CON-03, N-CON-07)
                  Card(
                    color: theme.colorScheme.surfaceContainerLow,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.security, size: 18, color: theme.colorScheme.primary),
                              const SizedBox(width: 8),
                              const Text('Garantía y protección al consumidor', style: TextStyle(fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text('• Garantía legal del fabricante: 3 meses.'),
                          const SizedBox(height: 4),
                          const Text('• Derecho de retracto y devolución dentro de 7 días hábiles.'),
                          const SizedBox(height: 4),
                          const Text('• Reembolso directo a tu Billetera en caso de cancelación.'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  Text('Cantidad', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      IconButton.filledTonal(
                        icon: const Icon(Icons.remove),
                        onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('$_quantity', style: theme.textTheme.titleMedium),
                      ),
                      IconButton.filledTonal(
                        icon: const Icon(Icons.add),
                        onPressed: () => setState(() => _quantity++),
                      ),
                      const Spacer(),
                      Text('En existencias: 18 ud', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant)),
              ),
              child: PPButton.primary(
                label: 'Agregar al carrito · ${MoneyText.format(totalMinor)}',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Se agregaron $_quantity unidad(es) de ${widget.name}.'),
                      action: SnackBarAction(
                        label: 'Ver carrito',
                        onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                          builder: (_) => CartScreen(api: widget.api),
                        )),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
