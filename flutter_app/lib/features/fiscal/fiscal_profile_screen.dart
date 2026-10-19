import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class FiscalProfileScreen extends StatelessWidget {
  const FiscalProfileScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Perfil fiscal')),
      body: const Center(child: Text('Perfil fiscal')),
    );
  }
}
