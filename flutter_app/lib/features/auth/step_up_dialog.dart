import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pin_pad.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../account/pin_setup_sheet.dart';
import '../business/access_labels.dart' show reasonMessage;

/// S-GEN-21 · Confirmación fuerte (C-06, ADR 0020), hoja inferior modal.
///
/// La app nunca decide: pide el reto a identity, muestra la operación y el monto **que devuelve el
/// reto** (e2), y envía el PIN (e4) o, en nivel 3, la contraseña (e6) a `/v1/step-up/verify`.
/// Sin PIN ni passkey ofrece crearlo (e7). Devuelve el token de un uso o null si se cancela (e5).
/// Las passkeys (e3) llegan con F28.2; mientras identity no las ofrezca, e3 no se muestra.
class StepUpDialog extends StatefulWidget {
  const StepUpDialog({
    super.key,
    required this.api,
    required this.operation,
    this.amountMinor = 0,
    this.currency = '',
    this.fallbackTitle,
  });

  final ApiClient api;
  final String operation;
  final int amountMinor;
  final String currency;

  /// Texto de la operación si el catálogo de la app no la conoce todavía.
  final String? fallbackTitle;

  /// Abre la hoja y devuelve el token de confirmación, o null si la persona cancela.
  static Future<String?> obtainToken(
    BuildContext context, {
    required ApiClient api,
    required String operation,
    int amountMinor = 0,
    String currency = '',
    String? title,
  }) =>
      showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => StepUpDialog(
          api: api,
          operation: operation,
          amountMinor: amountMinor,
          currency: currency,
          fallbackTitle: title,
        ),
      );

  @override
  State<StepUpDialog> createState() => _StepUpDialogState();
}

/// Nombre visible de una operación del catálogo (security-standards.md §4.1).
String stepUpOperationLabel(AppLocalizations l10n, String operation, {String? fallback}) =>
    switch (operation) {
      'payments.intent.create' || 'payments.intent.confirm' => l10n.stepUpOpPayment,
      'payments.refund' => l10n.stepUpOpRefund,
      'wallet.transfer' => l10n.stepUpOpTransfer,
      'identity.role.upsert' => l10n.stepUpOpRole,
      'identity.staff.invite' => l10n.stepUpOpInvite,
      'identity.membership.update' => l10n.stepUpOpMembership,
      'identity.capabilities.set' => l10n.stepUpOpCapabilities,
      'identity.password.change' => l10n.stepUpOpPasswordChange,
      'identity.pin.set' => l10n.stepUpOpPinSet,
      'security.credentials.update' => l10n.stepUpOpCredentials,
      _ => fallback ?? l10n.stepUpTitle,
    };

