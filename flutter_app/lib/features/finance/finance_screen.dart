import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class FinanceScreen extends StatelessWidget {
  const FinanceScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.moduleFinance)),
      body: Center(child: Text(l10n.moduleFinance, style: Theme.of(context).textTheme.headlineSmall)),
    );
  }
}
