import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

/// S-MKT-01 · `/cart` · Carrito.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.cartTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.shopping_cart_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(height: 12),
                    Text(l10n.emptyCart, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: PPButton.primary(label: l10n.actionCheckout, onPressed: () {}),
            ),
          ],
        ),
      ),
    );
  }
}

/// S-MKT-02 · `/checkout` · Checkout.
class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.checkoutTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(l10n.deliveryMethod, style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'pickup', label: Text('Retiro en tienda')),
                ButtonSegment(value: 'delivery', label: Text('Entrega a domicilio')),
              ],
              selected: const {'pickup'},
              onSelectionChanged: (_) {},
            ),
            const SizedBox(height: 16),
            Text(l10n.paymentMethod, style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            const Card(child: ListTile(leading: Icon(Icons.account_balance_wallet), title: Text('Wallet PlentyPay'))),
            const SizedBox(height: 16),
            Text(l10n.orderSummary, style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            const Card(child: Padding(padding: EdgeInsets.all(12), child: Row(children: [Expanded(child: Text('Total')), MoneyText(0)]))),
            const SizedBox(height: 24),
            PPButton.primary(label: l10n.actionPlaceOrder, onPressed: () {}),
          ],
        ),
      ),
    );
  }
}

/// S-MKT-03 · `/orders` · Mis pedidos.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersTitle)),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final f in const [
                    ('all', 'Todos'),
                    ('pending', 'Pendientes'),
                    ('paid', 'Pagados'),
                    ('shipped', 'Enviados'),
                    ('delivered', 'Entregados'),
                    ('cancelled', 'Cancelados'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(f.$2),
                        selected: _filter == f.$1,
                        onSelected: (_) => setState(() => _filter = f.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.receipt_long_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(height: 12),
                    Text(l10n.emptyOrders, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}