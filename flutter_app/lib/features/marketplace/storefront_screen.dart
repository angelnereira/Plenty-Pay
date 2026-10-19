import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'cart_screen.dart';
import 'market_product_screen.dart';

/// S-MKT-02 · `/market/s/:slug` · Vitrina del comercio.
class StorefrontScreen extends StatelessWidget {
  const StorefrontScreen({
    super.key,
    required this.api,
    required this.storeSlug,
    required this.storeName,
  });

  final ApiClient api;
  final String storeSlug;
  final String storeName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(storeName),
        actions: [
          IconButton(
            tooltip: 'Carrito',
            icon: Badge(
              label: const Text('2'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => CartScreen(api: api),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Encabezado de la tienda
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: theme.colorScheme.primaryContainer,
                      child: Icon(Icons.store, size: 30, color: theme.colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(storeName, style: theme.textTheme.titleMedium),
                              const SizedBox(width: 4),
                              Icon(Icons.verified, size: 16, color: theme.colorScheme.primary),
                            ],
                          ),
                          const SizedBox(height: 4),
                          const Text('RUC: 155689432-2-2022 DV 45', style: TextStyle(fontSize: 12)),
                          const SizedBox(height: 6),
                          const Row(
                            children: [
                              Icon(Icons.star, size: 14, color: Colors.amber),
                              SizedBox(width: 4),
                              Text('4.9 · Abierto hasta las 8:00 p. m.', style: TextStyle(fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Opciones de despacho
            Row(
              children: [
                const StatusChip(label: 'Entrega en 25 min', tone: StatusTone.success),
                const SizedBox(width: 8),
                const StatusChip(label: 'Retiro en tienda', tone: StatusTone.info),
                const Spacer(),
                TextButton.icon(
                  icon: const Icon(Icons.info_outline, size: 16),
                  label: const Text('Políticas'),
                  onPressed: () {},
                ),
              ],
            ),
            const SizedBox(height: 16),

            Text('Catálogo de la tienda', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),

            _StoreProductTile(
              name: 'Cappuccino Artesanal 12oz',
              description: 'Espresso doble con leche texturizada al punto.',
              priceMinor: 375,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => MarketProductScreen(
                  api: api,
                  productId: 'p-cap',
                  name: 'Cappuccino Artesanal 12oz',
                  storeName: storeName,
                  priceMinor: 375,
                ),
              )),
            ),
            _StoreProductTile(
              name: 'Croissant de Almendras',
              description: 'Masa hojaldrada rellena de crema de almendras tostadas.',
              priceMinor: 425,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => MarketProductScreen(
                  api: api,
                  productId: 'p-cro',
                  name: 'Croissant de Almendras',
                  storeName: storeName,
                  priceMinor: 425,
                ),
              )),
            ),
            _StoreProductTile(
              name: 'Cold Brew Botella 500mL',
              description: 'Extracción en frío durante 18 horas. Sin azúcar.',
              priceMinor: 500,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => MarketProductScreen(
                  api: api,
                  productId: 'p-cb',
                  name: 'Cold Brew Botella 500mL',
                  storeName: storeName,
                  priceMinor: 500,
                ),
              )),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoreProductTile extends StatelessWidget {
  const _StoreProductTile({
    required this.name,
    required this.description,
    required this.priceMinor,
    required this.onTap,
  });

  final String name;
  final String description;
  final int priceMinor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(name, style: theme.textTheme.titleSmall),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(description, style: theme.textTheme.bodySmall),
            const SizedBox(height: 6),
            MoneyText(priceMinor, style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary)),
          ],
        ),
        trailing: FilledButton.tonal(
          onPressed: onTap,
          child: const Text('Agregar'),
        ),
        onTap: onTap,
      ),
    );
  }
}
