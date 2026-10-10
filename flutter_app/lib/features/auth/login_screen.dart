import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

/// Inicio de sesión y registro de cliente (docs/ux/screen-catalog.md §2: /login, /register).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api, required this.onSignedIn});
  final ApiClient api;
  final VoidCallback onSignedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _registering = false;
  bool _busy = false;
  String? _error;

  /// Traduce el `reason` del gateway con ARB (`error_<REASON>`); desconocido → genérico con el reason visible.
  static String _reasonMessage(AppLocalizations l10n, String reason) => switch (reason) {
        'INVALID_CREDENTIALS' => l10n.error_INVALID_CREDENTIALS,
        'ACCOUNT_LOCKED' => l10n.error_ACCOUNT_LOCKED,
        'REGISTRATION_REJECTED' => l10n.error_REGISTRATION_REJECTED,
        'IDENTITY_UNAVAILABLE' => l10n.error_IDENTITY_UNAVAILABLE,
        _ => l10n.errorGeneric(reason),
      };

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_registering) {
        await widget.api.registerCustomer(_name.text.trim(), _email.text.trim(), _password.text);
      } else {
        await widget.api.login(_email.text.trim(), _password.text);
      }
      widget.onSignedIn();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = _reasonMessage(l10n, e.reason));
    } catch (_) {
      if (mounted) setState(() => _error = l10n.errorNoConnection);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l10n.appTitle, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(_registering ? l10n.registerTitle : l10n.loginTitle, style: theme.textTheme.titleMedium),
                const SizedBox(height: 24),
                if (_registering) ...[
                  TextField(controller: _name, decoration: InputDecoration(labelText: l10n.fieldFullName)),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: InputDecoration(labelText: l10n.fieldEmail),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: l10n.fieldPassword,
                    helperText: _registering ? l10n.passwordHelper : null,
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Row(children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error))),
                  ]),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_registering ? l10n.actionCreateAccount : l10n.actionSignIn),
                ),
                TextButton(
                  onPressed: _busy ? null : () => setState(() => _registering = !_registering),
                  child: Text(_registering ? l10n.actionHaveAccount : l10n.actionWantAccount),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
