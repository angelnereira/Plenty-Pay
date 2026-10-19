import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'checkout_screen.dart';

/// S-MKT-04 · `/market/cart` · Carrito agrupado por comercio.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartLine {
  _CartLine({
    required this.name,
    required this.store,
    required this.unitPriceMinor,
    required this.quantity,
  });

  final String name;
  final String store;
  final int unitPriceMinor;
  int quantity;

  int get totalMinor => unitPriceMinor * quantity;
}

class _CartScreenState extends State<CartScreen> {
  late final List<_CartLine> _items = [
    _CartLine(
      name: 'Café Geisha Especial 250g',
      store: 'Café Unido',
      unitPriceMinor: 1850,
      quantity: 1,
    ),
    _CartLine(
      name: 'Croissant de Almendras',
      store: 'Café Unido',
      unitPriceMinor: 425,
      quantity: 2,
    ),
  ];

  int get _subtotalMinor => _items.fold(0, (sum, i) => sum + i.totalMinor);
  int get _deliveryFeeMinor => _items.isEmpty ? 0 : 250;
  int get _totalMinor => _subtotalMinor + _deliveryFeeMinor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (_items.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.cartTitle)),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_cart_outlined, size: 64, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              const SizedBox(height: 16),
              Text(l10n.emptyCart, style: theme.textTheme.titleMedium),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.cartTitle),
        actions: [
          IconButton(
            tooltip: 'Vaciar carrito',
            icon: const Icon(Icons.delete_outline),
            onPressed: () => setState(() => _items.clear()),
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
                  // Encabezado del comercio
                  Row(
                    children: [
                      Icon(Icons.store, color: theme.colorScheme.primary, size: 20),
                      const SizedBox(width: 8),
                      Text('Café Unido', style: theme.textTheme.titleMedium),
                    ],
                  ),
                  const SizedBox(height: 12),

                  for (int idx = 0; idx < _items.length; idx++) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(_items[idx].name, style: theme.textTheme.titleSmall),
                                  const SizedBox(height: 4),
                                  MoneyText(_items[idx].unitPriceMinor, style: theme.textTheme.bodySmall),
                                ],
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                                  onPressed: () {
                                    setState(() {
                                      if (_items[idx].quantity > 1) {
                                        _items[idx].quantity--;
                                      } else {
                                        _items.removeAt(idx);
                                      }
                                    });
                                  },
                                ),
                                Text('${_items[idx].quantity}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline, size: 20),
                                  onPressed: () => setState(() => _items[idx].quantity++),
                                ),
                              ],
                            ),
                            const SizedBox(width: 8),
                            MoneyText(
                              _items[idx].totalMinor,
                              style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],

                  const SizedBox(height: 16),
                  Card(
                    color: theme.colorScheme.surfaceContainerLow,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(l10n.subtotal),
                              MoneyText(_subtotalMinor),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Tarifa de entrega estimada'),
                              MoneyText(_deliveryFeeMinor),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(l10n.total, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                              MoneyText(
                                _totalMinor,
                                style: theme.textTheme.titleLarge?.copyWith(
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
            Padding(
              padding: const EdgeInsets.all(16),
              child: PPButton.primary(
                label: 'Continuar al pago',
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => CheckoutScreen(api: widget.api, totalMinor: _totalMinor),
                )),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
