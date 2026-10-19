import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inventario')),
      body: const Center(child: Text('Inventario')),
    );
  }
}
