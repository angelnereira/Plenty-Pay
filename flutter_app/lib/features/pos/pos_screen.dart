import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class PosScreen extends StatelessWidget {
  const PosScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Caja')),
      body: const Center(child: Text('Caja')),
    );
  }
}
