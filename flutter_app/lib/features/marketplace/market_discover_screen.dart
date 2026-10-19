import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'cart_screen.dart';
import 'complaints_screen.dart';
import 'market_orders_screen.dart';
import 'market_product_screen.dart';
import 'storefront_screen.dart';

/// S-MKT-01 · `/market` · Descubrir (Marketplace).
///
/// Búsqueda, categorías, tiendas destacadas cerca de ti y grilla de productos.
class MarketDiscoverScreen extends StatefulWidget {
  const MarketDiscoverScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MarketDiscoverScreen> createState() => _MarketDiscoverScreenState();
}

class _MarketDiscoverScreenState extends State<MarketDiscoverScreen> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'all';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Comprar'),
        actions: [
          IconButton(
            tooltip: 'Mis pedidos',
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => MarketOrdersScreen(api: widget.api),
            )),
          ),
          IconButton(
            tooltip: 'Ayuda y reclamos',
            icon: const Icon(Icons.help_outline),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => ComplaintsScreen(api: widget.api),
            )),
          ),
          IconButton(
            tooltip: 'Carrito',
            icon: Badge(
              label: const Text('2'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => CartScreen(api: widget.api),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Buscador
            TextField(
              controller: _searchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Buscar en tiendas y restaurantes...',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.tune),
                  onPressed: () {},
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Categorías
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final cat in const [
                    ('all', 'Todos', Icons.grid_view),
                    ('food', 'Comida', Icons.restaurant),
                    ('groceries', 'Supermercado', Icons.local_grocery_store),
                    ('pharmacy', 'Farmacia', Icons.local_pharmacy),
                    ('tech', 'Tecnología', Icons.devices),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        avatar: Icon(cat.$3, size: 16),
                        label: Text(cat.$2),
                        selected: _selectedCategory == cat.$1,
                        onSelected: (_) => setState(() => _selectedCategory = cat.$1),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Comercios cerca de ti
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Tiendas cerca de ti', style: theme.textTheme.titleMedium),
                TextButton(onPressed: () {}, child: const Text('Ver más')),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 140,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _StoreCard(
                    name: 'Supermercado Rey',
                    category: 'Supermercado · 1.2 km',
                    rating: '4.8 (210)',
                    eta: '25-35 min',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => StorefrontScreen(
                        api: widget.api,
                        storeSlug: 'super-rey',
                        storeName: 'Supermercado Rey',
                      ),
                    )),
                  ),
                  const SizedBox(width: 12),
                  _StoreCard(
                    name: 'Café Unido',
                    category: 'Cafetería · 0.8 km',
                    rating: '4.9 (95)',
                    eta: '15-25 min',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => StorefrontScreen(
                        api: widget.api,
                        storeSlug: 'cafe-unido',
                        storeName: 'Café Unido',
                      ),
                    )),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Productos populares
            Text('Productos populares', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.78,
              children: [
                _ProductGridTile(
                  name: 'Café Geisha Especial 250g',
                  store: 'Café Unido',
                  priceMinor: 1850,
                  warranty: '30 días garantía',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => MarketProductScreen(
                      api: widget.api,
                      productId: 'prod-1',
                      name: 'Café Geisha Especial 250g',
                      storeName: 'Café Unido',
                      priceMinor: 1850,
                    ),
                  )),
                ),
                _ProductGridTile(
                  name: 'Canasta Frutas Frescas',
                  store: 'Supermercado Rey',
                  priceMinor: 975,
                  warranty: 'Garantía de frescura',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => MarketProductScreen(
                      api: widget.api,
                      productId: 'prod-2',
                      name: 'Canasta Frutas Frescas',
                      storeName: 'Supermercado Rey',
                      priceMinor: 975,
                    ),
                  )),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({
    required this.name,
    required this.category,
    required this.rating,
    required this.eta,
    required this.onTap,
  });

  final String name;
  final String category;
  final String rating;
  final String eta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: 220,
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    child: Icon(Icons.store, size: 18, color: theme.colorScheme.onPrimaryContainer),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(name, style: theme.textTheme.titleSmall, overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
              const Spacer(),
              Text(category, style: theme.textTheme.bodySmall),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.star, size: 14, color: Colors.amber),
                  const SizedBox(width: 4),
                  Text(rating, style: const TextStyle(fontSize: 12)),
                  const Spacer(),
                  StatusChip(label: eta, tone: StatusTone.neutral),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductGridTile extends StatelessWidget {
  const _ProductGridTile({
    required this.name,
    required this.store,
    required this.priceMinor,
    required this.warranty,
    required this.onTap,
  });

  final String name;
  final String store;
  final int priceMinor;
  final String warranty;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 80,
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(child: Icon(Icons.inventory_2_outlined, size: 36)),
              ),
              const SizedBox(height: 8),
              Text(name, style: theme.textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text(store, style: TextStyle(fontSize: 11, color: theme.colorScheme.primary)),
              const Spacer(),
              MoneyText(priceMinor, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(warranty, style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }
}
