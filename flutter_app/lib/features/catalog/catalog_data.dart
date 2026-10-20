import '../../core/api/api_client.dart';
import '../wallet/wallet_data.dart' show minorUnits;

/// Un producto del catálogo (`catalog.Product` vía `/v1/catalog/products`). Precio en centavos
/// enteros (ADR 0013) y con ITBMS incluido (domain-model §10.4).
class ProductItem {
  const ProductItem({
    required this.id,
    required this.sku,
    required this.barcode,
    required this.name,
    required this.description,
    required this.categoryId,
    required this.unitType,
    required this.priceMinor,
    required this.taxRateBps,
    required this.taxExempt,
    required this.tracksInventory,
    required this.archived,
    required this.imageUrls,
    required this.version,
  });

  factory ProductItem.fromJson(Map<String, dynamic> j) => ProductItem(
        id: j['product_id'] as String? ?? '',
        sku: j['sku'] as String? ?? '',
        barcode: j['barcode'] as String? ?? '',
        name: j['name'] as String? ?? '',
        description: j['description'] as String? ?? '',
        categoryId: j['category_id'] as String? ?? '',
        unitType: j['unit_type'] as String? ?? 'UNIT',
        priceMinor:
            minorUnits((j['price'] as Map<String, dynamic>?)?['amount_minor']),
        taxRateBps: (j['tax_rate_bps'] as num?)?.toInt() ?? 0,
        taxExempt: j['tax_exempt'] as bool? ?? false,
        tracksInventory: j['tracks_inventory'] as bool? ?? false,
        archived: j['status'] == 'PRODUCT_STATUS_ARCHIVED',
        imageUrls: (j['image_object_keys'] as List<dynamic>? ?? const [])
            .cast<String>(),
        version: (j['version'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String sku;
  final String barcode;
  final String name;
  final String description;
  final String categoryId;
  final String unitType;
  final int priceMinor;
  final int taxRateBps;
  final bool taxExempt;
  final bool tracksInventory;
  final bool archived;
  final List<String> imageUrls;
  final int version;

  /// A granel: se vende por peso, volumen o longitud (cantidades en milésimas).
  bool get isBulk => unitType != 'UNIT';
}

/// Una categoría del comercio.
class CategoryItem {
  const CategoryItem(
      {required this.id, required this.name, required this.parentId});

  factory CategoryItem.fromJson(Map<String, dynamic> j) => CategoryItem(
        id: j['category_id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        parentId: j['parent_id'] as String? ?? '',
      );

  final String id;
  final String name;
  final String parentId;
}

/// Una tasa legal de ITBMS vigente (`/v1/catalog/tax-rates`, de `legal.pa.itbms.*`).
class TaxRateItem {
  const TaxRateItem({required this.kind, required this.rateBps});

  factory TaxRateItem.fromJson(Map<String, dynamic> j) => TaxRateItem(
        kind: j['kind'] as String? ?? '',
        rateBps: (j['rate_bps'] as num?)?.toInt() ?? 0,
      );

  final String kind;
  final int rateBps;
}

/// "7 %", "10 %", "2.5 %": la tasa en bps presentada como porcentaje sin decimales de más.
String percentOf(int bps) {
  final whole = bps ~/ 100;
  final frac = bps % 100;
  if (frac == 0) return '$whole %';
  final f = frac.toString().padLeft(2, '0').replaceAll(RegExp(r'0+$'), '');
  return '$whole.$f %';
}

/// Una página de productos con su token.
Future<(List<ProductItem>, String)> loadProducts(ApiClient api,
    {String query = '', bool archived = false, String pageToken = ''}) async {
  final body = await api.listProducts(
      query: query, archived: archived, pageToken: pageToken);
  final items = [
    for (final p in (body['products'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      ProductItem.fromJson(p),
  ];
  final next =
      (body['page'] as Map<String, dynamic>?)?['next_page_token'] as String? ??
          '';
  return (items, next);
}

/// Todos los productos activos (hasta [maxPages] páginas de 200): la caja y el inventario
/// necesitan los nombres para mostrar existencias.
Future<Map<String, ProductItem>> loadProductIndex(ApiClient api,
    {int maxPages = 10}) async {
  final out = <String, ProductItem>{};
  var token = '';
  for (var i = 0; i < maxPages; i++) {
    final body = await api.listProducts(pageSize: 200, pageToken: token);
    for (final p in (body['products'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()) {
      final item = ProductItem.fromJson(p);
      out[item.id] = item;
    }
    token = (body['page'] as Map<String, dynamic>?)?['next_page_token']
            as String? ??
        '';
    if (token.isEmpty) break;
  }
  return out;
}

Future<List<CategoryItem>> loadCategories(ApiClient api) async {
  final body = await api.listCategories();
  return [
    for (final c in (body['categories'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      CategoryItem.fromJson(c),
  ];
}

Future<List<TaxRateItem>> loadTaxRates(ApiClient api) async {
  final body = await api.getTaxRates();
  return [
    for (final r in (body['rates'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      TaxRateItem.fromJson(r),
  ];
}

/// GTIN-8, UPC-A (12), EAN-13 y GTIN-14 con dígito de control (N-STD-23). Misma regla que catalog.
bool validGtin(String code) {
  if (!RegExp(r'^\d+$').hasMatch(code)) return false;
  if (![8, 12, 13, 14].contains(code.length)) return false;
  var sum = 0;
  for (var i = code.length - 2; i >= 0; i--) {
    var d = code.codeUnitAt(i) - 48;
    if ((code.length - 2 - i).isEven) d *= 3;
    sum += d;
  }
  return (10 - sum % 10) % 10 == code.codeUnitAt(code.length - 1) - 48;
}

/// Código de uso interno de tienda (prefijo 02 o 20–29, N-STD-24).
bool isInternalCode(String code) =>
    code.length == 13 &&
    (code.startsWith('02') || RegExp(r'^2[0-9]').hasMatch(code));

/// N-STD-26: genera un EAN-13 interno con prefijo `2` y dígito de control válido.
String generateInternalCode(int seed) {
  final body = '2${(seed.abs() % 100000000000).toString().padLeft(11, '0')}';
  var sum = 0;
  for (var i = body.length - 1; i >= 0; i--) {
    var d = body.codeUnitAt(i) - 48;
    if ((body.length - 1 - i).isEven) d *= 3;
    sum += d;
  }
  return '$body${(10 - sum % 10) % 10}';
}

/// SKU generado cuando se deja vacío (S-CAT-02): letras del nombre + sufijo único.
String generateSku(String name, int seed) {
  final letters = name.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  final head = letters.isEmpty
      ? 'PRD'
      : letters.substring(0, letters.length.clamp(0, 6));
  return '$head-${(seed.abs() % 1000000).toString().padLeft(6, '0')}';
}

/// Cantidad en milésimas presentada en su unidad ("2", "1.5 kg").
String formatQty(int milli, String unitType) {
  final negative = milli < 0;
  final abs = milli.abs();
  final whole = abs ~/ 1000;
  final frac = abs % 1000;
  final number = frac == 0
      ? '$whole'
      : '$whole.${frac.toString().padLeft(3, '0').replaceAll(RegExp(r'0+$'), '')}';
  final unit = switch (unitType) {
    'KG' => ' kg',
    'LITER' => ' L',
    'METER' => ' m',
    _ => '',
  };
  return '${negative ? '−' : ''}$number$unit';
}

/// Lee una cantidad escrita ("2", "1.5", "0,250") como milésimas; null si no es válida.
int? parseQtyMilli(String text) {
  final clean = text.trim().replaceAll(',', '.');
  final m = RegExp(r'^(\d{1,6})(?:\.(\d{1,3}))?$').firstMatch(clean);
  if (m == null) return null;
  final whole = int.parse(m.group(1)!);
  final frac = int.parse((m.group(2) ?? '').padRight(3, '0'));
  return whole * 1000 + frac;
}
