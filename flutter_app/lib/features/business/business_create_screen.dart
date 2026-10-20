import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class BusinessCreateScreen extends StatefulWidget {
  const BusinessCreateScreen({super.key, required this.api, this.onCreated});
  final ApiClient api;
  final VoidCallback? onCreated;

  @override
  State<BusinessCreateScreen> createState() => _BusinessCreateScreenState();
}

class _BusinessCreateScreenState extends State<BusinessCreateScreen> {
  final _legal = TextEditingController();
  final _trade = TextEditingController();
  final _taxId = TextEditingController();
  final _dv = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _ok;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });
    try {
      await widget.api.createBusiness(
        legalName: _legal.text.trim(),
        tradeName: _trade.text.trim(),
        taxId: _taxId.text.trim(),
        dv: _dv.text.trim().isEmpty ? null : _dv.text.trim(),
      );
      if (mounted) {
        setState(() => _ok = l10n.msgBusinessCreated);
        widget.onCreated?.call();
      }
    } on Exception catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _legal.dispose();
    _trade.dispose();
    _taxId.dispose();
    _dv.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.createBusinessTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
              controller: _legal,
              decoration: InputDecoration(labelText: l10n.fieldLegalName)),
          const SizedBox(height: 8),
          TextField(
              controller: _trade,
              decoration: InputDecoration(labelText: l10n.fieldTradeName)),
          const SizedBox(height: 8),
          TextField(
              controller: _taxId,
              decoration: InputDecoration(labelText: l10n.fieldTaxId)),
          const SizedBox(height: 8),
          TextField(
              controller: _dv,
              decoration: InputDecoration(labelText: l10n.fieldDv)),
          const SizedBox(height: 12),
          if (_error != null)
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          if (_ok != null)
            Text(_ok!,
                style: TextStyle(color: Theme.of(context).colorScheme.primary)),
          FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(l10n.actionCreate)),
        ],
      ),
    );
  }
}
