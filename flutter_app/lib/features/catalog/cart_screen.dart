import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('cart_screen')),
      body: const Center(child: Text('cart_screen')),
    );
  }
}
