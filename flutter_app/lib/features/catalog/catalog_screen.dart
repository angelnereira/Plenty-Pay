import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class CatalogScreen extends StatelessWidget {
  const CatalogScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('catalog_screen')),
      body: const Center(child: Text('catalog_screen')),
    );
  }
}
