import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/product_image.dart' show mediaUrl;
import 'market_data.dart';

/// Foto cuadrada de un producto publicado, con texto alternativo; sin foto, un icono.
class MarketImage extends StatelessWidget {
  const MarketImage(
      {super.key, required this.api, required this.url, required this.label});
  final ApiClient api;
  final String url;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final icon = Center(
        child: Icon(Icons.shopping_bag_outlined,
            color: scheme.onSurfaceVariant, semanticLabel: label));
    return AspectRatio(
      aspectRatio: 1,
      child: ColoredBox(
        color: scheme.surfaceContainerHighest,
        child: url.isEmpty
            ? icon
            : Image.network(mediaUrl(api, url),
                fit: BoxFit.cover,
                semanticLabel: label,
                errorBuilder: (_, __, ___) => icon),
      ),
    );
  }
}

/// Cuadrícula de productos (S-MKT-01 e5): 2 columnas en compact, más en ventanas anchas. Las
/// tarjetas crecen con el texto (200 %) en vez de recortarlo.
class MarketGrid extends StatelessWidget {
  const MarketGrid(
      {super.key, required this.api, required this.items, required this.onTap});
  final ApiClient api;
  final List<MarketProduct> items;
  final ValueChanged<MarketProduct> onTap;

  @override
  Widget build(BuildContext context) {
    final columns = switch (WindowClass.of(context)) {
      WindowClass.compact => 2,
      WindowClass.medium => 3,
      _ => 4,
    };
    return LayoutBuilder(builder: (context, box) {
      final width =
          (box.maxWidth - AppTokens.spacingSm * (columns - 1)) / columns;
      return Wrap(
        spacing: AppTokens.spacingSm,
        runSpacing: AppTokens.spacingSm,
        children: [
          for (final p in items)
            SizedBox(
                width: width,
                child: _ProductCard(api: api, product: p, onTap: onTap)),
        ],
      );
    });
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard(
      {required this.api, required this.product, required this.onTap});
  final ApiClient api;
  final MarketProduct product;
  final ValueChanged<MarketProduct> onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
      child: InkWell(
        onTap: () => onTap(product),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MarketImage(
                api: api,
                url: product.imageUrls.isEmpty ? '' : product.imageUrls.first,
                label: product.name),
            Padding(
              padding: const EdgeInsets.all(AppTokens.spacingSm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall),
                  MoneyText(product.priceMinor,
                      style: theme.textTheme.titleMedium),
                  Text(product.storeName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                  if (!product.inStock)
                    Padding(
                      padding: const EdgeInsets.only(top: AppTokens.spacingXs),
                      child: StatusChip(
                          label: l10n.mktSoldOut, tone: StatusTone.neutral),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Selector de cantidad −/+ en milésimas (S-MKT-02 e5, S-MKT-04 e2).
class QtyStepper extends StatelessWidget {
  const QtyStepper(
      {super.key,
      required this.qtyMilli,
      required this.stepMilli,
      required this.label,
      required this.unitType,
      this.min = 0,
      this.onChanged});
  final int qtyMilli;
  final int stepMilli;
  final int min;
  final String label;
  final String unitType;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final change = onChanged;
    return Semantics(
      label: label,
      value: formatQtyLabel(qtyMilli, unitType),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(
          tooltip: '−',
          icon: const Icon(Icons.remove),
          onPressed: change == null || qtyMilli - stepMilli < min
              ? null
              : () => change(qtyMilli - stepMilli),
        ),
        ExcludeSemantics(
          child: Text(formatQtyLabel(qtyMilli, unitType),
              style: theme.textTheme.titleMedium),
        ),
        IconButton(
          tooltip: '+',
          icon: const Icon(Icons.add),
          onPressed: change == null ? null : () => change(qtyMilli + stepMilli),
        ),
      ]),
    );
  }
}

/// "2", "1.5 kg": como `formatQty` del catálogo.
String formatQtyLabel(int milli, String unitType) {
  final whole = milli ~/ 1000;
  final frac = milli % 1000;
  final number = frac == 0
      ? '$whole'
      : '$whole.${frac.toString().padLeft(3, '0').replaceAll(RegExp(r'0+$'), '')}';
  return switch (unitType) {
    'KG' => '$number kg',
    'LITER' => '$number L',
    'METER' => '$number m',
    _ => number,
  };
}

/// Paso de cantidad: 1 por unidad; 0.25 de la unidad a granel.
int qtyStep(String unitType) => unitType == 'UNIT' ? 1000 : 250;

/// Tono del chip de un sub-pedido.
StatusTone subTone(String status) => switch (status) {
      'COMPLETED' => StatusTone.success,
      'READY' || 'ACCEPTED' || 'IN_DELIVERY' => StatusTone.info,
      'AWAITING_ACCEPTANCE' || 'PENDING_PAYMENT' => StatusTone.warning,
      'REJECTED' || 'CANCELLED' => StatusTone.error,
      _ => StatusTone.neutral,
    };

StatusTone orderTone(String status) => switch (status) {
      'COMPLETED' => StatusTone.success,
      'PAID' || 'PARTIALLY_FULFILLED' => StatusTone.info,
      'PENDING_PAYMENT' => StatusTone.warning,
      'CANCELLED' || 'REFUNDED' => StatusTone.error,
      _ => StatusTone.neutral,
    };
