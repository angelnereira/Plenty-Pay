import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class LogisticsScreen extends StatelessWidget {
  const LogisticsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entregas')),
      body: const Center(child: Text('Entregas')),
    );
  }
}
