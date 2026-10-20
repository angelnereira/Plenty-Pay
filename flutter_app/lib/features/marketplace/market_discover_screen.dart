import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import 'cart_screen.dart';
import 'market_data.dart';
import 'market_orders_screen.dart';
import 'market_product_screen.dart';
import 'market_widgets.dart';

/// S-MKT-01 · `/market` · Descubrir. `orders:create:self` · `GET /v1/marketplace/search`.
///
/// e1 buscador (al enviar o tras 400 ms con ≥ 2 caracteres) · e5 cuadrícula con precio total
/// (ITBMS incluido, N-CON-01), tienda y "Agotado" · e6 carrito con contador. Categorías, "Cerca
/// de mí" y filtros (e2–e4) llegan con geolocation (F14) y las categorías públicas: sin servicio no
/// se muestran.
class MarketDiscoverScreen extends StatefulWidget {
  const MarketDiscoverScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<MarketDiscoverScreen> createState() => _MarketDiscoverScreenState();
}

class _MarketDiscoverScreenState extends State<MarketDiscoverScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late Future<List<MarketProduct>> _future = _load();
  List<MarketProduct> _items = const [];
  String _next = '';
  bool _loadingMore = false;
  int _cartCount = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshCart());
  }

  Future<List<MarketProduct>> _load() async {
    final (items, next) = await searchMarket(widget.api, query: _query);
    _items = items;
    _next = next;
    return items;
  }

  Future<void> _refreshCart() async {
    try {
      final n = cartLines(await widget.api.getCart()).length;
      if (mounted) setState(() => _cartCount = n);
    } on ApiException catch (e) {
      // El contador es informativo: sin carrito se muestra 0.
      widget.api.logger.breadcrumb('ui', 'market.cart_count', e.reason);
    }
  }

  void _onQuery(String text) {
    _debounce?.cancel();
    final q = text.trim();
    if (q.isNotEmpty && q.length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 400), () => _submit(q));
  }

  void _submit(String q) {
    _debounce?.cancel();
    if (q == _query) return;
    setState(() {
      _query = q;
      _future = _load();
    });
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final (more, next) =
          await searchMarket(widget.api, query: _query, pageToken: _next);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...more];
        _next = next;
        _future = Future.value(_items);
      });
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.load_more', e is ApiException ? e.reason : 'network');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(marketErrorMessage(AppLocalizations.of(context), e))));
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _open(MarketProduct p) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => MarketProductScreen(api: widget.api, product: p)));
    unawaited(_refreshCart());
  }

  Future<void> _openCart() async {
    await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => CartScreen(api: widget.api)));
    unawaited(_refreshCart());
  }

  @override
  void dispose() {
    _debounce?.cancel();
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
        title: Text(l10n.moduleMarketplace),
        actions: [
          IconButton(
            tooltip: l10n.mktMyOrders,
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => MarketOrdersScreen(api: widget.api))),
          ),
          IconButton(
            key: const Key('market-cart'),
            tooltip: l10n.mktCart,
            icon: Badge(
              isLabelVisible: _cartCount > 0,
              label: Text('$_cartCount'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            onPressed: _openCart,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _reload();
          await _refreshCart();
        },
        child: FutureBuilder<List<MarketProduct>>(
          future: _future,
          builder: (context, snap) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
            children: [
              TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onChanged: _onQuery,
                onSubmitted: (t) => _submit(t.trim()),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: l10n.mktSearchHint,
                ),
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
                      _query.isEmpty
                          ? l10n.mktEmpty
                          : l10n.mktNoResults(_query),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyLarge),
                ),
                builder: (context, items) => Column(children: [
                  MarketGrid(api: widget.api, items: items, onTap: _open),
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
            ],
          ),
        ),
      ),
    );
  }
}
