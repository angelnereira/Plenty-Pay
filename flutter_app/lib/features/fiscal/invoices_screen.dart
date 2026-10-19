import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class InvoicesScreen extends StatelessWidget {
  const InvoicesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Facturas')),
      body: const Center(child: Text('Facturas')),
    );
  }
}
