import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pin_pad.dart';
import '../../core/widgets/pp_button.dart';
import '../auth/step_up_dialog.dart';
import '../business/access_labels.dart' show reasonMessage;

/// S-GEN-10 e6 · Crear o cambiar el PIN de confirmación (identity R28, ADR 0020).
///
/// "PIN nuevo" y "Repite el PIN"; al guardar, S-GEN-21 pide la **contraseña** (nivel 3,
/// `identity.pin.set`: el PIN nunca se cambia con el propio PIN) y el PIN viaja a identity, que lo
/// guarda con hash. La app no lo guarda en ningún lado.
class PinSetupSheet extends StatefulWidget {
  const PinSetupSheet({super.key, required this.api});

  final ApiClient api;

  /// true si el PIN quedó guardado.
  static Future<bool> show(BuildContext context, {required ApiClient api}) async =>
      await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => PinSetupSheet(api: api),
      ) ??
      false;

  @override
  State<PinSetupSheet> createState() => _PinSetupSheetState();
}

class _PinSetupSheetState extends State<PinSetupSheet> {
  final _pin = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  String? _repeatError;
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _repeat.dispose();
    super.dispose();
  }

  bool get _complete =>
      _pin.text.length == PinPad.length && _repeat.text.length == PinPad.length;

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    if (_pin.text != _repeat.text) {
      unawaited(HapticFeedback.heavyImpact());
      setState(() => _repeatError = l10n.pinMismatch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _repeatError = null;
    });
    try {
      final token = await StepUpDialog.obtainToken(context,
          api: widget.api, operation: 'identity.pin.set');
      if (token == null || !mounted) return;
      await widget.api.setStepUpPin(_pin.text, stepUpToken: token);
      if (!mounted) return;
      unawaited(HapticFeedback.mediumImpact());
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.pinSaved)));
      Navigator.of(context).pop(true);
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
              child: Text(l10n.pinSetupTitle, style: theme.textTheme.titleLarge),
            ),
            const SizedBox(height: AppTokens.spacingSm),
            Text(l10n.pinSetupHelper, style: theme.textTheme.bodyMedium),
            const SizedBox(height: AppTokens.spacingLg),
            PinPad(
              controller: _pin,
              label: l10n.pinNew,
              autofocus: true,
              enabled: !_busy,
              helperText: l10n.pinFormatHint,
              onChanged: (_) => setState(() => _repeatError = null),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PinPad(
              controller: _repeat,
              label: l10n.pinRepeat,
              enabled: !_busy,
              error: _repeatError,
              onChanged: (_) => setState(() => _repeatError = null),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppTokens.spacingSm),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.actionSavePin,
                onPressed: _complete && !_busy ? _save : null),
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
