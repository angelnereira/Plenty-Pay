import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class PayResultScreen extends StatelessWidget {
  const PayResultScreen({super.key, required this.api, this.success = true});
  final ApiClient api;
  final bool success;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(success ? Icons.check_circle : Icons.error, size: 80, color: success ? Colors.green : Colors.red),
          const SizedBox(height: 12),
          Text(success ? 'Pago exitoso' : 'Pago fallido', style: Theme.of(context).textTheme.headlineSmall),
        ]),
      ),
    );
  }
}
