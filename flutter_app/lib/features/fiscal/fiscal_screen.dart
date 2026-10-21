import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class FiscalScreen extends StatelessWidget {
  const FiscalScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fiscal')),
      body: Center(
          child:
              Text('Fiscal', style: Theme.of(context).textTheme.headlineSmall)),
    );
  }
}
