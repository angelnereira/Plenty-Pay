import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class SendScreen extends StatefulWidget {
  const SendScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _recipient = TextEditingController();
  final _amount = TextEditingController();
  final bool _busy = false;
  String? _ok;

  @override
  void dispose() {
    _recipient.dispose();
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.sendTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _recipient, decoration: const InputDecoration(labelText: 'Correo o teléfono')),
          const SizedBox(height: 8),
          TextField(controller: _amount, decoration: InputDecoration(labelText: l10n.fieldAmount), keyboardType: TextInputType.number),
          const SizedBox(height: 12),
          FilledButton(onPressed: _busy ? null : () => setState(() => _ok = l10n.msgPaymentCreated), child: Text(l10n.actionSend)),
          if (_ok != null) Text(_ok!),
        ],
      ),
    );
  }
}
