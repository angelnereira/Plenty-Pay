import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class AcceptInvitationScreen extends StatefulWidget {
  const AcceptInvitationScreen({super.key, required this.api, required this.token, this.onAccepted});
  final ApiClient api;
  final String token;
  final VoidCallback? onAccepted;

  @override
  State<AcceptInvitationScreen> createState() => _AcceptInvitationScreenState();
}

class _AcceptInvitationScreenState extends State<AcceptInvitationScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.acceptInvitation(
        token: widget.token,
        fullName: _name.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
      );
      widget.onAccepted?.call();
    } on Exception catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.invitationAcceptTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _name, decoration: InputDecoration(labelText: l10n.fieldFullName)),
          const SizedBox(height: 8),
          TextField(controller: _email, decoration: InputDecoration(labelText: l10n.fieldEmail)),
          const SizedBox(height: 8),
          TextField(controller: _password, obscureText: true, decoration: InputDecoration(labelText: l10n.fieldPassword, helperText: l10n.passwordHelperRegister)),
          const SizedBox(height: 12),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(l10n.actionCreateAccount)),
        ],
      ),
    );
  }
}
