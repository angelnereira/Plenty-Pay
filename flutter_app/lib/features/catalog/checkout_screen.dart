import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('checkout_screen')),
      body: const Center(child: Text('checkout_screen')),
    );
  }
}
