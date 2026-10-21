import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';
import '../business/access_labels.dart' show reasonMessage;
import '../business/step_up_flow.dart';
import 'pin_setup_sheet.dart';

/// S-GEN-10 · `/account/security` · Seguridad (ADR 0020).
///
/// e6 PIN de confirmación (estado real de identity) y e1 cambiar contraseña (🔒
/// `identity.password.change`). Sin `local_auth` ni passkeys todavía (F23.3, F28.2) e2 y e3 no se
/// muestran; la lista de sesiones (e4) y "Cerrar todas las demás" (e5) esperan a que identity
/// implemente ListSessions/RevokeSession: no se muestra una acción que no hace nada.
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  late Future<StepUpPinStatus> _pin = widget.api.getStepUpPinStatus();

  Future<void> _setupPin() async {
    if (await PinSetupSheet.show(context, api: widget.api) && mounted) _reloadPin();
  }

  // El callback de setState no puede devolver el Future: se asigna en un bloque.
  void _reloadPin() => setState(() {
        _pin = widget.api.getStepUpPinStatus();
      });

  Future<void> _changePassword() async {
    final l10n = AppLocalizations.of(context);
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ChangePasswordSheet(api: widget.api),
    );
    if (changed == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.msgPasswordChanged)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.securityTitle)),
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.symmetric(horizontal: margin, vertical: AppTokens.spacingMd),
          children: [
            FutureBuilder<StepUpPinStatus>(
              future: _pin,
              builder: (context, snap) {
                final st = snap.data;
                final Widget? status = switch (snap.connectionState) {
                  ConnectionState.done when snap.hasError => null,
                  ConnectionState.done when st != null => StatusChip(
                      label: st.lockedUntil != null
                          ? l10n.securityPinLocked
                          : st.isSet
                              ? l10n.securityPinSet
                              : l10n.securityPinNotSet,
                      tone: st.lockedUntil != null
                          ? StatusTone.error
                          : st.isSet
                              ? StatusTone.success
                              : StatusTone.neutral,
                    ),
                  _ => const LinearProgressIndicator(),
                };
                return ListTile(
                  leading: const Icon(Icons.pin_outlined),
                  title: Text(l10n.securityPinRow),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(snap.hasError
                          ? reasonMessage(l10n, snap.error!)
                          : l10n.pinSetupHelper),
                      if (status != null) ...[
                        const SizedBox(height: AppTokens.spacingXs),
                        status,
                      ],
                    ],
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: snap.hasError ? _reloadPin : _setupPin,
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.password_outlined),
              title: Text(l10n.actionChangePassword),
              subtitle: Text(l10n.passwordHelper),
              trailing: const Icon(Icons.chevron_right),
              onTap: _changePassword,
            ),
          ],
        ),
      ),
    );
  }
}

/// S-GEN-10 e1: contraseña actual y nueva; al enviar, identity pide la confirmación fuerte.
class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet({required this.api});
  final ApiClient api;

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  bool get _valid =>
      _current.text.isNotEmpty && _next.text.length >= 12 && _repeat.text.isNotEmpty;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (_next.text != _repeat.text) {
      setState(() => _error = l10n.passwordMismatch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final done = await runWithStepUp<bool>(context,
          api: widget.api,
          operation: 'identity.password.change',
          title: l10n.actionChangePassword,
          run: (token) async {
            await widget.api.changePassword(
                currentPassword: _current.text,
                newPassword: _next.text,
                stepUpToken: token);
            return true;
          });
      if (done == true && mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      if (mounted) setState(() => _error = reasonMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, 0, margin,
            AppTokens.spacingLg + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(l10n.actionChangePassword, style: theme.textTheme.titleLarge),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPTextField(
              controller: _current,
              labelText: l10n.fieldCurrentPassword,
              obscureText: true,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppTokens.spacingSm),
            PPTextField(
              controller: _next,
              labelText: l10n.fieldNewPassword,
              helperText: l10n.passwordHelper,
              obscureText: true,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppTokens.spacingSm),
            PPTextField(
              controller: _repeat,
              labelText: l10n.fieldRepeatNewPassword,
              obscureText: true,
              error: _error,
              onChanged: (_) => setState(() => _error = null),
            ),
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.actionChangePassword,
                onPressed: _valid && !_busy ? _submit : null),
            const SizedBox(height: AppTokens.spacingSm),
            PPButton.text(
                label: l10n.actionCancel,
                onPressed: () => Navigator.of(context).pop(false)),
          ],
        ),
      ),
    );
  }
}
