import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('orders_screen')),
      body: const Center(child: Text('orders_screen')),
    );
  }
}
