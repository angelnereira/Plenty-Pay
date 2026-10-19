import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('product_screen')),
      body: const Center(child: Text('product_screen')),
    );
  }
}
