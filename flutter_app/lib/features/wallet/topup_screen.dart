import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class TopupScreen extends StatefulWidget {
  const TopupScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends State<TopupScreen> {
  final _amount = TextEditingController();
  final bool _busy = false;
  String? _ok;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.topupTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _amount, decoration: InputDecoration(labelText: l10n.fieldAmount), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          FilledButton(onPressed: _busy ? null : () { setState(() => _ok = l10n.msgPaymentCreated); }, child: Text(l10n.actionTopup)),
          if (_ok != null) Text(_ok!),
        ],
      ),
    );
  }
}
