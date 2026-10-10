import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

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

  // F02.3: estos textos pasan a ARB; los `reason` se traducen con error_<REASON>.
  static const _messages = {
    'INVALID_CREDENTIALS': 'Correo o contraseña incorrectos.',
    'ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente. Intenta más tarde.',
    'REGISTRATION_REJECTED': 'No pudimos crear la cuenta. Revisa los datos.',
    'IDENTITY_UNAVAILABLE': 'Servicio no disponible. Intenta en unos minutos.',
  };

  Future<void> _submit() async {
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
      setState(() => _error = _messages[e.reason] ?? 'Algo salió mal (${e.reason}).');
    } catch (_) {
      setState(() => _error = 'Sin conexión con el servidor.');
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
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('PlentyPay', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(_registering ? 'Crea tu cuenta' : 'Inicia sesión', style: theme.textTheme.titleMedium),
                const SizedBox(height: 24),
                if (_registering) ...[
                  TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nombre completo')),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(labelText: 'Correo'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    helperText: _registering ? 'Mínimo 12 caracteres' : null,
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
                      : Text(_registering ? 'Crear cuenta' : 'Entrar'),
                ),
                TextButton(
                  onPressed: _busy ? null : () => setState(() => _registering = !_registering),
                  child: Text(_registering ? 'Ya tengo cuenta' : 'Crear una cuenta'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
