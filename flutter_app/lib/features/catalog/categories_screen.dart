import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-CAT-04 · `/catalog/categories` · Categorías de productos.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final List<Map<String, dynamic>> _categories = [
    {'name': 'Café en grano y molido', 'count': 8, 'icon': Icons.coffee},
    {'name': 'Panadería y repostería', 'count': 14, 'icon': Icons.bakery_dining},
    {'name': 'Bebidas frías', 'count': 6, 'icon': Icons.local_drink},
    {'name': 'Accesorios de preparación', 'count': 11, 'icon': Icons.kitchen},
  ];

  void _showAddCategory() {
    final controller = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Nueva categoría', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            PPTextField(
              controller: controller,
              labelText: 'Nombre de la categoría',
            ),
            const SizedBox(height: 16),
            PPButton.primary(
              label: 'Guardar categoría',
              onPressed: () {
                if (controller.text.trim().isNotEmpty) {
                  setState(() {
                    _categories.add({
                      'name': controller.text.trim(),
                      'count': 0,
                      'icon': Icons.category,
                    });
                  });
                  Navigator.pop(ctx);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Categorías'),
        actions: [
          IconButton(
            tooltip: 'Nueva categoría',
            icon: const Icon(Icons.add),
            onPressed: _showAddCategory,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _categories.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final cat = _categories[i];
            return Card(
              child: ListTile(
                leading: Icon(cat['icon'] as IconData),
                title: Text(cat['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('${cat['count']} productos'),
                trailing: const Icon(Icons.chevron_right),
              ),
            );
          },
        ),
      ),
    );
  }
}
