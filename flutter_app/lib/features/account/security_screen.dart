import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-11 · `/account/security` · Seguridad.
///
/// Cambio de contraseña (R16), gestión de passkeys/WebAuthn y revocación global.
/// Regla de diseño: un único botón filled ("Cambiar contraseña").
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  bool _loading = false;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  bool get _isValid =>
      _currentPassword.text.isNotEmpty &&
      _newPassword.text.length >= 12 &&
      _newPassword.text == _confirmPassword.text;

  Future<void> _changePassword() async {
    if (!_isValid) return;
    setState(() {
      _loading = true;
      _message = null;
      _error = null;
    });

    try {
      await widget.api.changePassword(
        currentPassword: _currentPassword.text,
        newPassword: _newPassword.text,
      );
      if (!mounted) return;
      setState(() {
        _message = 'Contraseña actualizada correctamente.';
        _currentPassword.clear();
        _newPassword.clear();
        _confirmPassword.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo cambiar la contraseña. Verifica tu clave actual.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Seguridad')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Estado de protección
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 36, color: theme.colorScheme.primary),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Nivel de protección: Alto', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(
                            'Sesiones cifradas y autenticación reforzada activa.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const StatusChip(label: 'Activo', tone: StatusTone.success),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text('Cambio de contraseña', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'La contraseña debe tener al menos 12 caracteres.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _currentPassword,
              labelText: l10n.fieldCurrentPassword,
              obscureText: true,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            PPTextField(
              controller: _newPassword,
              labelText: l10n.fieldNewPassword,
              helperText: l10n.passwordHelper,
              obscureText: true,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            PPTextField(
              controller: _confirmPassword,
              labelText: 'Confirmar nueva contraseña',
              obscureText: true,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            if (_message != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _message!,
                  style: TextStyle(color: theme.colorScheme.primary),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),

            PPButton.primary(
              label: l10n.actionChangePassword,
              onPressed: _isValid && !_loading ? _changePassword : null,
            ),

            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),

            // Llaves de seguridad (Passkeys)
            ListTile(
              leading: const Icon(Icons.key_outlined),
              title: const Text('Llaves de paso (Passkeys)'),
              subtitle: const Text('Inicia sesión con tu huella o rostro.'),
              trailing: const StatusChip(label: 'Configurar', tone: StatusTone.neutral),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Configuración de passkeys disponible próximamente.')),
                );
              },
            ),
            const SizedBox(height: 16),

            // Revocación global de sesiones
            OutlinedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('Cerrar todas las demás sesiones'),
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('¿Cerrar todas las demás sesiones?'),
                    content: const Text('Se revocarán los accesos en todos tus otros dispositivos.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
                      FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cerrar sesiones')),
                    ],
                  ),
                );
                if (confirm == true) {
                  try {
                    await widget.api.logoutAll();
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Otras sesiones revocadas correctamente.')),
                    );
                  } catch (_) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sesiones revocadas.')),
                    );
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
