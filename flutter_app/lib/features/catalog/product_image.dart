import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import 'catalog_data.dart';

/// URL de una foto guardada. El producto guarda la ruta relativa (`/media/<tenant>/…`) y se
/// resuelve con la base VIGENTE del gateway: la del túnel cambia (ADR 0019).
String mediaUrl(ApiClient api, String stored) =>
    stored.startsWith('http://') || stored.startsWith('https://')
        ? stored
        : '${api.baseUrl}$stored';

/// Miniatura de 48 dp: la primera foto o un icono.
class ProductThumb extends StatelessWidget {
  const ProductThumb({super.key, required this.api, required this.product});
  final ApiClient api;
  final ProductItem product;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final icon =
        Icon(Icons.inventory_2_outlined, color: scheme.onSurfaceVariant);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      child: Container(
        width: 48,
        height: 48,
        color: scheme.surfaceContainerHighest,
        child: product.imageUrls.isEmpty
            ? icon
            : Image.network(mediaUrl(api, product.imageUrls.first),
                fit: BoxFit.cover,
                semanticLabel: product.name,
                errorBuilder: (_, __, ___) => icon),
      ),
    );
  }
}
