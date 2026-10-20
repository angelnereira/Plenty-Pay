import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/api/consents.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../auth/legal_texts.dart';
import '../business/access_labels.dart';

/// S-GEN-17 · `/invite/:token` · Aceptar invitación. Sin sesión obligatoria.
///
/// Muestra «{Negocio} te invita como {rol}» y el alcance (identity.PreviewInvitation). Si el correo
/// ya tiene cuenta, se acepta con su contraseña actual y conserva su billetera (H8); si no, se piden
/// los campos de S-GEN-03 con el correo bloqueado y las cuatro aceptaciones (R18, N-DAT-02, N-DAT-14).
class AcceptInvitationScreen extends StatefulWidget {
  const AcceptInvitationScreen(
      {super.key, required this.api, required this.token, this.onAccepted});
  final ApiClient api;
  final String token;
  final VoidCallback? onAccepted;

  @override
  State<AcceptInvitationScreen> createState() => _AcceptInvitationScreenState();
}

class _AcceptInvitationScreenState extends State<AcceptInvitationScreen> {
  late Future<Map<String, dynamic>> _future =
      widget.api.previewInvitation(widget.token);
  final _name = TextEditingController();
  final _password = TextEditingController();
  late List<ConsentGrant> _consents = initialConsents();
  bool _nameLoaded = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _requiredConsents =>
      _consents[0].granted && _consents[1].granted && _consents[2].granted;

  Future<void> _submit({required bool accountExists}) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.acceptInvitation(
        token: widget.token,
        password: _password.text,
        fullName: accountExists ? '' : _name.text.trim(),
        consents: accountExists ? const [] : _consents,
      );
      widget.onAccepted?.call();
    } on Exception catch (e) {
      if (mounted) setState(() => _error = reasonMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.invitationAcceptTitle)),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) => AsyncView<Map<String, dynamic>>(
          snapshot: snap,
          errorMessage: snap.hasError
              ? reasonMessage(l10n, snap.error!)
              : l10n.errorNoConnection,
          retryLabel: l10n.actionRetry,
          onRetry: () => setState(
              () => _future = widget.api.previewInvitation(widget.token)),
          emptyView: Center(child: Text(l10n.invitationInvalid)),
          builder: (context, inv) {
            if (!_nameLoaded) {
              _name.text = inv['full_name'] as String? ?? '';
              _nameLoaded = true;
            }
            return _form(context, inv, margin);
          },
        ),
      ),
    );
  }

  Widget _form(BuildContext context, Map<String, dynamic> inv, double margin) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    if (inv['status'] != 'PENDING') {
      return Center(
          child: Padding(
              padding: EdgeInsets.all(margin),
              child:
                  Text(l10n.invitationInvalid, textAlign: TextAlign.center)));
    }
    final accountExists = inv['account_exists'] as bool? ?? false;
    final roleName = (inv['role_system'] as bool? ?? false)
        ? templateLabel(l10n, inv['role_name'] as String? ?? '')
        : inv['role_name'] as String? ?? '';
    final branches =
        (inv['branch_names'] as List<dynamic>? ?? const []).cast<String>();
    final scope =
        inv['scope'] == 'BRANCHES' ? branches.join(', ') : l10n.scopeTenant;
    final canSubmit = !_busy &&
        _password.text.isNotEmpty &&
        (accountExists || _requiredConsents);
    return ListView(
      padding: EdgeInsets.fromLTRB(
          margin, AppTokens.spacingLg, margin, AppTokens.spacingLg),
      children: [
        Text(
            l10n.invitationHeadline(
                inv['business_name'] as String? ?? '', roleName),
            style: theme.textTheme.headlineSmall),
        const SizedBox(height: AppTokens.spacingSm),
        Text(l10n.invitationScope(scope), style: theme.textTheme.bodyLarge),
        const SizedBox(height: AppTokens.spacingLg),
        PPTextField(
            labelText: l10n.fieldEmail,
            controller:
                TextEditingController(text: inv['email'] as String? ?? ''),
            readOnly: true),
        const SizedBox(height: AppTokens.spacingMd),
        if (accountExists)
          Text(l10n.invitationExistingAccount,
              style: theme.textTheme.bodyMedium)
        else
          PPTextField(labelText: l10n.fieldFullName, controller: _name),
        const SizedBox(height: AppTokens.spacingMd),
        PPTextField(
          labelText: l10n.fieldPassword,
          controller: _password,
          obscureText: true,
          helperText: accountExists ? null : l10n.passwordHelperRegister,
          onChanged: (_) => setState(() {}),
        ),
        if (!accountExists) ...[
          const SizedBox(height: AppTokens.spacingMd),
          for (final (i, label) in [
            l10n.consentAge,
            l10n.consentTerms,
            l10n.consentPrivacy,
            l10n.consentMarketing
          ].indexed)
            CheckboxListTile(
              value: _consents[i].granted,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _consents = [..._consents]..[i] =
                      _consents[i].copyWith(granted: v ?? false)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: Text(label),
            ),
          Text(l10n.registerDataNotice, style: theme.textTheme.bodySmall),
        ],
        if (_error != null) ...[
          const SizedBox(height: AppTokens.spacingMd),
          Row(children: [
            Icon(Icons.error_outline, color: theme.colorScheme.error),
            const SizedBox(width: AppTokens.spacingSm),
            Expanded(
                child: Text(_error!,
                    style: TextStyle(color: theme.colorScheme.error))),
          ]),
        ],
        const SizedBox(height: AppTokens.spacingLg),
        PPButton.primary(
          label: accountExists
              ? l10n.actionAcceptInvitation
              : l10n.actionAcceptAndCreate,
          loading: _busy,
          onPressed:
              canSubmit ? () => _submit(accountExists: accountExists) : null,
        ),
      ],
    );
  }
}
