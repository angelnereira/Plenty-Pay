import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class PayScanScreen extends StatelessWidget {
  const PayScanScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.payQrTitle)),
      body: const Center(child: Icon(Icons.qr_code_scanner, size: 120)),
    );
  }
}
