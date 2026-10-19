import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-GEN-04 · `/forgot`, `/reset/:token` · Recuperar contraseña.
///
/// Flujo de dos pasos: envío de enlace/código al correo y restablecimiento con clave ≥ 12 caracteres.
/// Regla R4 de identity: el mensaje de envío es idéntico exista o no el correo en el sistema.
class PasswordRecoveryScreen extends StatefulWidget {
  const PasswordRecoveryScreen({super.key, required this.api, this.token});

  final ApiClient api;
  final String? token;

  @override
  State<PasswordRecoveryScreen> createState() => _PasswordRecoveryScreenState();
}

class _PasswordRecoveryScreenState extends State<PasswordRecoveryScreen> {
  final _emailController = TextEditingController();
  final _tokenController = TextEditingController();
  final _newPasswordController = TextEditingController();

  bool _sent = false;
  bool _submitting = false;
  bool _resetComplete = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.token != null) {
      _tokenController.text = widget.token!;
      _sent = true;
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _tokenController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  Future<void> _requestLink() async {
    final email = _emailController.text.trim();
    if (!email.contains('@')) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.api.forgotPassword(email);
    } catch (_) {
      // Regla R4: respuesta idéntica siempre
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
          _sent = true;
        });
      }
    }
  }

  Future<void> _resetPassword() async {
    final token = _tokenController.text.trim();
    final newPassword = _newPasswordController.text;
    if (token.isEmpty || newPassword.length < 12) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.api.resetPassword(token: token, newPassword: newPassword);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _resetComplete = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'El código o enlace no es válido o ya expiró.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    if (_resetComplete) {
      return Scaffold(
        appBar: AppBar(title: const Text('Contraseña restablecida')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline, size: 64, color: theme.colorScheme.primary),
                const SizedBox(height: 16),
                Text('¡Listo!', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 12),
                Text(
                  'Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
                const Spacer(),
                PPButton.primary(
                  label: l10n.actionSignIn,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Recuperar contraseña')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (!_sent) ...[
              Text('¿Olvidaste tu contraseña?', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Ingresa tu correo electrónico registrado y te enviaremos las instrucciones para restablecerla.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              PPTextField(
                controller: _emailController,
                labelText: l10n.fieldEmail,
                keyboardType: TextInputType.emailAddress,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 24),
              PPButton.primary(
                label: 'Enviar instrucciones',
                onPressed: _emailController.text.trim().contains('@') && !_submitting ? _requestLink : null,
              ),
            ] else ...[
              Text('Código de restablecimiento', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Si el correo está registrado, enviamos un código de un solo uso.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              PPTextField(
                controller: _tokenController,
                labelText: 'Código o token de recuperación',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              PPTextField(
                controller: _newPasswordController,
                labelText: l10n.fieldNewPassword,
                helperText: l10n.passwordHelper,
                obscureText: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                ),
              PPButton.primary(
                label: 'Actualizar contraseña',
                onPressed: _tokenController.text.trim().isNotEmpty &&
                        _newPasswordController.text.length >= 12 &&
                        !_submitting
                    ? _resetPassword
                    : null,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
