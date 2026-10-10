import '../../../core/network/api_client.dart';

class CatalogProduct {
  final String id;
  final String name;
  final String? sku;
  final String? brand;
  final String? salePrice; // string para no perder precisión decimal
  final num currentStock;

  const CatalogProduct({
    required this.id,
    required this.name,
    this.sku,
    this.brand,
    this.salePrice,
    required this.currentStock,
  });

  factory CatalogProduct.fromJson(Map<String, dynamic> json) => CatalogProduct(
        id: json['id'] as String,
        name: json['name'] as String,
        sku: json['sku'] as String?,
        brand: json['brand'] as String?,
        salePrice: json['salePrice']?.toString(),
        currentStock: num.tryParse(json['currentStock']?.toString() ?? '0') ?? 0,
      );
}

class CatalogRepository {
  CatalogRepository({required ApiClient apiClient}) : _apiClient = apiClient;
  final ApiClient _apiClient;

  Future<List<CatalogProduct>> search({String query = '', int limit = 20}) async {
    final response = await _apiClient.dio.get(
      '/api/mobile/v1/products',
      queryParameters: {if (query.isNotEmpty) 'q': query, 'limit': limit},
    );
    final list = (response.data['products'] as List<dynamic>? ?? const []);
    return list.map((e) => CatalogProduct.fromJson(e as Map<String, dynamic>)).toList();
  }
}