class _StepUpDialogState extends State<StepUpDialog> {
  final _pin = TextEditingController();
  final _password = TextEditingController();
  StepUpChallenge? _challenge;
  bool _loading = true;
  bool _busy = false;
  bool _pinLocked = false;
  String? _loadError;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pin.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _load({String? notice}) async {
    setState(() {
      _loading = true;
      _loadError = null;
      _error = notice;
      _pinLocked = false;
    });
    try {
      final ch = await widget.api.issueStepUpChallenge(widget.operation,
          amountMinor: widget.amountMinor, currency: widget.currency);
      if (!mounted) return;
      setState(() => _challenge = ch);
    } on Object catch (e) {
      if (!mounted) return;
      setState(() => _loadError = reasonMessage(AppLocalizations.of(context), e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _usesPassword =>
      _challenge != null && _challenge!.availableMethods.contains('PASSWORD') &&
      !_challenge!.availableMethods.contains('PIN');
  bool get _usesPin => _challenge?.availableMethods.contains('PIN') ?? false;
  bool get _needsPin =>
      _challenge != null && !_usesPin && !_usesPassword &&
      _challenge!.allowedMethods.contains('PIN');

  bool get _canSubmit =>
      !_busy &&
      ((_usesPin && !_pinLocked && _pin.text.length == PinPad.length) ||
          (_usesPassword && _password.text.isNotEmpty));

  Future<void> _verify() async {
    final ch = _challenge;
    if (ch == null || !_canSubmit) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = _usesPin
          ? await widget.api.verifyStepUp(ch.id, method: 'PIN', pin: _pin.text)
          : await widget.api.verifyStepUp(ch.id, method: 'PASSWORD', password: _password.text);
      if (!mounted) return;
      unawaited(HapticFeedback.mediumImpact());
      Navigator.of(context).pop(token);
    } on ApiException catch (e) {
      if (!mounted) return;
      unawaited(HapticFeedback.heavyImpact());
      _pin.clear();
      switch (e.reason) {
        case 'PIN_INVALID':
        case 'PIN_LOCKED':
          await _showPinState(l10n, e);
        case 'TOKEN_INVALID':
          await _load(notice: l10n.stepUpExpired);
        case 'PIN_NOT_SET':
          await _load();
        default:
          setState(() => _error = reasonMessage(l10n, e));
      }
    } on Object catch (e) {
      if (mounted) setState(() => _error = reasonMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Tras un PIN equivocado, el estado (intentos o bloqueo) sale de identity, no de la app.
  Future<void> _showPinState(AppLocalizations l10n, ApiException e) async {
    try {
      final st = await widget.api.getStepUpPinStatus();
      if (!mounted) return;
      final until = st.lockedUntil;
      if (until != null) {
        final minutes = until.difference(DateTime.now().toUtc()).inSeconds / 60;
        setState(() {
          _pinLocked = true;
          _error = l10n.stepUpPinLockedMinutes(minutes.ceil().clamp(1, 1440));
        });
      } else {
        setState(() => _error = l10n.stepUpPinAttempts(st.attemptsRemaining));
      }
    } on Object {
      if (mounted) setState(() => _error = reasonMessage(l10n, e));
    }
  }

  Future<void> _createPin() async {
    final created = await PinSetupSheet.show(context, api: widget.api);
    if (created && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final ch = _challenge;
    final amount = ch?.amountMinor ?? widget.amountMinor;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, 0, margin,
            AppTokens.spacingLg + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Icon(Icons.lock_person_outlined, color: theme.colorScheme.primary),
              const SizedBox(width: AppTokens.spacingSm),
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(l10n.stepUpTitle, style: theme.textTheme.titleLarge),
                ),
              ),
            ]),
            const SizedBox(height: AppTokens.spacingMd),
            Text(
              stepUpOperationLabel(l10n, ch?.operation ?? widget.operation,
                  fallback: widget.fallbackTitle),
              style: theme.textTheme.bodyLarge,
            ),
            if (amount > 0)
              MoneyText(amount,
                  style: theme.textTheme.headlineMedium
                      ?.copyWith(color: theme.colorScheme.primary)),
            const SizedBox(height: AppTokens.spacingLg),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_loadError != null) ...[
              Text(_loadError!, style: TextStyle(color: theme.colorScheme.error)),
              const SizedBox(height: AppTokens.spacingSm),
              PPButton.secondary(label: l10n.actionRetry, onPressed: _load),
            ] else if (_usesPin) ...[
              PinPad(
                controller: _pin,
                label: l10n.stepUpPinLabel,
                autofocus: true,
                enabled: !_pinLocked && !_busy,
                error: _error,
                onChanged: (_) => setState(() {}),
                onCompleted: (_) => _verify(),
              ),
              const SizedBox(height: AppTokens.spacingMd),
              PPButton.primary(
                  label: l10n.stepUpConfirm, onPressed: _canSubmit ? _verify : null),
            ] else if (_usesPassword) ...[
              PPTextField(
                controller: _password,
                labelText: l10n.stepUpPasswordLabel,
                obscureText: true,
                error: _error,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: AppTokens.spacingMd),
              PPButton.primary(
                  label: l10n.stepUpConfirm, onPressed: _canSubmit ? _verify : null),
            ] else if (_needsPin) ...[
              Text(l10n.error_PIN_NOT_SET, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppTokens.spacingSm),
              PPButton.primary(label: l10n.stepUpCreatePin, onPressed: _createPin),
            ] else
              Text(l10n.error_STEP_UP_METHOD_NOT_ALLOWED,
                  style: TextStyle(color: theme.colorScheme.error)),
            const SizedBox(height: AppTokens.spacingSm),
            PPButton.text(
                label: l10n.actionCancel,
                onPressed: () => Navigator.of(context).pop()),
          ],
        ),
      ),
    );
  }
}
