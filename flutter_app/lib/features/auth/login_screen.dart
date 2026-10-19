import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import 'register_screen.dart';

/// S-GEN-02 · `/login` · Iniciar sesión (docs/ux/functional-spec/00-transversal.md).
/// R4: el mensaje de error es el mismo exista o no el correo (anti-enumeración).
/// Q-27/S-GEN-04: «¿Olvidaste tu contraseña?» se agrega en F08.7 con sus rutas (Q-26).
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
  bool _busy = false;
  String? _error;

  /// Traduce el `reason` del gateway con ARB (`error_<REASON>`); desconocido → genérico con el reason visible.
  static String _reasonMessage(AppLocalizations l10n, String reason) => switch (reason) {
        'INVALID_CREDENTIALS' => l10n.error_INVALID_CREDENTIALS,
        'ACCOUNT_LOCKED' => l10n.error_ACCOUNT_LOCKED,
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
      await widget.api.login(_email.text.trim(), _password.text);
      widget.onSignedIn();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = _reasonMessage(l10n, e.reason));
    } catch (e, st) {
      // Borde de la pantalla: un fallo inesperado se registra una vez, con su pila (observability-standards.md §10.3).
      widget.api.logger.error('login failed unexpectedly', e, st, widget: 'LoginScreen');
      if (mounted) setState(() => _error = l10n.errorNoConnection);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openRegister() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => RegisterScreen(
        api: widget.api,
        onRegistered: widget.onSignedIn,
        onHaveAccount: () => Navigator.of(context).pop(),
      ),
    ));
  }

  Future<void> _showServerDialog() async {
    final controller = TextEditingController(text: widget.api.baseUrl);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Configurar Servidor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Dirección del api-gateway:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'http://localhost:8080',
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                ActionChip(
                  label: const Text('Localhost (PC)'),
                  onPressed: () => controller.text = 'http://localhost:8080',
                ),
                ActionChip(
                  label: const Text('Emulador Android'),
                  onPressed: () => controller.text = 'http://10.0.2.2:8080',
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () async {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                widget.api.updateBaseUrl(newUrl);
                await widget.api.session.saveCustomBaseUrl(newUrl);
                if (mounted) {
                  Navigator.of(ctx).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Servidor actualizado: $newUrl')),
                  );
                }
              }
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(l10n.appTitle, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                    IconButton(
                      icon: const Icon(Icons.dns_outlined),
                      tooltip: 'Configurar servidor',
                      onPressed: _showServerDialog,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(l10n.loginTitle, style: theme.textTheme.titleMedium),
                const SizedBox(height: 16),
                PPTextField(
                  controller: _email,
                  label: l10n.fieldEmail,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                PPTextField(
                  controller: _password,
                  label: l10n.fieldPassword,
                  obscureText: true,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error))),
                  ]),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    ActionChip(
                      avatar: const Icon(Icons.storefront, size: 14),
                      label: const Text('Dueño'),
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        _email.text = 'testowner@plentypay.test';
                        _password.text = 'PasswordSegura123456';
                        setState(() => _error = null);
                      },
                    ),
                    ActionChip(
                      avatar: const Icon(Icons.shield_outlined, size: 14),
                      label: const Text('Admin'),
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        _email.text = 'admin@plentypay.test';
                        _password.text = 'PasswordSegura123456';
                        setState(() => _error = null);
                      },
                    ),
                    ActionChip(
                      avatar: const Icon(Icons.person_outline, size: 14),
                      label: const Text('Cliente'),
                      visualDensity: VisualDensity.compact,
                      onPressed: () {
                        _email.text = 'cliente@plentypay.test';
                        _password.text = 'PasswordSegura123456';
                        setState(() => _error = null);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                PPButton.primary(
                  label: l10n.actionSignIn,
                  onPressed: _busy ? null : _submit,
                  loading: _busy,
                ),
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  icon: const Icon(Icons.auto_awesome, size: 16),
                  label: const Text('Modo Demo (sin conexión)'),
                  onPressed: _busy
                      ? null
                      : () {
                          widget.api.enableDemoMode();
                          widget.onSignedIn();
                        },
                ),
                PPButton.text(
                  label: l10n.actionWantAccount,
                  onPressed: _busy ? null : _openRegister,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
