import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-CAT-01 · `/catalog` · Lista de productos.
///
/// `catalog:read` · `/v1/catalog/products`. Buscador + filtros + lista con foto,
/// nombre, SKU, precio, existencias. Un solo botón filled ("Nuevo producto").
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _search = TextEditingController();
  String _filterStatus = 'all';
  bool _loading = false;
  List<ProductRow> _products = const [];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      // El listado real llega de `catalog.ListProducts` (gRPC vía api-gateway).
      // Mientras no haya un cliente tipado, la pantalla muestra el estado vacío.
      if (!mounted) return;
      setState(() => _products = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.catalogTitle),
        actions: [
          IconButton(
            tooltip: l10n.actionImport,
            icon: const Icon(Icons.file_upload_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _reload(),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.qr_code_scanner),
                    tooltip: l10n.scanBarcode,
                    onPressed: () {},
                  ),
                  hintText: l10n.searchProductsHint,
                ),
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  for (final f in const [
                    ('all', 'Todos'),
                    ('active', 'Activos'),
                    ('archived', 'Archivados'),
                    ('out_of_stock', 'Sin existencias'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(f.$2),
                        selected: _filterStatus == f.$1,
                        onSelected: (_) {
                          setState(() => _filterStatus = f.$1);
                          _reload();
                        },
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _products.isEmpty
                      ? _EmptyCatalog(onNew: () {})
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _products.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, i) => _ProductTile(product: _products[i]),
                        ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(label: l10n.actionNewProduct, onPressed: () {}),
        ),
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({required this.product});

  final ProductRow product;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        leading: _ProductPhoto(url: product.photoUrl),
        title: Text(product.name, style: theme.textTheme.bodyLarge),
        subtitle: Text(
          '${product.sku} · ${MoneyText.format(product.priceMinor)}',
          style: theme.textTheme.bodySmall,
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('${product.stock} ${product.unit}', style: theme.textTheme.bodySmall),
            StatusChip(
              label: product.statusLabel,
              tone: product.isActive ? StatusTone.success : StatusTone.neutral,
            ),
          ],
        ),
        onTap: () {},
      ),
    );
  }
}

class _ProductPhoto extends StatelessWidget {
  const _ProductPhoto({this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: url == null
          ? Icon(Icons.image_outlined, color: theme.colorScheme.onSurface.withValues(alpha: 0.5))
          : ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(url!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Icon(Icons.broken_image_outlined, color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
            ),
    );
  }
}

class _EmptyCatalog extends StatelessWidget {
  const _EmptyCatalog({required this.onNew});

  final VoidCallback onNew;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inventory_2_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(l10n.emptyCatalogTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(l10n.emptyCatalogBody, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 16),
            PPButton.primary(label: l10n.actionNewProduct, onPressed: onNew),
            const SizedBox(height: 8),
            PPButton.secondary(label: l10n.actionImport, onPressed: () {}),
          ],
        ),
      ),
    );
  }
}

/// Fila del listado: lo que el servidor devuelve para S-CAT-01.
@immutable
class ProductRow {
  const ProductRow({
    required this.id,
    required this.name,
    required this.sku,
    required this.priceMinor,
    required this.stock,
    required this.unit,
    required this.statusLabel,
    required this.isActive,
    this.photoUrl,
  });

  final String id;
  final String name;
  final String sku;
  final int priceMinor;
  final int stock;
  final String unit;
  final String statusLabel;
  final bool isActive;
  final String? photoUrl;
}