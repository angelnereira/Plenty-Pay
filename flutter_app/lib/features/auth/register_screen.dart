import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/consents.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import 'legal_texts.dart';

/// S-GEN-03 · `/register` · Crear cuenta (docs/ux/functional-spec/00-transversal.md).
///
/// Reglas: N-DAT-02 (consentimiento previo, informado y trazable; una casilla por finalidad y
/// nunca premarcada) y N-DAT-14 (no se abre cuenta a menores de 18 años).
///
/// Q-27: los enlaces a los textos legales (e7, e8 y el aviso C-16) se agregan con S-PUB-03
/// (F25.4); hoy la casilla declara la aceptación y el servidor guarda la versión del texto.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.api, required this.onRegistered, required this.onHaveAccount});

  final ApiClient api;
  final VoidCallback onRegistered;
  final VoidCallback onHaveAccount;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  late final List<ConsentGrant> _consents = initialConsents();
  bool _busy = false;
  String? _error;

  // e2: 2–120 caracteres.
  bool get _nameValid {
    final len = _name.text.trim().characters.length;
    return len >= 2 && len <= 120;
  }

  // e3: formato básico; el servidor es la autoridad (R1).
  bool get _emailValid => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_email.text.trim());

  // e4: R2, 12–128 caracteres.
  bool get _passwordValid {
    final len = _password.text.characters.length;
    return len >= 12 && len <= 128;
  }

  // e10: habilitado con e2–e4 válidos y e6–e8 marcadas (e9 es opcional).
  bool get _formValid =>
      _nameValid &&
      _emailValid &&
      _passwordValid &&
      _consents[0].granted && // e6: 18 años o más (N-DAT-14)
      _consents[1].granted && // e7: términos
      _consents[2].granted; // e8: privacidad

  /// Traduce el `reason` del gateway con ARB (`error_<REASON>`); desconocido → genérico.
  String _reasonMessage(AppLocalizations l10n, String reason) => switch (reason) {
        'EMAIL_TAKEN' => l10n.error_EMAIL_TAKEN,
        'WEAK_PASSWORD' => l10n.error_WEAK_PASSWORD,
        'INVALID_EMAIL' => l10n.error_INVALID_EMAIL,
        'CONSENT_REQUIRED' => l10n.error_CONSENT_REQUIRED,
        'AGE_REQUIREMENT' => l10n.error_AGE_REQUIREMENT,
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
      await widget.api.registerCustomer(
        _name.text.trim(),
        _email.text.trim(),
        _password.text,
        _consents,
      );
      widget.onRegistered();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = _reasonMessage(l10n, e.reason));
    } catch (e, st) {
      // Borde de la pantalla: un fallo inesperado se registra una vez, con su pila
      // (observability-standards.md §10.3).
      widget.api.logger.error('registration failed unexpectedly', e, st, widget: 'RegisterScreen');
      if (mounted) setState(() => _error = l10n.errorNoConnection);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _setConsent(int index, bool granted) {
    setState(() => _consents[index] = _consents[index].copyWith(granted: granted));
  }

  bool _obscurePassword = true;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l10n.appTitle, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 24),
                PPTextField(
                  controller: _name,
                  label: l10n.fieldFullName,
                  keyboardType: TextInputType.name,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                PPTextField(
                  controller: _email,
                  label: l10n.fieldEmail,
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                PPTextField(
                  controller: _password,
                  label: l10n.fieldPassword,
                  obscureText: _obscurePassword,
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                    tooltip: _obscurePassword ? 'Mostrar contraseña' : 'Ocultar contraseña',
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                // e5
                Padding(
                  padding: const EdgeInsets.only(top: 6, bottom: 4),
                  child: Row(
                    children: [
                      Icon(
                        _passwordValid ? Icons.check_circle_outline : Icons.info_outline,
                        size: 14,
                        color: _passwordValid ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _password.text.isEmpty
                              ? l10n.passwordHelperRegister
                              : _passwordValid
                                  ? '✓ Longitud segura (${_password.text.length} caracteres)'
                                  : 'Mínimo 12 caracteres (llevas ${_password.text.length}/12 — faltan ${12 - _password.text.length})',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: _passwordValid
                                ? theme.colorScheme.primary
                                : (_password.text.isNotEmpty ? theme.colorScheme.tertiary : null),
                            fontWeight: _password.text.isNotEmpty ? FontWeight.w600 : null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // e6
                CheckboxListTile(
                  value: _consents[0].granted,
                  onChanged: _busy ? null : (v) => _setConsent(0, v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.consentAge),
                ),
                // e7
                CheckboxListTile(
                  value: _consents[1].granted,
                  onChanged: _busy ? null : (v) => _setConsent(1, v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.consentTerms),
                ),
                // e8
                CheckboxListTile(
                  value: _consents[2].granted,
                  onChanged: _busy ? null : (v) => _setConsent(2, v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.consentPrivacy),
                ),
                // e9 (opcional: mercadeo, finalidad separada)
                CheckboxListTile(
                  value: _consents[3].granted,
                  onChanged: _busy ? null : (v) => _setConsent(3, v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.consentMarketing),
                ),
                // C-16: aviso de tratamiento de datos (N-DAT-03). El enlace llega con S-PUB-03 (Q-27).
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(l10n.registerDataNotice, style: theme.textTheme.bodySmall),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Row(children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error))),
                  ]),
                  if (_error == l10n.error_EMAIL_TAKEN)
                    TextButton(
                      onPressed: _busy ? null : widget.onHaveAccount,
                      child: Text(l10n.actionHaveAccount),
                    ),
                ],
                if (!_formValid && (_name.text.isNotEmpty || _email.text.isNotEmpty || _password.text.isNotEmpty)) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Pendiente para habilitar el registro:',
                          style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        if (!_nameValid)
                          Text('• Nombre completo (2 a 120 letras)', style: theme.textTheme.bodySmall),
                        if (!_emailValid)
                          Text('• Correo electrónico válido', style: theme.textTheme.bodySmall),
                        if (!_passwordValid)
                          Text('• Contraseña de al menos 12 caracteres (has escrito ${_password.text.length})',
                              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.tertiary, fontWeight: FontWeight.w600)),
                        if (!_consents[0].granted)
                          Text('• Confirmar que tienes 18 años o más', style: theme.textTheme.bodySmall),
                        if (!_consents[1].granted || !_consents[2].granted)
                          Text('• Aceptar Términos y Condiciones y Privacidad', style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                // e10
                PPButton.primary(
                  label: l10n.actionCreateAccount,
                  onPressed: _formValid && !_busy ? _submit : null,
                  loading: _busy,
                ),
                PPButton.text(
                  label: l10n.actionHaveAccount,
                  onPressed: _busy ? null : widget.onHaveAccount,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
