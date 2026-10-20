import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/status_chip.dart';
import 'market_data.dart';
import 'market_product_screen.dart';
import 'market_widgets.dart';

/// S-MKT-03 · `/market/s/:id` · Tienda. `GET /v1/marketplace/storefronts/{id}` y la búsqueda
/// filtrada al comercio. Cabecera con nombre, "Verificado" y descripción; buscador dentro de la
/// tienda. Horario, RUC y dirección llegan cuando la vitrina los guarde (S-CAT-05 e2–e3).
class StorefrontScreen extends StatefulWidget {
  const StorefrontScreen(
      {super.key,
      required this.api,
      required this.tenantId,
      required this.name});
  final ApiClient api;
  final String tenantId;
  final String name;

  @override
  State<StorefrontScreen> createState() => _StorefrontScreenState();
}

class _StorefrontScreenState extends State<StorefrontScreen> {
  final _search = TextEditingController();
  StorefrontInfo? _store;
  late Future<List<MarketProduct>> _future = _load();

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    try {
      final s =
          StorefrontInfo.fromJson(await widget.api.storefront(widget.tenantId));
      if (mounted) setState(() => _store = s);
    } on ApiException catch (e) {
      widget.api.logger.breadcrumb('ui', 'market.storefront', e.reason);
    }
  }

  Future<List<MarketProduct>> _load() async {
    final (items, _) = await searchMarket(widget.api,
        query: _search.text.trim(), merchant: widget.tenantId);
    return items;
  }

  void _reload() => setState(() {
        _future = _load();
      });

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
    final store = _store;
    final name = store?.displayName.isNotEmpty == true
        ? store!.displayName
        : widget.name;
    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: FutureBuilder<List<MarketProduct>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
          children: [
            Card(
              margin: EdgeInsets.zero,
              elevation: 0,
              color: theme.colorScheme.surfaceContainer,
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: theme.textTheme.titleLarge),
                    if (store?.verified == true) ...[
                      const SizedBox(height: AppTokens.spacingXs),
                      StatusChip(
                          label: l10n.mktVerified, tone: StatusTone.success),
                    ],
                    if (store != null && store.description.isNotEmpty) ...[
                      const SizedBox(height: AppTokens.spacingSm),
                      Text(store.description,
                          style: theme.textTheme.bodyMedium),
                    ],
                    const SizedBox(height: AppTokens.spacingSm),
                    Text(l10n.mktPickupFree, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _reload(),
              decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: l10n.mktSearchHint),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<MarketProduct>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? marketErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                child: Text(
                    _search.text.trim().isEmpty
                        ? l10n.mktEmpty
                        : l10n.mktNoResults(_search.text.trim()),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge),
              ),
              builder: (context, items) => MarketGrid(
                api: widget.api,
                items: items,
                onTap: (p) => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                        builder: (_) =>
                            MarketProductScreen(api: widget.api, product: p))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
