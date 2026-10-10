import 'package:flutter/material.dart';
import '../data/catalog_repository.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.catalogRepository});
  final CatalogRepository catalogRepository;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchController = TextEditingController();
  late Future<List<CatalogProduct>> _productsFuture;

  @override
  void initState() {
    super.initState();
    _productsFuture = widget.catalogRepository.search();
  }

  void _runSearch() {
    setState(() => _productsFuture = widget.catalogRepository.search(query: _searchController.text.trim()));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Catálogo')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _runSearch(),
              decoration: InputDecoration(
                hintText: 'Buscar por nombre, SKU o código de barras',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<CatalogProduct>>(
              future: _productsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('No se pudo cargar el catálogo: ${snapshot.error}'));
                }
                final products = snapshot.data ?? const [];
                if (products.isEmpty) {
                  return const Center(child: Text('Sin resultados.'));
                }
                return ListView.separated(
                  itemCount: products.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final p = products[index];
                    return ListTile(
                      title: Text(p.name),
                      subtitle: Text([
                        if (p.brand != null) p.brand!,
                        if (p.sku != null) 'SKU ${p.sku}',
                        'Stock: ${p.currentStock}',
                      ].join(' · ')),
                      trailing: p.salePrice != null ? Text('\$${p.salePrice}') : null,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
