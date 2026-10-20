import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'market_data.dart';
import 'market_widgets.dart';
import 'storefront_screen.dart';

/// S-MKT-02 · `/market/p/:id` · Producto. `GET /v1/marketplace/products/{id}` · N-CON-01, N-CON-02.
///
/// e1 galería · e2 nombre, precio total e "ITBMS incluido" · e3 unidad a granel · e5 cantidad ·
/// e6 vendedor con "Ver tienda" · e7 retiro en tienda · e10 descripción · e12 "Agregar al
/// carrito" (deshabilitado "Agotado"). Variantes, garantía y devoluciones (e4, e8, e9) llegan con
/// sus datos en catalog; sin dato no se muestran.
class MarketProductScreen extends StatefulWidget {
  const MarketProductScreen(
      {super.key, required this.api, required this.product});
  final ApiClient api;
  final MarketProduct product;

  @override
  State<MarketProductScreen> createState() => _MarketProductScreenState();
}

const double _galleryMax = 360;

class _MarketProductScreenState extends State<MarketProductScreen> {
  late MarketProduct _p = widget.product;
  late int _qty = qtyStep(widget.product.unitType);
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  /// Existencias y precio vigentes: la tarjeta de la búsqueda puede tener minutos.
  Future<void> _refresh() async {
    try {
      final fresh =
          MarketProduct.fromJson(await widget.api.marketplaceProduct(_p.id));
      if (mounted) setState(() => _p = fresh);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.product', e is ApiException ? e.reason : 'network');
      if (mounted && e is ApiException && e.status == 404) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(AppLocalizations.of(context).error_LISTING_UNAVAILABLE)));
        setState(() => _p = _withoutStock(_p));
      }
    }
  }

  MarketProduct _withoutStock(MarketProduct p) => MarketProduct(
      id: p.id,
      tenantId: p.tenantId,
      storeName: p.storeName,
      storeVerified: p.storeVerified,
      name: p.name,
      description: p.description,
      priceMinor: p.priceMinor,
      unitType: p.unitType,
      imageUrls: p.imageUrls,
      inStock: false,
      pickup: p.pickup,
      delivery: p.delivery);

  /// El carrito guarda la cantidad total por producto: se suma a la que ya tenía.
  Future<void> _add() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _adding = true);
    try {
      final current = cartLines(await widget.api.getCart())
          .where((l) => l.productId == _p.id)
          .fold(0, (a, l) => a + l.qtyMilli);
      await widget.api
          .setCartItem(_p.id, current + _qty, idempotencyKey: newRequestId());
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.mktAdded)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'market.add_to_cart', e is ApiException ? e.reason : 'network');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final wc = WindowClass.of(context);
    final p = _p;
    // Galería cuadrada de hasta [_galleryMax] dp: en ventanas anchas no empuja el precio fuera.
    final gallery = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _galleryMax),
        child: p.imageUrls.length <= 1
            ? MarketImage(
                api: widget.api,
                url: p.imageUrls.isEmpty ? '' : p.imageUrls.first,
                label: p.name)
            : AspectRatio(
                aspectRatio: 1,
                child: PageView(children: [
                  for (final url in p.imageUrls)
                    MarketImage(api: widget.api, url: url, label: p.name),
                ]),
              ),
      ),
    );
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(p.name, style: theme.textTheme.headlineSmall),
        const SizedBox(height: AppTokens.spacingXs),
        MoneyText(p.priceMinor, style: theme.textTheme.headlineMedium),
        Text(
            p.isBulk
                ? '${l10n.mktTaxIncluded} · ${l10n.mktPerUnit(formatQtyLabel(1000, p.unitType).replaceFirst('1 ', ''))}'
                : l10n.mktTaxIncluded,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: AppTokens.spacingMd),
        if (p.inStock)
          QtyStepper(
            qtyMilli: _qty,
            stepMilli: qtyStep(p.unitType),
            min: qtyStep(p.unitType),
            label: l10n.mktQuantity,
            unitType: p.unitType,
            onChanged: (q) => setState(() => _qty = q),
          ),
        const SizedBox(height: AppTokens.spacingSm),
        Card(
          margin: EdgeInsets.zero,
          elevation: 0,
          color: theme.colorScheme.surfaceContainerLow,
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.storefront_outlined),
              title: Text(l10n.mktSoldBy(p.storeName)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => StorefrontScreen(
                      api: widget.api,
                      tenantId: p.tenantId,
                      name: p.storeName))),
            ),
            if (p.pickup)
              ListTile(
                leading: const Icon(Icons.store_mall_directory_outlined),
                title: Text(l10n.mktPickupFree),
              ),
          ]),
        ),
        if (p.description.isNotEmpty) ...[
          const SizedBox(height: AppTokens.spacingMd),
          Text(p.description, style: theme.textTheme.bodyLarge),
        ],
      ],
    );
    return Scaffold(
      appBar: AppBar(title: Text(p.storeName)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(wc.horizontalMargin, AppTokens.spacingSm,
              wc.horizontalMargin, AppTokens.spacingSm),
          child: PPButton.primary(
            label: p.inStock ? l10n.mktAddToCart : l10n.mktSoldOut,
            loading: _adding,
            onPressed: p.inStock ? _add : null,
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(wc.horizontalMargin, AppTokens.spacingSm,
            wc.horizontalMargin, AppTokens.spacingXl),
        children: [
          if (wc.twoPanes)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: gallery),
              const SizedBox(width: AppTokens.spacingLg),
              Expanded(child: details),
            ])
          else ...[
            ClipRRect(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                child: gallery),
            const SizedBox(height: AppTokens.spacingMd),
            details,
          ],
        ],
      ),
    );
  }
}
