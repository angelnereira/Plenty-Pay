import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class ReceiveScreen extends StatelessWidget {
  const ReceiveScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recibir')),
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.qr_code_2, size: 160),
          const SizedBox(height: 12),
          Text('Mi QR personal', style: Theme.of(context).textTheme.titleMedium),
        ]),
      ),
    );
  }
}
