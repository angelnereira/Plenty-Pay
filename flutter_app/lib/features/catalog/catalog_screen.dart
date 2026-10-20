import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'catalog_data.dart';
import 'catalog_errors.dart';
import 'categories_screen.dart';
import 'product_image.dart';
import 'product_screen.dart';
import 'storefront_settings_screen.dart';

/// S-CAT-01 · `/catalog` · Lista de productos. `catalog:read` · `GET /v1/catalog/products`.
///
/// Buscador (nombre, SKU o código; con escáner), filtro Activos/Archivados, lista con foto,
/// nombre, SKU y precio, "Nuevo producto" y "Mi tienda en línea" (S-CAT-05). Importar, exportar y
/// variantes llegan con F15.3 (sin servicio todavía: no se muestran).
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _search = TextEditingController();
  bool _archived = false;
  late Future<List<ProductItem>> _future = _load();
  String _next = '';
  bool _loadingMore = false;
  List<ProductItem> _items = const [];

  Future<List<ProductItem>> _load() async {
    final (items, next) = await loadProducts(widget.api,
        query: _search.text.trim(), archived: _archived);
    _items = items;
    _next = next;
    return items;
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final (more, next) = await loadProducts(widget.api,
          query: _search.text.trim(), archived: _archived, pageToken: _next);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...more];
        _next = next;
        _future = Future.value(_items);
      });
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.load_more', e is ApiException ? e.reason : 'network');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(catalogErrorMessage(AppLocalizations.of(context), e))));
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _scan() async {
    final l10n = AppLocalizations.of(context);
    final code = await BarcodeScannerDialog.scan(context,
        title: l10n.scanBarcode, subtitle: l10n.searchProductsHint);
    if (code == null || code.isEmpty || !mounted) return;
    _search.text = code;
    _reload();
  }

  Future<void> _open(ProductItem? product) async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => ProductScreen(api: widget.api, product: product),
    ));
    if (changed == true) _reload();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.catalogTitle),
        actions: [
          IconButton(
            tooltip: l10n.sfTitle,
            icon: const Icon(Icons.storefront_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => StorefrontSettingsScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: l10n.catCategories,
            icon: const Icon(Icons.category_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => CategoriesScreen(api: widget.api))),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(null),
        icon: const Icon(Icons.add),
        label: Text(l10n.catNewProduct),
      ),
      body: FutureBuilder<List<ProductItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingXl * 3),
          children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _reload(),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: l10n.searchProductsHint,
                suffixIcon: IconButton(
                  icon: const Icon(Icons.qr_code_scanner),
                  tooltip: l10n.scanBarcode,
                  onPressed: _scan,
                ),
              ),
            ),
            const SizedBox(height: AppTokens.spacingSm),
            Wrap(spacing: AppTokens.spacingSm, children: [
              ChoiceChip(
                label: Text(l10n.catFilterActive),
                selected: !_archived,
                onSelected: (_) {
                  _archived = false;
                  _reload();
                },
              ),
              ChoiceChip(
                label: Text(l10n.catFilterArchived),
                selected: _archived,
                onSelected: (_) {
                  _archived = true;
                  _reload();
                },
              ),
            ]),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<ProductItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                child: Text(l10n.catEmpty,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge),
              ),
              builder: (context, items) => Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Column(children: [
                  for (final p in items)
                    ListTile(
                      leading: ProductThumb(api: widget.api, product: p),
                      title: Text(p.name),
                      subtitle: Text(l10n.catSkuValue(p.sku)),
                      trailing: p.archived
                          ? StatusChip(
                              label: l10n.catArchivedChip,
                              tone: StatusTone.neutral)
                          : MoneyText(p.priceMinor,
                              style: theme.textTheme.titleMedium),
                      onTap: () => _open(p),
                    ),
                  if (_next.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(AppTokens.spacingSm),
                      child: TextButton(
                        onPressed: _loadingMore ? null : _loadMore,
                        child: Text(l10n.catLoadMore),
                      ),
                    ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
